// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of `graph_init` — the engine-agnostic root-graph
 * initialisation C runs ONCE, for EVERY engine, from `gvLayoutJobs`
 * (`lib/gvc/gvlayout.c:81`) before dispatching to `gvle->layout(g)`:
 *
 *     graph_init(g, !!(gvc->layout.features->flags & LAYOUT_USES_RANKDIR));
 *
 * The port previously had no `graph_init` analogue: every field below was
 * re-derived inside each engine's own init, so an engine could silently miss
 * any one of them. That produced three defects of the same class in a row
 * (`common_init_edge` → no `ED_label`; `gv_postprocess` → no xlabel placement;
 * `do_graph_label` → no `GD_label`). This module is the single shared
 * definition; every engine calls it exactly once at the top of its layout.
 *
 * `useRankdir` is true for **dot only** — `LAYOUT_USES_RANKDIR` is set by
 * `plugin/dot_layout/gvlayout_dot_layout.c:27` and by no other layout plugin.
 *
 * @see lib/common/input.c:600 graph_init
 * @see lib/gvc/gvlayout.c:81 (the single, engine-agnostic call site)
 */

import type { Graph } from '../model/graph.js';
import { lateDouble, lateInt, layoutMeasurer } from './nodeinit.js';
import { POINTS_PER_INCH } from '../model/geom.js';
import { makeDrawing, FontnameKind } from '../model/layoutParams.js';
import type { RatioKind } from '../model/layoutParams.js';
import { doGraphLabel } from '../layout/dot/graph-label.js';
import { mapbool, setClType, LOCAL, GLOBAL, NOCLUST } from '../layout/dot/rank.js';
import { cround } from './arith.js';

// ---------------------------------------------------------------------------
// Constants — @see lib/common/const.h
// ---------------------------------------------------------------------------

/** @see lib/common/const.h:RANKDIR_TB */
export const RANKDIR_TB = 0;
/** @see lib/common/const.h:RANKDIR_LR */
export const RANKDIR_LR = 1;
/** @see lib/common/const.h:RANKDIR_BT */
export const RANKDIR_BT = 2;
/** @see lib/common/const.h:RANKDIR_RL */
export const RANKDIR_RL = 3;

/** nodesep / ranksep bounds. @see lib/common/const.h:85-88 */
const DEFAULT_NODESEP = 0.25;
const MIN_NODESEP = 0.02;
const DEFAULT_RANKSEP = 0.5;
const MIN_RANKSEP = 0.02;

/**
 * `POINTS(DEFAULT_NODESEP)` — the GD_nodesep every graph gets absent the attr.
 * @see lib/common/input.c:665-667
 */
export const DEFAULT_NODESEP_POINTS = 18;

/** C `UCHAR_MAX`, the clamp on GD_showboxes. @see lib/common/input.c:683-689 */
const UCHAR_MAX = 255;

/** Internal charset codes. @see lib/common/const.h:187-189 */
export const CHAR_UTF8 = 0;
export const CHAR_LATIN1 = 1;
export const CHAR_BIG5 = 2;

/** Inches→points exactly as C's POINTS macro: ROUND(in * 72). @see geom.h:62 */
function points(inches: number): number {
  return cround(inches * POINTS_PER_INCH);
}

// ---------------------------------------------------------------------------
// findCharset — @see lib/common/input.c:539
// ---------------------------------------------------------------------------

/**
 * Map the `charset` attr to its internal code; absent/empty → CHAR_UTF8.
 * C's `late_nnstring` treats an empty string as absent, and every comparison
 * is case-insensitive (`strcasecmp`).
 * @see lib/common/input.c:539 findCharset
 */
export function findCharset(g: Graph): number {
  const raw = g.attrs.get('charset');
  const p = (raw === undefined || raw === '' ? 'utf-8' : raw).toLowerCase();
  if (p === 'latin-1' || p === 'latin1' || p === 'l1'
    || p === 'iso-8859-1' || p === 'iso_8859-1' || p === 'iso8859-1'
    || p === 'iso-ir-100') {
    return CHAR_LATIN1;
  }
  if (p === 'big-5' || p === 'big5') return CHAR_BIG5;
  if (p === 'utf-8' || p === 'utf8') return CHAR_UTF8;
  console.error(`Warning: Unsupported charset "${raw}" - assuming utf-8`);
  return CHAR_UTF8;
}

// ---------------------------------------------------------------------------
// maptoken — @see lib/common/utils.c:315
// ---------------------------------------------------------------------------

/**
 * C's `maptoken`: return `val[i]` for the first `name[i]` equal to `p`; when
 * `p` is null or matches nothing, `i` lands on the NULL terminator and the
 * LAST entry of `val` — the default — is returned.
 * @see lib/common/utils.c:315 maptoken
 */
function maptoken(p: string | undefined, names: string[], vals: number[]): number {
  for (let i = 0; i < names.length; i++) {
    if (p !== undefined && p === names[i]) return vals[i]!;
  }
  return vals[names.length]!;
}

// ---------------------------------------------------------------------------
// nodesep / ranksep — @see lib/common/input.c:665-681
// ---------------------------------------------------------------------------

/**
 * `nodesep` is a plain late_double; `ranksep` additionally honours the
 * `equally` keyword (→ exact_ranksep) and a bare number that may be followed
 * by text. Absent attrs yield POINTS(DEFAULT_*) = 18 / 36.
 * @see lib/common/input.c:665-681
 */
function parseSepAttrs(g: Graph): void {
  g.info.nodesep = points(lateDouble(g.attrs.get('nodesep'), DEFAULT_NODESEP, MIN_NODESEP));
  const p = g.attrs.get('ranksep');
  let xf = DEFAULT_RANKSEP;
  if (p !== undefined && p !== '') {
    // C: sscanf(p, "%lf", &xf) == 0 → no leading number → DEFAULT_RANKSEP.
    const parsed = Number.parseFloat(p);
    xf = Number.isNaN(parsed) ? DEFAULT_RANKSEP : Math.max(parsed, MIN_RANKSEP);
    if (p.includes('equally')) g.info.exact_ranksep = true;
  }
  g.info.ranksep = points(xf);
}

// ---------------------------------------------------------------------------
// setRatio + size — @see lib/common/input.c:576, 693-694
// ---------------------------------------------------------------------------

/** sscanf("%lf")-style float token. @see lib/common/input.c:476 getdoubles2ptf */
const SIZE_FLOAT = '[-+]?[0-9.]+(?:[eE][-+]?[0-9]+)?';
const SIZE_XY_RE = new RegExp(`^\\s*(${SIZE_FLOAT})\\s*,\\s*(${SIZE_FLOAT})(.?)`);
const SIZE_X_RE = new RegExp(`^\\s*(${SIZE_FLOAT})(.?)`);

/**
 * Local port of `getdoubles2ptf(g,"size",…)`: parse `"x,y"` (or a lone `"x"`
 * meaning square) → points, with a trailing `!` as the *filled* flag. Returns
 * null when absent or non-positive. Re-derived here rather than imported from
 * `gvc/viewport` to avoid a layout→render dependency edge (same result).
 * @see lib/common/input.c:476 getdoubles2ptf
 */
function parseSizePoints(raw: string | undefined): { x: number; y: number; filled: boolean } | null {
  if (raw === undefined) return null;
  const xy = SIZE_XY_RE.exec(raw);
  if (xy) {
    const xf = Number(xy[1]);
    const yf = Number(xy[2]);
    if (xf > 0 && yf > 0) return { x: points(xf), y: points(yf), filled: xy[3] === '!' };
  }
  const x = SIZE_X_RE.exec(raw);
  if (x) {
    const xf = Number(x[1]);
    if (xf > 0) return { x: points(xf), y: points(xf), filled: x[2] === '!' };
  }
  return null;
}

/**
 * Port of `setRatio` (input.c:576): map the `ratio` attr to a RatioKind. A
 * positive numeric value is R_VALUE; anything else absent/unrecognized → none.
 * @see lib/common/input.c:576 setRatio
 */
function parseRatioKind(g: Graph): RatioKind | undefined {
  const p = g.attrs.get('ratio');
  if (p === undefined) return undefined;
  if (p === 'auto') return 'auto';
  if (p === 'compress') return 'compress';
  if (p === 'expand') return 'expand';
  if (p === 'fill') return 'fill';
  return Number.parseFloat(p) > 0 ? 'value' : undefined;
}

/**
 * Populate `g.info.drawing` for the ratio kinds whose layout reshape is ported
 * AND corpus-validated: `compress` (compressGraph x-NS, position-cluster.ts)
 * and `fill` (setAspect R_FILL, position-bbox.ts). `expand`/`value` have the
 * math in setAspect but no corpus coverage, and `auto` needs `idealsize`
 * (unported); all three stay deferred — leaving `drawing` unset keeps
 * setAspect/compressGraph a no-op for them.
 *
 * DELIBERATE DEVIATION from C, carried over verbatim from dot's old init: C
 * allocates GD_drawing unconditionally (`input.c:609`) and stores the parsed
 * ratio_kind for EVERY kind. Allocating it here would flip the
 * `drawing === undefined` guards at `dot/position-bbox.ts:142` (setAspect) and
 * `neato/set-aspect.ts:57`, activating the unvalidated expand/value/auto
 * reshapes and changing dot output. Scope is therefore unchanged by the
 * graph_init consolidation. See `.agent-notes/graph-init-consolidation.md`.
 *
 * @see lib/dotgen/position.c:set_aspect (904), compress_graph (501)
 * @see lib/common/input.c:576 setRatio, 693-694 (size)
 */
function parseRatioDrawing(g: Graph): void {
  const kind = parseRatioKind(g);
  if (kind !== 'compress' && kind !== 'fill') return;
  const sz = parseSizePoints(g.attrs.get('size'));
  g.info.drawing = makeDrawing({
    ratioKind: kind,
    size: sz ? { x: sz.x, y: sz.y } : { x: 0, y: 0 },
    filled: sz?.filled ?? false,
  });
}

// ---------------------------------------------------------------------------
// graphInit — @see lib/common/input.c:600
// ---------------------------------------------------------------------------

/** `clusterrank` tokens/codes. @see lib/common/input.c:604-605 */
const RANK_NAMES = ['local', 'global', 'none'];

/** `fontnames` tokens/codes. @see lib/common/input.c:606-607 */
const FONTNAME_NAMES = ['gd', 'ps', 'svg'];

/**
 * The `rankcode` / `fontnamecodes` tables are built at CALL time, not module
 * scope. `LOCAL`/`GLOBAL`/`NOCLUST` arrive from `layout/dot/rank.ts`, which sits
 * in an import cycle with this module (graph-init → nodeinit → shapes →
 * compass-port → dot/init → graph-init). Snapshotting them into a module-level
 * array captures whatever the binding holds while the cycle is still resolving —
 * under Vite's SSR transform a partially-initialized circular import reads as
 * `undefined` (no TDZ throw), which froze the table as `[undefined, …]`,
 * made `maptoken` return `undefined`, and left `CL_type` non-LOCAL — silently
 * disabling dot's cluster collapsing. Reading the live bindings inside the
 * function is evaluated only after every module is initialised.
 */
function rankCodes(): number[] {
  return [LOCAL, GLOBAL, NOCLUST, LOCAL];
}

/** @see lib/common/input.c:607 fontnamecodes */
function fontnameCodes(): number[] {
  return [FontnameKind.NativeFonts, FontnameKind.PsFonts, FontnameKind.SvgFonts, -1];
}

/**
 * The engine-agnostic root-graph init C runs before every layout.
 *
 * Field order follows the C exactly. Fields C sets that this port does NOT
 * store here — each is either derived at its use-site from the same attribute
 * (identical value, different storage) or browser-impossible — are marked
 * `SKIPPED` inline with their reason.
 *
 * @param g root graph
 * @param useRankdir C's `LAYOUT_USES_RANKDIR` feature flag: true for dot,
 *   false for every other engine (`plugin/dot_layout/gvlayout_dot_layout.c:27`
 *   is the only plugin that sets it).
 * @see lib/common/input.c:600 graph_init
 */
export function graphInit(g: Graph, useRankdir: boolean): void {
  // GD_drawing(g) = gv_alloc(sizeof(layout_t)) (input.c:609) — deliberately NOT
  // allocated unconditionally; see parseRatioDrawing's note (it would change
  // dot output by activating the unported ratio modes).

  // SKIPPED — `postaction` reparse (input.c:611-617): needs agmemconcat plus
  // parser re-entry to splice a second graph into g. Neither exists in the
  // port, and no corpus input sets `postaction`.

  // SKIPPED — fontpath / DOTFONTPATH setenv (input.c:619-629): browser-
  // impossible (no environment, no GDFONTPATH).

  g.info.charset = findCharset(g); // @see input.c:631

  // SKIPPED — Gvimagepath / `imagepath` (input.c:633-638): the port loads no
  // images from disk (browser-safe: image data arrives as a parameter).

  // SKIPPED — GD_drawing(g)->quantum (input.c:640-641): derived at its only
  // use-site, nodeinit.ts:129 — `lateDouble(g.root.attrs.get('quantum'), 0, 0)`
  // feeding poly-sizing's quantumIn — from the same attr with the same
  // late_double. Identical value; storing it needs `drawing` (see above).

  // rankdir. C stores the EFFECTIVE rankdir in bits 0-1 and the REAL rankdir in
  // bits 2-3: "setting rankdir=LR is only defined in dot, but having it set
  // causes shape code and others to use it. The result is confused output, so
  // we turn it off unless requested. […] Sometimes, the code really needs the
  // graph's rankdir, e.g., neato -n with record shapes, so we store the real
  // rankdir in the next 2 bits." @see input.c:643-663
  let rankdir = RANKDIR_TB;
  const rd = g.attrs.get('rankdir');
  if (rd === 'LR') rankdir = RANKDIR_LR;
  else if (rd === 'BT') rankdir = RANKDIR_BT;
  else if (rd === 'RL') rankdir = RANKDIR_RL;
  if (useRankdir) {
    // SET_RANKDIR(g, (rankdir << 2) | rankdir)
    g.info.rankdir = (rankdir << 2) | rankdir;
    g.info.flip = (rankdir & 1) === 1; // GD_flip: bit 0 of the effective rankdir
  } else {
    // SET_RANKDIR(g, rankdir << 2) — the effective rankdir stays TB, so nothing
    // flips or rotates; only GD_realrankdir (bits 2-3) sees the attr.
    g.info.rankdir = rankdir << 2;
    g.info.flip = false;
  }

  parseSepAttrs(g); // nodesep, ranksep, exact_ranksep — @see input.c:665-681

  // showboxes, clamped to UCHAR_MAX. @see input.c:683-689
  g.info.showboxes = Math.min(lateInt(g.attrs.get('showboxes'), 0, 0), UCHAR_MAX);

  // fontnames. C's maptoken default is -1 (attr absent or unknown token), which
  // the FontnameKind union cannot express; the port leaves the field undefined
  // in that case. Nothing reads GD_fontnames yet (the PS/SVG font-name
  // remapping is not ported), so -1 and undefined are indistinguishable.
  // @see input.c:690-691
  const fn = maptoken(g.attrs.get('fontnames'), FONTNAME_NAMES, fontnameCodes());
  if (fn !== -1) g.info.fontnames = fn as FontnameKind;

  parseRatioDrawing(g); // setRatio(g) + size → GD_drawing. @see input.c:693-694

  // SKIPPED — page (input.c:695), centered (input.c:697), landscape
  // (input.c:699-704): all three are *output* concerns the port derives at
  // render time from the same attrs — gvc/viewport.ts:163-169 (parseLandscape
  // applies C's exact precedence: rotate=90, else orientation[0] in {l,L}, else
  // mapbool(landscape)), parseGraphPad/parseGraphMargin, and
  // initJobViewportZoom (size + `!` filled flag). Storing them in GD_drawing
  // here would require allocating `drawing` unconditionally (see above).

  // clusterrank → CL_type. @see input.c:706-707
  setClType(maptoken(g.attrs.get('clusterrank'), RANK_NAMES, rankCodes()));

  // concentrate → Concentrate. @see input.c:708-709
  g.info.concentrate = mapbool(g.attrs.get('concentrate'));

  // SKIPPED — State = GVBEGIN (input.c:710): the emit-time layer/state machine
  // (`State`, `GVBEGIN`) is not ported.

  g.info.edgeLabelsDone = false; // EdgeLabelsDone = 0. @see input.c:711

  // SKIPPED — GD_drawing(g)->dpi (input.c:713-717): derived at its use-site,
  // gvc/device.ts:545, with the identical nested fallback
  // `late_double(dpi, late_double(resolution, 0, 0), 0)`.

  doGraphLabel(g, layoutMeasurer(g)); // @see input.c:719 — creates GD_label(g)

  // SKIPPED — Initial_dist = MYHUGE (input.c:721): the neato global is not
  // ported; no use-site reads it.

  // SKIPPED — G_ordering / G_gradientangle / G_margin (input.c:723-725) and the
  // N_* / E_* attribute caches (input.c:727-789): these are `agfindattr`
  // *descriptor pointers*, cached to make later attribute lookups O(1). The
  // port models attributes as a per-object `Map`, so every use-site calls
  // `attrs.get(name)` directly — there is no descriptor to cache. The one cache
  // entry carrying a side effect is `N_label` (input.c:737-739), which creates a
  // default AGNODE `label` attr of NODENAME_ESC ("\N") when absent; the port
  // reproduces that default at the use-site — poly-init.ts:109 falls back to
  // `n.name`, the resolved value of "\N".

  // SKIPPED — GD_drawing(g)->xdots = init_xdot(g) (input.c:792): parsing the
  // `_background` xdot attr is not ported.

  // SKIPPED — GD_drawing(g)->id (input.c:795-796): read at render time from the
  // same attr (render/svg-graph.ts:324).
}
