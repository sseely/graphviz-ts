// SPDX-License-Identifier: EPL-2.0

/**
 * DOT and XDOT renderer plugins.
 *
 * Ports gvrender_core_dot.c — FORMAT_DOT and FORMAT_XDOT branches.
 * FORMAT_CANON, FORMAT_XDOT12, FORMAT_XDOT14 are out of scope (AD-12).
 *
 * @see plugin/core/gvrender_core_dot.c
 * @see plugin/core/gvplugin_core.c
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { Point } from '../model/geom.js';
import type { TextSpan } from '../common/emit-types.js';
import type { ArrowDrawOp } from '../common/arrows-types.js';
import type { GVColor } from '../common/color.js';
import { colorxlate } from '../common/color.js';
import { resolveRenderColor } from './color-resolve.js';
import { getGradientPoints } from './svg-gradient.js';
import { edgeIsTapered } from './svg-tapered-edge.js';
import { taper, taperfun } from '../common/taper.js';
import { orthoRoundedRadius } from './svg-helpers.js';
import { orthoRoundedPolylines } from './svg-edge-ortho-radius.js';
import { findStopColor, parseStyleFlags } from '../common/style-resolve.js';
import { parseGraphPad } from '../gvc/viewport.js';
import { parseSegs } from '../common/multicolor.js';
import { splitSplineByColor } from './svg-edge-split.js';
import { buildOffsetLists, advanceTmpList } from '../common/edge-offset.js';
import { IGNORED } from '../layout/dot/rank.js';
import { edgeHasDrawableContent } from './svg.js';
import type { Bezier } from '../model/geom.js';
import type { RendererPlugin } from '../gvc/context.js';
import { PenType, FillType } from '../gvc/context.js';
import type { RenderJob, ObjState } from '../gvc/job.js';
import { EmitState, toFixed2HalfEven } from '../gvc/job.js';
import { renderEdgeLabels } from '../gvc/edge-labels.js';
import { printfSig, printfFixed } from '../util/printf-round.js';
import { POINTS_PER_INCH } from '../model/geom.js';
import type { TextlabelT, FieldT, ShapeDesc } from '../common/types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const XDOT_VERSION = '1.7';

/** Max magnitude cap — matches maxnegnum in C source. */
const MAX_NEGNUM = 999999999999999.99;

/** Near-zero suppression threshold (same as gvprintdouble). */
const NEAR_ZERO = 0.005;

/** Indices 8/9 alias 1; 10/11 alias 5. NUM_XBUFS covers 0–7. */
const NUM_XBUFS = 8;

/**
 * Style tokens that never become an xdot `S` op: `filled`/`bold`/`setlinewidth`
 * are filtered by xdot_style itself; the polygon/fill styles are consumed by the
 * shape/fill code before gvrender_set_style, so they never reach the render
 * style. Only line styles (solid/dashed/dotted + unknown) emit an `S` op.
 * @see plugin/core/gvrender_core_dot.c:184 xdot_style · lib/common/shapes.c
 */
const NON_LINE_STYLES: ReadonlySet<string> = new Set([
  'filled', 'bold', 'rounded', 'diagonals', 'striped', 'wedged',
  'invis', 'invisible', 'radial',
]);

// ---------------------------------------------------------------------------
// printNum — @see lib/gvc/gvdevice.c:gvprintnum
// ---------------------------------------------------------------------------

/**
 * Strip trailing zeros (and the decimal point) from a toFixed(3) string,
 * then collapse a leading "0." or "-0." prefix.
 */
function trimAndStrip(s: string): string {
  const dot = s.indexOf('.');
  if (dot < 0) return s;
  let end = s.length;
  while (end > dot + 1 && s[end - 1] === '0') end--;
  if (s[end - 1] === '.') end--;
  const t = s.slice(0, end);
  if (t.startsWith('0.')) return t.slice(1);
  if (t.startsWith('-0.')) return '-' + t.slice(2);
  return t;
}

/**
 * Convert a double to compact string form for DOT/XDOT output.
 *
 * Rules (porting gvprintnum from lib/gvc/gvdevice.c):
 * - |n| > MAX_NEGNUM → clamped to ±MAX_NEGNUM
 * - |n| < NEAR_ZERO → "0" (suppresses -0)
 * - 3 decimal places, trailing zeros and point stripped
 * - Leading "0." collapsed to "." (e.g. 0.5 → ".5")
 *
 * Exported for json.ts (T30) and map.ts (T31).
 *
 * @see lib/gvc/gvdevice.c:gvprintnum
 */
export function printNum(n: number): string {
  if (Math.abs(n) > MAX_NEGNUM) {
    return n < 0 ? String(-MAX_NEGNUM) : String(MAX_NEGNUM);
  }
  if (Math.abs(n) < NEAR_ZERO) return '0';
  return trimAndStrip(n.toFixed(3));
}

// ---------------------------------------------------------------------------
// XDot buffer management
// ---------------------------------------------------------------------------

/**
 * Create a 12-slot xbufs array with the canonical aliasing.
 *
 * Indices 8–9 (NDraw, EDraw) alias index 1 (CDraw).
 * Indices 10–11 (NLabel, ELabel) alias index 5 (CLabel).
 *
 * @see plugin/core/gvrender_core_dot.c:xbufs
 */
export function makeXbufs(): string[][] {
  const bufs: string[][] = Array.from({ length: NUM_XBUFS + 4 }, () => []);
  bufs[EmitState.NDraw] = bufs[EmitState.CDraw]!;
  bufs[EmitState.EDraw] = bufs[EmitState.CDraw]!;
  bufs[EmitState.NLabel] = bufs[EmitState.CLabel]!;
  bufs[EmitState.ELabel] = bufs[EmitState.CLabel]!;
  return bufs;
}

// ---------------------------------------------------------------------------
// XDOT op helpers — @see plugin/core/gvrender_core_dot.c
// ---------------------------------------------------------------------------

/**
 * Format one xdot draw-op number: 2 decimals, trailing zeros and point trimmed
 * — mirroring xdot_fmt_num ("%.02f" + agxbuf_trim_zeros). Distinct from
 * `printNum` (used for the DOT `pos`/`bb`/`width`/`height` attributes), which
 * keeps more precision; xdot's DRAW ops are emitted at 2 dp by the C engine.
 * @see plugin/core/gvrender_core_dot.c:126 xdot_fmt_num
 */
export function xdotNum(v: number): string {
  // Round half-to-even like C's printf %.02f (FE_TONEAREST); JS toFixed rounds
  // half-away-from-zero, which diverges at exact .xx5 ties (2323.125 → native
  // 2323.12, not 2323.13). @see lib/gvc/gvdevice.c gvprintdouble
  let s = toFixed2HalfEven(v);
  if (s.indexOf('.') >= 0) {
    let end = s.length;
    while (end > 0 && s[end - 1] === '0') end--;
    if (s[end - 1] === '.') end--;
    s = s.slice(0, end);
  }
  return s === '-0' ? '0' : s;
}

/**
 * Format a single xdot point "x y ". xdot is y-up: `Y_invert` defaults false, so
 * `yDir(y, yOff)` returns `y` unchanged for xdot (only `-Ty` plain/dot invert).
 * The layout coordinate passes through with NO inversion — unlike the SVG path.
 * @see lib/common/output.c:36 yDir · plugin/core/gvrender_core_dot.c:132 xdot_point
 */
export function xdotPoint(p: Point): string {
  return xdotNum(p.x) + ' ' + xdotNum(p.y) + ' ';
}

/** Format N points preceded by opcode and count: "<c> <n> x0 y0 x1 y1 …". */
export function xdotPoints(c: string, pts: Point[]): string {
  let s = c + ' ' + String(pts.length) + ' ';
  for (const p of pts) s += xdotPoint(p);
  return s;
}

/**
 * UTF-8 byte length of a string — the value C's `xdot_str` writes as the length
 * prefix (`strlen(s)` over the UTF-8 bytes), NOT the JS UTF-16 code-unit count.
 * A label like `ÿ` (U+00FF) is 2 UTF-8 bytes, so its `T`/`F` op prefix is 2.
 * @see plugin/core/gvrender_core_dot.c:83 xdot_str_xbuf (`%zu`, strlen)
 */
export function utf8Len(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } // surrogate pair → 4 bytes
    else n += 3;
  }
  return n;
}

/** Clamp a normalized [0,1] float channel to a 0-255 byte (round-to-nearest). */
function chanByte(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 255);
}

/**
 * Resolve a GVColor to RGBA bytes — the value the C xdot callbacks read from
 * `job->obj->pencolor.u.rgba` (already resolved by gvrender_set_pencolor). A
 * plain `rgba` passes through; named/hex/HSV specs run through colorxlate; a
 * `none` color is fully transparent black (callers gate on PEN_NONE).
 */
export function gvColorRgba(c: GVColor): [number, number, number, number] {
  if (c.type === 'rgba') return [chanByte(c.r), chanByte(c.g), chanByte(c.b), chanByte(c.a)];
  // A `none`/transparent paint emits graphviz's "transparent" bytes (ff ff fe 00),
  // matching native's `#fffffe00` — not fully-zero black. @see colxlate.c transparent
  if (c.type === 'none') return [0xff, 0xff, 0xfe, 0x00];
  const out: GVColor = { type: 'rgba', r: 0, g: 0, b: 0, a: 0 };
  colorxlate(c.type === 'string' ? c.s : '', out, 'rgba');
  return out.type === 'rgba'
    ? [chanByte(out.r), chanByte(out.g), chanByte(out.b), chanByte(out.a)]
    : [0, 0, 0, 255];
}

/**
 * Bare xdot color body (no `c `/`C ` prefix): the CONSTANT length prefix
 * (7 for `#rrggbb`, 9 for `#rrggbbaa`) plus `-#hex`, the alpha byte present only
 * when not fully opaque. Used both by the color ops and by gradient color stops.
 * @see plugin/core/gvrender_core_dot.c:99 xdot_str_color_xbuf
 */
export function xdotColorBody(rgba: [number, number, number, number]): string {
  const hx = (n: number): string => n.toString(16).padStart(2, '0');
  const body = '#' + hx(rgba[0]) + hx(rgba[1]) + hx(rgba[2]);
  return rgba[3] === 0xff ? '7 -' + body : '9 -' + body + hx(rgba[3]);
}

/**
 * Format an xdot color op ("c "/"C ") from RGBA bytes.
 * @see plugin/core/gvrender_core_dot.c:99 xdot_str_color_xbuf
 */
export function xdotColorOp(prefix: 'c ' | 'C ', rgba: [number, number, number, number]): string {
  return prefix + xdotColorBody(rgba) + ' ';
}

/**
 * Build the linear-gradient `C len -[x0 y0 x1 y1 2 <stops>]` fill op. Endpoints
 * come from getGradientPoints (the same geometry the SVG gradient uses); stops
 * are (frac,fill)/(frac,stop) when frac>0, else (0,fill)/(1,stop). Shared by
 * node/cluster gradient fills and the graph-background gradient.
 * @see plugin/core/gvrender_core_dot.c:544-598 xdot_gradient_fillcolor
 */
export function linearGradientOp(
  pts: Point[],
  fillColor: GVColor,
  stopColor: GVColor,
  frac: number,
  angleDeg: number,
): string {
  // isRHS=true: native y-up coords, matching C's get_gradient_points(A,G,n,angle,2)
  // for the xdot device path (the SVG path uses isRHS=false + a container flip).
  const { g0, g1 } = getGradientPoints(pts, (angleDeg * Math.PI) / 180, false, true);
  const inner =
    '[' + xdotNum(g0.x) + ' ' + xdotNum(g0.y) + ' ' + xdotNum(g1.x) + ' ' + xdotNum(g1.y) +
    ' 2 ' + gradientStops(fillColor, stopColor, frac) + ']';
  return 'C ' + String(utf8Len(inner)) + ' -' + inner + ' ';
}

/** The `<frac> <colorbody>` stop pairs for a gradient (frac>0 vs the 0/1 form). */
function gradientStops(fillColor: GVColor, stopColor: GVColor, frac: number): string {
  const fill = gvColorRgba(fillColor);
  const stop = gvColorRgba(stopColor);
  const stops: Array<[number, [number, number, number, number]]> =
    frac > 0 ? [[frac, fill], [frac, stop]] : [[0, fill], [1, stop]];
  return stops.map(([f, c]) => trimFixed3(f) + ' ' + xdotColorBody(c)).join(' ');
}

/**
 * Build the radial-gradient `C len -(c1x c1y r1 c2x c2y r2 2 <stops>)` fill op.
 * Reuses getGradientPoints (radial) for the center/radii, un-negating its SVG
 * y. r1 = outerR/4, r2 = outerR; c2 is the center, c1 the center offset by r1
 * along the gradient angle (== center when angle 0).
 * @see plugin/core/gvrender_core_dot.c:562-585 xdot_gradient_fillcolor (radial)
 */
export function radialGradientOp(
  pts: Point[],
  fillColor: GVColor,
  stopColor: GVColor,
  frac: number,
  angleDeg: number,
): string {
  const rad = (angleDeg * Math.PI) / 180;
  // isRHS=true: native y-up coords, matching C's get_gradient_points(A,G,n,0,3).
  const gp = getGradientPoints(pts, rad, true, true);
  const cx = gp.g0.x;
  const cy = gp.g0.y;
  const r1 = gp.g1.x;
  const r2 = gp.g1.y;
  const c1x = angleDeg === 0 ? cx : cx + r1 * Math.cos(rad);
  const c1y = angleDeg === 0 ? cy : cy + r1 * Math.sin(rad);
  const inner =
    '(' + xdotNum(c1x) + ' ' + xdotNum(c1y) + ' ' + xdotNum(r1) + ' ' +
    xdotNum(cx) + ' ' + xdotNum(cy) + ' ' + xdotNum(r2) + ' 2 ' +
    gradientStops(fillColor, stopColor, frac) + ')';
  return 'C ' + String(utf8Len(inner)) + ' -' + inner + ' ';
}

/** Pen ("c ") color op from a resolved GVColor. */
export function xdotPenColor(c: GVColor): string {
  return xdotColorOp('c ', gvColorRgba(c));
}

/** Fill ("C ") color op from a resolved GVColor. */
export function xdotFillColor(c: GVColor): string {
  return xdotColorOp('C ', gvColorRgba(c));
}

/**
 * Build the xdot "F size len -name " font op. Mirrors xdot_textspan's `F` +
 * `xdot_str(job, "", font->name)` — the length prefix is the byte length of the
 * face name. @see plugin/core/gvrender_core_dot.c:498 xdot_textspan
 */
export function xdotFont(size: number, name: string): string {
  return 'F ' + xdotNum(size > 0 ? size : 0) + ' ' + String(utf8Len(name)) + ' -' + name + ' ';
}

/**
 * Build an xdot length-prefixed string op ("S "/"" prefix): "<pfx><len> -<s> ".
 * @see plugin/core/gvrender_core_dot.c:83 xdot_str_xbuf
 */
function xdotStrOp(prefix: string, s: string): string {
  return prefix + String(utf8Len(s)) + ' -' + s + ' ';
}

/**
 * Quote a DOT identifier unless it is a bare id or numeral, mirroring agwrite's
 * agcanonStr so the serialized graph reparses (the comparator reparses both
 * sides). Only `"` is escaped (→ `\"`); a `\` is left as-is — it is already the
 * start of a stored escape like `\n`/`\l` that agcanonStr keeps verbatim, so
 * doubling it (`\\n`) would change the name (`a\n(b\n"c")` must stay `a\n…`, not
 * `a\\n…`). Over-quoting a value native leaves bare is harmless: both parse to
 * the same name. @see lib/cgraph/write.c:_agstrcanon (escapes '"', keeps '\')
 */
export function xdotId(s: string): string {
  if (/^[A-Za-z_][A-Za-z_0-9]*$/.test(s)) return s;
  if (/^-?(\.[0-9]+|[0-9]+(\.[0-9]*)?)$/.test(s)) return s;
  return '"' + s.replace(/"/g, '\\"') + '"';
}

/**
 * Format a number as C's `%.5g` — 5 significant figures, trailing zeros and
 * point trimmed, switching to `e±NN` (min 2 exponent digits) when the exponent
 * is < -4 or ≥ 5. Native writes the DOT `pos`/`bb`/`width`/`height` attributes
 * with `%.5g` (output.c:71/294/302), so large coordinates round to 5 sig figs
 * (`2219962` → `2.2201e+06`); `printNum`'s fixed 3 dp keeps too much precision.
 *
 * Uses {@link printfSig} rather than `Number.prototype.toPrecision(5)` so
 * exact-halfway values (e.g. 1399.25) round half-to-even like C's snprintf,
 * not half-away-from-zero like `toPrecision`. @see docs proven case
 * graphs-b786 (circo): pos coordinate 1399.25 → native "1399.2", `toPrecision`
 * gave "1399.3".
 * @see lib/common/output.c:71 (agxbprint "%.5g")
 */
export function gfmt5(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  let s = printfSig(v, 5);
  const e = s.indexOf('e');
  if (e >= 0) {
    let mant = s.slice(0, e);
    if (mant.indexOf('.') >= 0) mant = mant.replace(/0+$/, '').replace(/\.$/, '');
    const ei = parseInt(s.slice(e + 1), 10);
    return mant + 'e' + (ei < 0 ? '-' : '+') + String(Math.abs(ei)).padStart(2, '0');
  }
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

/**
 * Format a number as C's `%.2f` — fixed 2 decimals, half-to-even on exact ties.
 * `attach_attrs` writes the graph-label size attributes `lwidth`/`lheight` in
 * INCHES with `%.2f`, unlike every other computed attribute (which uses `%.5g`).
 * @see lib/common/output.c:244-247 (agxbprint "%.2f", PS2INCH)
 */
function gfmt2(v: number): string {
  return printfFixed(v, 2);
}

/**
 * Format a label position as the `x,y` pair every computed `*_lp` attribute
 * uses: both coordinates at `%.5g`. C passes y through `yDir()`, which is the
 * identity unless `Y_invert` — and `Y_invert` is only set by `-Ty` (plain/dot),
 * never for xdot — so no inversion is applied here, exactly as the existing
 * `pos`/`bb` emission does.
 * @see lib/common/output.c:35 yDir · lib/common/output.c:241 (agxbprint "%.5g,%.5g")
 */
function lpStr(p: Point): string {
  return gfmt5(p.x) + ',' + gfmt5(p.y);
}

/**
 * C's `attach_attrs` edge loop skips IGNORED edges and edges with no spline
 * (`ED_spl(e) == NULL`) via `continue`, so such an edge is attached NEITHER
 * `pos` NOR any of `lp`/`xlp`/`head_lp`/`tail_lp` — even when it carries a
 * label. All five attributes therefore share this one gate.
 * @see lib/common/output.c:349-353
 */
function edgeAttrsAttached(e: Edge): boolean {
  return e.info.edge_type !== IGNORED && e.info.spl != null;
}

/**
 * Append the leaf-field rectangles of a record node, mirroring the recursion in
 * `set_record_rects`: a field with sub-fields contributes nothing itself, while
 * a LEAF field (`n_flds == 0`) contributes its box translated by the node centre
 * as `llx,lly,urx,ury` at `%.5g`. C emits each field followed by a space and
 * then pops the trailing one — joining with a single space is equivalent.
 * @see lib/common/output.c:215 set_record_rects
 */
function appendRecordRects(n: Node, f: FieldT, out: string[]): void {
  const c = n.info.coord;
  if (f.n_flds === 0) {
    out.push(
      gfmt5(f.b.ll.x + c.x) + ',' + gfmt5(f.b.ll.y + c.y) + ',' +
      gfmt5(f.b.ur.x + c.x) + ',' + gfmt5(f.b.ur.y + c.y),
    );
  }
  for (let i = 0; i < f.n_flds; i++) appendRecordRects(n, f.fld![i], out);
}

/**
 * Echo an attribute that `attach_attrs_and_arrows` did NOT overwrite.
 *
 * Every computed attribute is `agset` behind a gate (`rects` only for a
 * `record` shape; an edge's `lp` only for a routed edge that HAS a label;
 * a graph's `lp` only when `GD_label(g)` exists...). When the gate FAILS, C
 * simply does not write — so the slot keeps whatever the INPUT file parsed
 * into it, and `agwrite` (which serializes the whole attribute table, not
 * just the fields layout computed) prints that stale value verbatim. This is
 * highly visible under patchwork, which forces every shape to `box` and routes
 * no edges: on a re-fed dot output (most of the corpus) native echoes back the
 * `rects` / `lp` a *previous* dot run wrote, in that run's coordinate space.
 *
 * cgraph interns attribute strings, so a value equal to the declared (empty)
 * default is the SAME pointer as the default and write.c's
 * `data->str[sym->id] != sym->defval` test drops it — hence an empty value is
 * never printed.
 * @see lib/cgraph/write.c:427 write_nondefault_attrs · lib/common/output.c:270
 */
function echoAttr(attrs: Map<string, string>, key: string): string[] {
  const v = attrs.get(key);
  if (v === undefined || v.length === 0) return [];
  return [key + '="' + agcanonEscape(v) + '"'];
}

/** `echoAttr`'s result as a space-prefixed suffix for the string-built node block. */
function pfx(parts: string[]): string {
  return parts.length === 0 ? '' : ' ' + parts.join(' ');
}

/**
 * The `lp`/`lwidth`/`lheight` triple for a graph or cluster, in C's order.
 * `rec_attach_bb` attaches them to the root graph AND recursively to every
 * cluster, but ONLY when the graph carries a label with non-empty text
 * (`GD_label(g) && GD_label(g)->text[0]`) — an absent or empty-text label emits
 * none of the three. `lp` is the label centre in points (`%.5g`); `lwidth` and
 * `lheight` are the label's `dimen` converted to inches and written `%.2f`.
 * When the gate fails, the input's own values survive and are echoed: patchwork
 * and osage never build a cluster label object, so a re-fed dot file's cluster
 * `lp` comes straight back out.
 * @see lib/common/output.c:239-248 rec_attach_bb
 */
function graphLabelAttrs(g: Graph): string[] {
  const label = g.info.label as TextlabelT | undefined;
  if (!label || label.text.length === 0) {
    return [
      ...echoAttr(g.attrs, 'lp'),
      ...echoAttr(g.attrs, 'lwidth'),
      ...echoAttr(g.attrs, 'lheight'),
    ];
  }
  return [
    'lp="' + lpStr(label.pos) + '"',
    'lwidth=' + gfmt2(label.dimen.x / POINTS_PER_INCH),
    'lheight=' + gfmt2(label.dimen.y / POINTS_PER_INCH),
  ];
}

// ---------------------------------------------------------------------------
// DOT attribute helpers
// ---------------------------------------------------------------------------

/** Format node attributes for DOT output. */
export function formatNodeAttrs(n: Node): string {
  const info = n.info;
  const x = printNum(info.coord.x);
  const y = printNum(info.coord.y);
  const w = printNum(info.width);
  const h = printNum(info.height);
  const parts: string[] = [`pos="${x},${y}"`, `width=${w}`, `height=${h}`];
  n.attrs.forEach((v, k) => {
    if (k !== 'pos' && k !== 'width' && k !== 'height') {
      parts.push(`${k}="${v}"`);
    }
  });
  return parts.join(' ');
}

/**
 * Format edge spline points for the DOT `pos` attribute. Per bezier: the start
 * endpoint `s,sp` when `sflag` set, then the end endpoint `e,ep` when `eflag`
 * set, then `bez.size` control points — all at `%.5g`, exactly as native's
 * spline serialization. @see lib/common/output.c:357-372
 */
export function formatEdgePos(e: Edge): string {
  const spl = e.info.spl;
  if (!spl || spl.list.length === 0) return '';
  // Native's pos loop skips IGNORED edges (output.c:350) — concentrate merges
  // an edge into its opposite and marks the absorbed one IGNORED; it is still
  // drawn (has _draw_) but carries no `pos`. @see lib/common/output.c:349-353
  if (e.info.edge_type === IGNORED) return '';
  const parts: string[] = [];
  for (const bez of spl.list) {
    if (bez.sflag) parts.push('s,' + gfmt5(bez.sp.x) + ',' + gfmt5(bez.sp.y));
    if (bez.eflag) parts.push('e,' + gfmt5(bez.ep.x) + ',' + gfmt5(bez.ep.y));
    const pts = bez.list.slice(0, bez.size);
    for (const p of pts) parts.push(gfmt5(p.x) + ',' + gfmt5(p.y));
  }
  return 'pos="' + parts.join(' ') + '"';
}

/** Return the edge connector token. */
export function edgeConnector(directed: boolean): string {
  return directed ? '->' : '--';
}

/** Return true if the graph is directed or strict-directed. */
export function isDirected(g: Graph): boolean {
  return g.kind === 'directed' || g.kind === 'strict-directed';
}

// ---------------------------------------------------------------------------
// Shared graph header helper
// ---------------------------------------------------------------------------

/** Emit the opening digraph/graph line and bb attribute. */
export function dotBeginGraphHeader(g: Graph, job: RenderJob): void {
  const kw = isDirected(g) ? 'digraph' : 'graph';
  job.write(kw + ' ' + g.name + ' {\n');
  const bb = g.info.bb;
  const bbStr = printNum(bb.ll.x) + ',' + printNum(bb.ll.y) + ','
    + printNum(bb.ur.x) + ',' + printNum(bb.ur.y);
  job.write('\tgraph [bb="' + bbStr + '"];\n');
}

// ---------------------------------------------------------------------------
// DotRenderer
// ---------------------------------------------------------------------------

/**
 * DOT format renderer — writes graphviz DOT language with layout attributes.
 *
 * @see plugin/core/gvrender_core_dot.c:dot_engine
 */
export class DotRenderer implements RendererPlugin {
  readonly type = 'dot';
  /** @see plugin/core/gvplugin_core.c registration table */
  readonly quality = 0;

  beginGraph(g: Graph, job: RenderJob): void {
    dotBeginGraphHeader(g, job);
  }

  endGraph(_g: Graph, job: RenderJob): void {
    job.write('}\n');
  }

  beginNode(_n: Node, _job: RenderJob): void { /* no-op */ }

  endNode(n: Node, job: RenderJob): void {
    const attrs = formatNodeAttrs(n);
    job.write('\t' + n.name + ' [' + attrs + '];\n');
  }

  beginEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }

  endEdge(e: Edge, job: RenderJob): void {
    const directed = isDirected(e.tail.root);
    const conn = edgeConnector(directed);
    const posAttr = formatEdgePos(e);
    const attrList = posAttr ? ' [' + posAttr + ']' : '';
    job.write('\t' + e.tail.name + ' ' + conn + ' ' + e.head.name + attrList + ';\n');
  }

  textspan(_pos: Point, _span: TextSpan, _job: RenderJob): void { /* no-op */ }
  ellipse(_c: Point, _rx: number, _ry: number, _f: boolean, _j: RenderJob): void { /* no-op */ }
  polygon(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  bezier(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  polyline(_pts: Point[], _job: RenderJob): void { /* no-op */ }
}

// ---------------------------------------------------------------------------
// XdotRenderer
// ---------------------------------------------------------------------------

/** Accumulated xdot draw strings for one model object (agset side-table). */
export interface XdotDraws {
  draw?: string;
  ldraw?: string;
  hdraw?: string;
  tdraw?: string;
  hldraw?: string;
  tldraw?: string;
}

/** Mutable state threaded through the recursive agwrite serializer. */
interface SerCtx {
  out: string[];
  /** subgraph → preorder number (write.c:subgdfs). */
  preorder: Map<Graph, number>;
  /** node → preorder of the subgraph it was last written in (node_last_written). */
  nodeLW: Map<Node, number>;
  /** edge → preorder of the subgraph it was last written in (edge_last_written). */
  edgeLW: Map<Edge, number>;
  /** objects whose attributes have already been emitted (AGATTRWF/attrs_written). */
  attrsWritten: Set<Node | Edge>;
  /** current indentation depth. */
  level: number;
}

/**
 * Escape backslashes in a LABEL draw string — C's put_escaping_backslashes,
 * applied to the `_ldraw_`/`_hldraw_`/`_tldraw_` buffers (not the shape draws)
 * before agset. A literal `\` in a label's text (e.g. `WXYZ\nabc`) becomes `\\`
 * so it survives the DOT string round-trip; the T-op byte-length prefix stays on
 * the UNescaped text. @see plugin/core/gvrender_core_dot.c:218 put_escaping_backslashes
 */
function escBackslash(s: string): string {
  return s.replace(/\\/g, '\\\\');
}

/** True if s[i..] starts an escape sequence agcanonStr keeps verbatim: a `\`
 *  followed by one of E G H L N T l n r \ ". @see lib/cgraph/write.c:is_escape */
function isEscapeSeq(s: string, i: number): boolean {
  if (s[i] !== '\\') return false;
  const n = s[i + 1];
  return n === 'E' || n === 'G' || n === 'H' || n === 'L' || n === 'N' || n === 'T'
    || n === 'l' || n === 'n' || n === 'r' || n === '\\' || n === '"';
}

/**
 * Escape a value for a DOT attribute exactly as agwrite's agcanonStr does: a `"`
 * becomes `\"` ONLY when it is not already part of an escape sequence, so an
 * existing `\"` or `\\` in the value is passed through verbatim rather than
 * double-escaped. For an already-backslash-doubled value (node/edge/graph labels,
 * post put_escaping_backslashes) this is identical to a naive `"`→`\"` — every
 * `"` follows a doubled `\\`, so none are ever part_of_escape. For raw cluster
 * labels (agset, no put_escaping) it preserves the source `\"`/`\\` unchanged.
 * @see lib/cgraph/write.c:_agstrcanon (135-167)
 */
function agcanonEscape(s: string): string {
  let out = '';
  let partOfEscape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '"' && !partOfEscape) {
      out += '\\';
    } else if (!partOfEscape && isEscapeSeq(s, i)) {
      partOfEscape = true;
    } else {
      partOfEscape = false;
    }
    out += c;
  }
  return out;
}

/** Trim a "%.3f" fixed string like C's agxbuf_trim_zeros (trailing 0s + dot). */
function trimFixed3(v: number): string {
  let s = v.toFixed(3);
  if (s.indexOf('.') < 0) return s;
  let end = s.length;
  while (end > 0 && s[end - 1] === '0') end--;
  if (s[end - 1] === '.') end--;
  return s.slice(0, end);
}

/**
 * XDOT format renderer — mirrors plugin/core/gvrender_core_dot.c's xdot engine.
 *
 * Draw ops accumulate in per-emit-state xbufs during the shared emit pass; at
 * the end of each object they are attached as `_draw_`/`_ldraw_`/`_hdraw_`/
 * `_tdraw_` strings (a side-table here, `agset` in C), and the whole graph is
 * serialized at `endGraph` — the model-attribute + agwrite-at-end model that
 * lets the graph-level `_draw_` (canvas background, cluster boxes) precede `bb`
 * even though it is only known after the body has been drawn.
 *
 * xdot is y-up (no coordinate inversion); colors come from the resolved
 * graphics state (`job.obj.penColor`/`fillColor`), not hardcoded black.
 *
 * @see plugin/core/gvrender_core_dot.c xdot_begin_graph / xdot_end_graph
 */
export class XdotRenderer implements RendererPlugin {
  readonly type = 'xdot';
  /** @see plugin/core/gvplugin_core.c registration table */
  readonly quality = 0;

  /** Per-render draw buffers. Indices 8/9 alias 1; 10/11 alias 5. */
  private bufs: string[][] = makeXbufs();
  /** setlinewidth state per emit_state. @see gvrender_core_dot.c penwidth[] */
  private penwidth: number[] = new Array(12).fill(1);
  /** text-flag state per emit_state. @see gvrender_core_dot.c textflags[] */
  private textflags: number[] = new Array(12).fill(0);
  /** Accumulated draw strings keyed by model object (C: agset on the object). */
  private draws = new Map<Node | Edge | Graph, XdotDraws>();
  /** Clusters in render order — the graphs `endCluster` was actually called for
   *  (from `renderClusters`/`GD_clust`), which is NOT always reachable via
   *  `g.subgraphs`, so it is tracked here rather than re-walked. */
  private clusters: Graph[] = [];
  /** edge_in_box gate for the current edge: emit_edge draws nothing (spline OR
   *  label) for an edge whose content is outside job->clip. Mirrors svg.ts's
   *  edgeGroupOpen. @see lib/common/emit.c:emit_edge (3039) */
  private edgeDrawable = true;

  beginGraph(g: Graph, _job: RenderJob): void {
    this.bufs = makeXbufs();
    this.penwidth = new Array(12).fill(1);
    this.textflags = new Array(12).fill(0);
    this.draws = new Map();
    this.clusters = [];
  }

  /** The per-object draw strings accumulated during the last render, keyed by
   *  the ORIGINAL model object. These are the pre-serialization values C's
   *  `-Tjson` reads directly (via agxget) — feeding them to parseXDot avoids the
   *  DOT-text round-trip, which cannot represent draw text containing `"` and so
   *  drops a preceding backslash (a cluster label's `\"` → `"`, id 2239). */
  drawStringsByObject(): ReadonlyMap<Node | Edge | Graph, XdotDraws> {
    return this.draws;
  }

  endGraph(g: Graph, job: RenderJob): void {
    // Flush the graph-level GDRAW/GLABEL buffers (canvas background + graph
    // label) onto the root graph, then serialize the whole graph.
    // @see gvrender_core_dot.c:427 xdot_end_graph
    const gd = this.flush(EmitState.GDraw);
    const gl = this.flush(EmitState.GLabel);
    if (gd || gl) {
      const set = this.drawsFor(g);
      if (gd) set.draw = gd;
      if (gl) set.ldraw = escBackslash(gl);
    }
    job.write(this.serialize(g));
  }

  /** Emit the canvas background polygon into the GDRAW buffer.
   *  @see lib/common/emit.c:1476 emit_background */
  pageBackground(g: Graph, job: RenderJob): void {
    const bg = g.attrs.get('bgcolor');
    let fillSpec = bg !== undefined && bg !== '' ? bg : 'white';
    // The xdot device is not GVDEVICE_DOES_TRUECOLOR, so emit_background maps an
    // explicit `bgcolor=transparent` to white (a filled white canvas), unlike a
    // truecolor device that paints nothing. @see lib/common/emit.c:1490
    if (fillSpec === 'transparent') fillSpec = 'white';
    // The canvas fill covers job->clip = gvc->bb ± job->pad. The dot/xdot device
    // default pad is 0 (SVG's is 4), so only an explicit `pad` attr expands the
    // background box (e.g. pad=2.0 → ±144). @see gvrender_core_dot.c:739
    // (render_features_dot default_pad 0) · emit.c:3367 (job->bb = bb ± pad)
    const padAttr = g.attrs.get('pad');
    const pad = padAttr !== undefined && padAttr !== '' ? parseGraphPad(padAttr) : { x: 0, y: 0 };
    const bb = job.bb;
    const corners: Point[] = [
      { x: bb.ll.x - pad.x, y: bb.ll.y - pad.y },
      { x: bb.ll.x - pad.x, y: bb.ur.y + pad.y },
      { x: bb.ur.x + pad.x, y: bb.ur.y + pad.y },
      { x: bb.ur.x + pad.x, y: bb.ll.y - pad.y },
    ];
    const buf = this.bufs[EmitState.GDraw]!;
    buf.push(xdotPenColor(resolveRenderColor('transparent')));
    // A two-color bgcolor is a gradient (emit_background → findStopColor); a
    // linear one emits the bracketed fill, a radial one is deferred to the base.
    const stop = fillSpec.includes(':') ? findStopColor(fillSpec) : null;
    if (stop !== null) {
      const angle = Number(g.attrs.get('gradientangle') ?? 0) || 0;
      const radial = parseStyleFlags(g.attrs.get('style')).radial;
      const op = radial ? radialGradientOp : linearGradientOp;
      buf.push(
        op(corners, resolveRenderColor(stop.fillColor), resolveRenderColor(stop.stopColor), stop.frac, angle),
      );
    } else {
      buf.push(xdotFillColor(resolveRenderColor(fillSpec)));
    }
    buf.push(xdotPoints('P', corners));
  }

  beginNode(_n: Node, _job: RenderJob): void { /* no-op */ }

  endNode(n: Node, _job: RenderJob): void {
    const draw = this.flush(EmitState.NDraw);
    const ldraw = this.flush(EmitState.NLabel);
    if (draw || ldraw) {
      const set = this.drawsFor(n);
      if (draw) set.draw = draw;
      if (ldraw) set.ldraw = escBackslash(ldraw);
    }
    this.resetState(EmitState.NDraw, EmitState.NLabel);
  }

  /**
   * Emit the edge spline beziers (EDRAW) and arrowhead ops (TDRAW/HDRAW),
   * reading the already-routed geometry from `e.info`. Mirrors
   * emit_edge_graphics: each bezier under the edge pen, then tail/head arrows
   * under the default solid line style. The port draws SVG edges directly in
   * svg.ts (not via shared bezier/polygon callbacks), so the xdot edge draw is
   * self-contained here — the same per-renderer split the port already uses.
   * @see lib/common/emit.c:emit_edge_graphics
   */
  beginEdge(e: Edge, job: RenderJob): void {
    // emit_edge gates ALL edge drawing (spline + labels) on edge_in_box: an edge
    // whose only content is a label placed outside job->clip draws nothing. The
    // SVG renderer applies the same gate via edgeGroupOpen; the xdot renderer
    // must too, else concentrate-merged edges (no spline, stale off-box label
    // position) emit a spurious _ldraw_. @see lib/common/emit.c:emit_edge (3039)
    this.edgeDrawable = edgeHasDrawableContent(e, job.bb);
    const spl = e.info.spl;
    if (!this.edgeDrawable || spl === undefined) return;
    const edraw = this.bufs[EmitState.EDraw]!;
    const colorAttr = e.attrs.get('color') ?? '';
    const numc = (colorAttr.match(/:/g) ?? []).length;
    const numsemi = (colorAttr.match(/;/g) ?? []).length;
    // Tapered edge (style=tapered) → the first bezier as a filled taper polygon
    // with transparent pen + edge-color fill; else plain `:` multicolor → N
    // parallel offset beziers; else the single-color spline. @see emit.c:2422/2443
    // Split-multicolor arrow colors: tail = first color, head = end color
    // (inverse of the parallel branch). Undefined for all other edge kinds.
    // @see lib/common/emit.c:2400 (multicolor arrow rule)
    let tailArrowColor: string | undefined;
    let headArrowColor: string | undefined;
    if (numsemi > 0 && numc > 0) {
      // Split-along-length `;` multicolor (e.g. `red;0.5:blue`): one bezier per
      // color segment, split along the spline's arc length. Takes precedence
      // over tapered / `:` parallel, matching C's `if (numsemi && numc)` order.
      // @see lib/common/emit.c:2389 multicolor
      const c = this.emitSplitSpline(spl.list as (Bezier | undefined)[], colorAttr, edraw, job);
      tailArrowColor = c.firstColor;
      headArrowColor = c.endColor;
    } else if (edgeIsTapered(e)) {
      this.emitTaperedSpline(e, spl.list[0], edraw, job);
    } else if (numc > 0) {
      this.emitParallelSpline(spl.list as (Bezier | undefined)[], colorAttr, numc, edraw, job);
    } else {
      // splines=ortho + radius/style=rounded → straight segments + corner arcs
      // as polylines (L), else the single bezier. @see emit.c:2583 / svg-helpers
      const radius = orthoRoundedRadius(e, job);
      const obj = job.obj;
      const origStyle = obj !== null ? [...obj.rawStyle] : [];
      const multi = spl.list.length > 1;
      for (const bez of spl.list) {
        const pts = bez.list.slice(0, bez.size);
        const polys = radius !== null && bez.size >= 4 ? orthoRoundedPolylines(pts, radius) : [];
        if (polys.length > 0) {
          for (const poly of polys) edraw.push(this.styleOp(job), this.penOp(job), xdotPoints('L', poly));
        } else {
          edraw.push(this.styleOp(job), this.penOp(job), xdotPoints('B', pts));
        }
        // arrow_gen (drawn to TDRAW/HDRAW below) resets the job style to
        // defaultlinestyle ("solid") as a side effect. For a multi-bezier spline
        // the NEXT segment's xdot_style re-emits the current rawstyle every call,
        // so a solid edge picks up a bare `S 5 -solid`; C restores the edge's own
        // styles afterward only when it has explicit ones. @see emit.c:2668-2677
        if (obj !== null && multi && (bez.sflag || bez.eflag)) {
          obj.rawStyle = origStyle.length > 0 ? origStyle : ['solid'];
        }
      }
      if (obj !== null) obj.rawStyle = origStyle;
    }
    // Arrows: y-up ops already computed for the shared render path. C sets the
    // default line style ("solid") + penwidth before each arrow primitive.
    this.emitArrows(this.bufs[EmitState.TDraw]!, e.info.tailArrowOps, job, EmitState.TDraw, tailArrowColor);
    this.emitArrows(this.bufs[EmitState.HDraw]!, e.info.headArrowOps, job, EmitState.HDraw, headArrowColor);
  }

  /**
   * Emit a tapered edge's first bezier as a filled taper polygon: `S <n>
   * -tapered` (the style), a transparent pen, the edge-color fill, then the
   * polygon vertices from `taper()` (y-up). @see lib/common/emit.c:2422
   */
  private emitTaperedSpline(e: Edge, bz: Bezier | undefined, edraw: string[], job: RenderJob): void {
    if (bz === undefined) return;
    const radfunc = taperfun(e.attrs.get('dir'), isDirected(e.tail.root));
    const verts = taper(bz, radfunc, job.obj?.penWidth ?? 1);
    const edgeColor = job.obj?.penColor ?? { type: 'string', s: 'black' };
    edraw.push(this.styleOp(job));
    edraw.push(xdotPenColor(resolveRenderColor('transparent')));
    edraw.push(xdotFillColor(edgeColor));
    edraw.push(xdotPoints('P', verts));
  }

  /**
   * Emit a split-along-length `;` multicolor edge spline: split each routed
   * bezier along its arc length into one sub-curve per color segment, drawn
   * under that segment's pen. Reuses the same split geometry
   * (splitSplineByColor) as the SVG path. @see lib/common/emit.c:1975 multicolor
   */
  private emitSplitSpline(
    bzList: (Bezier | undefined)[],
    colorAttr: string,
    edraw: string[],
    job: RenderJob,
  ): { firstColor: string; endColor: string } {
    const segs = parseSegs(colorAttr).segs;
    const firstColor = segs[0]?.color ?? 'black';
    let endColor = firstColor;
    for (const bz of bzList) {
      if (bz === undefined || bz.size < 4) continue;
      const split = splitSplineByColor(bz.list.slice(0, bz.size), segs);
      endColor = split.endColor;
      for (const c of split.curves) {
        edraw.push(this.styleOp(job), xdotPenColor(resolveRenderColor(c.color)), xdotPoints('B', c.points));
      }
    }
    return { firstColor, endColor };
  }

  /**
   * Emit the parallel-multicolor edge spline: one offset Bézier per color,
   * offset SEP=2.0 perpendicular per pass — reusing the same offset geometry
   * (buildOffsetLists/advanceTmpList) as the SVG parallel-edge path.
   * @see lib/common/emit.c:2443 (parallel multicolor) / svg-parallel-edge.ts
   */
  private emitParallelSpline(
    bzList: (Bezier | undefined)[],
    colorAttr: string,
    numc: number,
    edraw: string[],
    job: RenderJob,
  ): void {
    const segData = bzList.map((bz) =>
      bz !== undefined && bz.size >= 4
        ? buildOffsetLists(bz.list, (2 + numc) / 2)
        : { offlist: [] as Point[], tmplist: [] as Point[] },
    );
    const colors = parseSegs(colorAttr).segs.map((s) => s.color ?? 'black');
    for (const color of colors) {
      const pen = xdotPenColor(resolveRenderColor(color));
      for (const sd of segData) {
        if (sd.offlist.length === 0) continue;
        advanceTmpList(sd.tmplist, sd.offlist);
        edraw.push(this.styleOp(job), pen, xdotPoints('B', sd.tmplist));
      }
    }
  }

  /** Emit one arrow's primitive ops into `buf` (pen/fill from the edge color).
   *  arrow_gen sets the default line style ("solid") and the edge penwidth
   *  before each primitive, so a non-default penwidth emits `S setlinewidth(N)`
   *  once (tracked per HDRAW/TDRAW state). @see arrows.c:arrow_gen */
  private emitArrows(
    buf: string[], ops: ArrowDrawOp[] | undefined, job: RenderJob, state: EmitState,
    penOverride?: string,
  ): void {
    if (ops === undefined) return;
    const pen = penOverride !== undefined
      ? resolveRenderColor(penOverride)
      : job.obj?.penColor ?? { type: 'string', s: 'black' };
    const pw = job.obj?.penWidth ?? 1;
    for (const op of ops) {
      if (Math.abs(pw - this.penwidth[state]!) >= 0.0005) {
        this.penwidth[state] = pw;
        buf.push(xdotStrOp('S ', 'setlinewidth(' + trimFixed3(pw) + ')'));
      }
      buf.push(xdotStrOp('S ', 'solid'));
      buf.push(xdotPenColor(pen));
      switch (op.kind) {
        case 'polygon':
          if (op.filled) buf.push(xdotFillColor(pen));
          buf.push(xdotPoints(op.filled ? 'P' : 'p', op.points));
          break;
        case 'ellipse':
          if (op.filled) buf.push(xdotFillColor(pen));
          buf.push(
            (op.filled ? 'E ' : 'e ') + xdotPoint(op.center) +
              xdotNum(op.rx) + ' ' + xdotNum(op.ry) + ' ',
          );
          break;
        case 'polyline':
          buf.push(xdotPoints('L', op.points));
          break;
        case 'bezier':
          buf.push(xdotPoints('B', op.points));
          break;
      }
    }
  }

  endEdge(e: Edge, job: RenderJob): void {
    // edge_in_box gate (set in beginEdge): a content-less / off-box edge draws
    // nothing, matching native's emit_edge early return. @see emit.c:emit_edge
    if (!this.edgeDrawable) {
      this.resetState(EmitState.EDraw, EmitState.ELabel);
      this.resetState(EmitState.HDraw, EmitState.TDraw);
      this.penwidth[EmitState.HLabel] = 1;
      this.penwidth[EmitState.TLabel] = 1;
      return;
    }
    // Emit the edge's labels (center/xlabel/head/tail) — the port draws these
    // in svg.ts endEdge, not the shared path, so the xdot renderer runs them
    // itself, mirroring emit_edge's emit_edge_label. gvrenderTextspan routes
    // each span to the edge's ELABEL buffer → _ldraw_. @see emit.c:3010
    renderEdgeLabels(e, this, job);
    const draw = this.flush(EmitState.EDraw);
    const hdraw = this.flush(EmitState.HDraw);
    const tdraw = this.flush(EmitState.TDraw);
    const ldraw = this.flush(EmitState.ELabel);
    const hldraw = this.flush(EmitState.HLabel);
    const tldraw = this.flush(EmitState.TLabel);
    if (draw || hdraw || tdraw || ldraw || hldraw || tldraw) {
      const set = this.drawsFor(e);
      if (draw) set.draw = draw;
      if (hdraw) set.hdraw = hdraw;
      if (tdraw) set.tdraw = tdraw;
      if (ldraw) set.ldraw = escBackslash(ldraw);
      if (hldraw) set.hldraw = escBackslash(hldraw);
      if (tldraw) set.tldraw = escBackslash(tldraw);
    }
    this.resetState(EmitState.EDraw, EmitState.ELabel);
    this.resetState(EmitState.HDraw, EmitState.TDraw);
    this.penwidth[EmitState.HLabel] = 1;
    this.penwidth[EmitState.TLabel] = 1;
    this.textflags[EmitState.HLabel] = 0;
    this.textflags[EmitState.TLabel] = 0;
  }

  beginCluster(_sg: Graph, _job: RenderJob): void { /* no-op */ }

  endCluster(sg: Graph, _job: RenderJob): void {
        const draw = this.flush(EmitState.CDraw);
    const ldraw = this.flush(EmitState.CLabel);
    if (draw || ldraw) {
      const set = this.drawsFor(sg);
      if (draw) set.draw = draw;
      // Cluster labels are stored via plain agxset (xdot_end_cluster:286), NOT
      // put_escaping_backslashes like node/edge/graph labels — so NO escBackslash.
      // The source `\"`/`\\` in the label survive as-is through agcanonEscape on
      // serialize (drawAttr). @see gvrender_core_dot.c:286
      if (ldraw) set.ldraw = ldraw;
    }
    this.clusters.push(sg);
    this.resetState(EmitState.CDraw, EmitState.CLabel);
  }

  textspan(pos: Point, span: TextSpan, job: RenderJob): void {
    const buf = this.getBuf(job);
    const st = job.obj !== null ? job.obj.emitState : EmitState.GDraw;
    const j = span.just === 'l' ? -1 : span.just === 'r' ? 1 : 0;
    const p = { x: pos.x, y: pos.y + span.yoffset_centerline };
    buf.push(xdotFont(span.fontSize, span.fontName ?? ''));
    buf.push(xdotPenColor(resolveRenderColor(span.fontColor ?? 'black')));
    // Text flags (xdot version >= 15): emit `t <bits>` only when they change.
    // @see gvrender_core_dot.c:520 xdot_textspan
    const bits = (span.fontFlags ?? 0) & 0x7f;
    if (this.textflags[st] !== bits) {
      buf.push('t ' + String(bits) + ' ');
      this.textflags[st] = bits;
    }
    buf.push(
      'T ' + xdotPoint(p) + String(j) + ' ' + xdotNum(span.size.x) + ' ' +
        String(utf8Len(span.str)) + ' -' + span.str + ' ',
    );
  }

  ellipse(center: Point, rx: number, ry: number, filled: boolean, job: RenderJob): void {
    const buf = this.getBuf(job);
    buf.push(this.styleOp(job), this.penOp(job));
    // C passes A=[center, corner] to the gradient; corner = center + (rx,ry).
    if (filled) buf.push(this.fillOp(job, [center, { x: center.x + rx, y: center.y + ry }]));
    buf.push(filled ? 'E ' : 'e ', xdotPoint(center), xdotNum(rx) + ' ' + xdotNum(ry) + ' ');
  }

  polygon(pts: Point[], filled: boolean, job: RenderJob): void {
    const buf = this.getBuf(job);
    buf.push(this.styleOp(job), this.penOp(job));
    if (filled) buf.push(this.fillOp(job, pts));
    buf.push(xdotPoints(filled ? 'P' : 'p', pts));
  }

  bezier(pts: Point[], filled: boolean, job: RenderJob): void {
    const buf = this.getBuf(job);
    buf.push(this.styleOp(job), this.penOp(job));
    if (filled) buf.push(this.fillOp(job, pts));
    // NB 'b'/'B' are reversed vs the other ops. @see gvrender_core_dot.c:632
    buf.push(xdotPoints(filled ? 'b' : 'B', pts));
  }

  polyline(pts: Point[], job: RenderJob): void {
    const buf = this.getBuf(job);
    buf.push(this.styleOp(job), this.penOp(job), xdotPoints('L', pts));
  }

  // --- graphics-state ops ------------------------------------------------

  /** Pen color op from the resolved graphics state (default black). */
  private penOp(job: RenderJob): string {
    return xdotPenColor(job.obj?.penColor ?? { type: 'string', s: 'black' });
  }

  /**
   * Fill op from the resolved graphics state. A linear gradient emits the
   * bracketed `C len -[G0 G1 2 <stops>]` form (xdot_gradient_fillcolor); a plain
   * fill emits `C len -#hex`. `pts` are the shape points the gradient endpoints
   * derive from. Radial gradients are deferred (emit the base fill).
   * @see plugin/core/gvrender_core_dot.c:544 xdot_gradient_fillcolor
   */
  private fillOp(job: RenderJob, pts: Point[]): string {
    const obj = job.obj;
    if (obj && obj.fill === FillType.Linear) {
      return linearGradientOp(pts, obj.fillColor, obj.stopColor, obj.gradientFrac, obj.gradientAngle);
    }
    if (obj && obj.fill === FillType.Radial) {
      return radialGradientOp(pts, obj.fillColor, obj.stopColor, obj.gradientFrac, obj.gradientAngle);
    }
    return xdotFillColor(obj?.fillColor ?? { type: 'string', s: 'black' });
  }

  /** Style ops (`S`): setlinewidth on a penwidth change, plus dash/dot pen.
   *  @see gvrender_core_dot.c:161 xdot_style */
  private styleOp(job: RenderJob): string {
    const obj = job.obj;
    if (obj === null) return '';
    let s = '';
    const st = obj.emitState;
    if (Math.abs(obj.penWidth - this.penwidth[st]!) >= 0.0005) {
      this.penwidth[st] = obj.penWidth;
      s += xdotStrOp('S ', 'setlinewidth(' + trimFixed3(obj.penWidth) + ')');
    }
    // Named styles carried in obj.rawStyle (the parsed style tokens, e.g. an
    // explicit `style="solid"`/`"dashed"`) emit an `S` op — but only the LINE
    // styles. xdot_style filters filled/bold/setlinewidth; the polygon/fill
    // styles (rounded/diagonals/striped/wedged/invis/radial/tapered) are
    // consumed by the shape/fill code before gvrender_set_style, so native
    // never emits them as `S` ops either. @see gvrender_core_dot.c:184
    if (obj.rawStyle.length > 0) {
      for (const p of obj.rawStyle) {
        if (NON_LINE_STYLES.has(p) || p.startsWith('setlinewidth')) continue;
        s += xdotStrOp('S ', p);
      }
    } else {
      // Fallback for paths that set only a PenType (no rawStyle): reconstruct
      // the dash/dot token C would emit from the pen.
      if (obj.pen === PenType.Dashed) s += xdotStrOp('S ', 'dashed');
      else if (obj.pen === PenType.Dotted) s += xdotStrOp('S ', 'dotted');
    }
    return s;
  }

  // --- buffer + side-table plumbing --------------------------------------

  /** Active xdot buffer for the current emit state. */
  private getBuf(job: RenderJob): string[] {
    const obj = job.obj;
    return this.bufs[obj !== null ? obj.emitState : EmitState.GDraw]!;
  }

  /** Join and clear the buffer for `state`; returns '' when empty. */
  private flush(state: EmitState): string {
    const buf = this.bufs[state]!;
    const s = buf.join('');
    buf.length = 0;
    return s;
  }

  /** Reset per-emit-state penwidth/textflags after an object (C's reset). */
  private resetState(draw: EmitState, label: EmitState): void {
    this.penwidth[draw] = 1;
    this.penwidth[label] = 1;
    this.textflags[draw] = 0;
    this.textflags[label] = 0;
  }

  private drawsFor(o: Node | Edge | Graph): XdotDraws {
    let d = this.draws.get(o);
    if (d === undefined) {
      d = {};
      this.draws.set(o, d);
    }
    return d;
  }

  // --- serialization (agwrite-at-end) ------------------------------------

  /**
   * Emit `key="value"`, escaping the value the way agwrite's agcanonStr does: a
   * `"` becomes `\"` unless it is already part of an escape sequence (see
   * agcanonEscape). A draw string carries label text that may contain a bare `"`
   * (would close the attribute early) or a source `\"`/`\\` (must not be
   * double-escaped). The byte-length prefix stays on the UNescaped text (the
   * parser un-escapes before parseXDot re-reads it), matching native exactly.
   * @see lib/cgraph/write.c:_agstrcanon (135-167)
   */
  private drawAttr(key: string, value: string): string {
    return key + '="' + agcanonEscape(value) + '"';
  }

  /** `llx,lly,urx,ury` from a graph's layout bb. */
  private bbStr(g: Graph): string {
    const bb = g.info.bb;
    return gfmt5(bb.ll.x) + ',' + gfmt5(bb.ll.y) + ',' +
      gfmt5(bb.ur.x) + ',' + gfmt5(bb.ur.y);
  }

  /**
   * Serialize the whole laid-out graph to xdot DOT text — a faithful port of
   * cgraph's agwrite (lib/cgraph/write.c). Recurses the subgraph tree
   * (write_subgs/write_body), scoping each node/edge to the subgraph(s) it
   * belongs to via preorder numbers (write_node_test/write_edge_test), and
   * re-emits an object bare (no attrs) on any scope after the first
   * (attrs_written). This reproduces native's per-subgraph edge re-declarations
   * — e.g. an edge in a rank=same subgraph is drawn once, then re-declared bare.
   * @see lib/cgraph/write.c:agwrite
   */
  private serialize(g: Graph): string {
    const ctx: SerCtx = {
      out: [],
      preorder: new Map<Graph, number>(),
      nodeLW: new Map<Node, number>(),
      edgeLW: new Map<Edge, number>(),
      attrsWritten: new Set<Node | Edge>(),
      level: 0,
    };
    this.subgdfs(g, 1, ctx.preorder);
    this.writeHdr(g, true, ctx);
    this.writeBody(g, ctx);
    this.writeTrl(ctx);
    return ctx.out.join('');
  }

  /** Preorder-number the subgraph tree. @see write.c:subgdfs */
  private subgdfs(g: Graph, ix: number, preorder: Map<Graph, number>): number {
    let ix0 = ix;
    preorder.set(g, ix0);
    for (const sub of g.subgraphs.values()) ix0 = this.subgdfs(sub, ix0, preorder);
    return ix0 + 1;
  }

  /** A subgraph is anonymous when its name is empty or a `%N` local name. */
  private isAnonymous(g: Graph): boolean {
    return g.name.length === 0 || g.name.charCodeAt(0) === 0x25 /* % */;
  }

  /** A graph carries a `bb` attribute when it is the root or has a layout bb
   *  (clusters, and any subgraph output.c computed a box for). Native seeds `bb`
   *  on every graph via safe_dcl, so the value differs (set vs empty "") between
   *  a boxed graph and an unboxed child — the driver that makes an anon subgraph
   *  under the root or a cluster "relevant". @see lib/common/output.c:safe_dcl */
  private hasBb(g: Graph): boolean {
    return g === g.root || this.clusters.includes(g);
  }

  /** Anonymous subgraph with no own node/edge defaults and no graph attrs
   *  differing from its parent → inlined into the parent. Native compares every
   *  graph attr over the root attr dict; the load-bearing ones are `bb` (set on
   *  the parent, empty on the child) and `rank`. @see write.c:irrelevant_subgraph */
  private irrelevantSubgraph(g: Graph): boolean {
    if (!this.isAnonymous(g)) return false;
    if (this.clusters.includes(g)) return false;
    if (g.nodeDefaults.size > 0 || g.edgeDefaults.size > 0) return false;
    if (g.parent) {
      if (this.hasBb(g) !== this.hasBb(g.parent)) return false;
      for (const [k, v] of g.attrs) {
        if (g.parent.attrs.get(k) !== v) return false;
      }
    } else if (g.attrs.size > 0) {
      return false;
    }
    return true;
  }

  /** Non-draw graph attrs a subgraph emits (rank for rank=same; clusters use
   *  clusterAttrs). Only comparator-relevant fields need be exact.
   *
   *  `rec_attach_bb` walks the ROOT and then `GD_clust` recursively, so a
   *  subgraph the layout did not box is attached NEITHER `bb` NOR the label
   *  triple — both keep the INPUT's values, which agwrite echoes. circo and
   *  twopi lay out no clusters at all (`GD_clust` empty — mirrored here by
   *  `this.clusters`, filled from endCluster), so on a re-fed dot output their
   *  `cluster0` comes back carrying the *previous* run's `bb` and `lp`.
   *  @see lib/common/output.c:249 rec_attach_bb */
  private subgGraphAttrs(sg: Graph): string {
    if (this.clusters.includes(sg)) return this.clusterAttrs(sg);
    const parts: string[] = [];
    const rank = sg.attrs.get('rank');
    if (rank !== undefined) parts.push('rank=' + xdotId(rank));
    parts.push(...echoAttr(sg.attrs, 'bb'));
    parts.push(...graphLabelAttrs(sg));
    return parts.join(' ');
  }

  private indent(ctx: SerCtx): string {
    return '\t'.repeat(ctx.level);
  }

  /** @see write.c:write_hdr */
  private writeHdr(g: Graph, top: boolean, ctx: SerCtx): void {
    if (top) {
      const strict = g.kind === 'strict-directed' || g.kind === 'strict-undirected' ? 'strict ' : '';
      const kw = isDirected(g) ? 'digraph' : 'graph';
      const nm = g.name.length > 0 && !this.isAnonymous(g) ? xdotId(g.name) + ' ' : '';
      ctx.out.push(strict + kw + ' ' + nm + '{\n');
      ctx.level++;
      ctx.out.push(this.indent(ctx) + 'graph [' + this.graphAttrs(g) + '];\n');
      ctx.out.push(this.indent(ctx) + 'node [label="\\N"];\n');
    } else {
      const nm = this.isAnonymous(g) ? '' : 'subgraph ' + xdotId(g.name) + ' ';
      ctx.out.push(this.indent(ctx) + nm + '{\n');
      ctx.level++;
      const ga = this.subgGraphAttrs(g);
      if (ga) ctx.out.push(this.indent(ctx) + 'graph [' + ga + '];\n');
    }
  }

  /** @see write.c:write_trl */
  private writeTrl(ctx: SerCtx): void {
    ctx.level--;
    ctx.out.push(this.indent(ctx) + '}\n');
  }

  /** @see write.c:write_subgs */
  private writeSubgs(g: Graph, ctx: SerCtx): void {
    for (const sub of g.subgraphs.values()) {
      if (this.irrelevantSubgraph(sub)) {
        this.writeSubgs(sub, ctx);
      } else {
        this.writeHdr(sub, false, ctx);
        this.writeBody(sub, ctx);
        this.writeTrl(ctx);
      }
    }
  }

  /** @see write.c:write_body — subgraphs, then this scope's nodes and edges. */
  private writeBody(g: Graph, ctx: SerCtx): void {
    this.writeSubgs(g, ctx);
    for (const n of g.nodes.values()) {
      if (this.writeNodeTest(g, n, ctx)) this.writeNode(g, n, ctx);
      let prev: Node = n;
      for (const e of n.outEdges(g)) {
        if (prev !== e.head && this.writeNodeTest(g, e.head, ctx)) {
          this.writeNode(g, e.head, ctx);
          prev = e.head;
        }
        if (this.writeEdgeTest(g, e, ctx)) this.writeEdge(g, e, ctx);
      }
    }
  }

  /** @see write.c:write_node_test — every xdot node carries pos/size, so it is
   *  never "default"; write it in the first scope that has not yet emitted it. */
  private writeNodeTest(g: Graph, n: Node, ctx: SerCtx): boolean {
    return (ctx.nodeLW.get(n) ?? 0) < ctx.preorder.get(g)!;
  }

  /** @see write.c:write_edge_test */
  private writeEdgeTest(g: Graph, e: Edge, ctx: SerCtx): boolean {
    return (ctx.edgeLW.get(e) ?? 0) < ctx.preorder.get(g)!;
  }

  /** @see write.c:write_node */
  private writeNode(g: Graph, n: Node, ctx: SerCtx): void {
    let s = this.indent(ctx) + xdotId(n.name);
    if (!ctx.attrsWritten.has(n)) {
      s += ' [' + this.nodeAttrs(n) + ']';
      ctx.attrsWritten.add(n);
    }
    ctx.out.push(s + ';\n');
    ctx.nodeLW.set(n, ctx.preorder.get(g)!);
  }

  /** @see write.c:write_edge — attrs only on first emission, bare thereafter. */
  private writeEdge(g: Graph, e: Edge, ctx: SerCtx): void {
    const conn = edgeConnector(isDirected(g));
    let s = this.indent(ctx) + xdotId(e.tail.name) + ' ' + conn + ' ' + xdotId(e.head.name);
    if (!ctx.attrsWritten.has(e)) {
      const attrs = this.edgeAttrStr(e);
      if (attrs) s += ' [' + attrs + ']';
      ctx.attrsWritten.add(e);
    }
    ctx.out.push(s + ';\n');
    ctx.edgeLW.set(e, ctx.preorder.get(g)!);
  }

  /** Root-graph attribute block: `_draw_`, `_ldraw_`, `bb`, `xdotversion`. */
  private graphAttrs(g: Graph): string {
    const d = this.draws.get(g);
    const parts: string[] = [];
    if (d?.draw) parts.push(this.drawAttr('_draw_', d.draw));
    if (d?.ldraw) parts.push(this.drawAttr('_ldraw_', d.ldraw));
    parts.push('bb="' + this.bbStr(g) + '"');
    parts.push(...graphLabelAttrs(g));
    parts.push('xdotversion="' + XDOT_VERSION + '"');
    return parts.join(' ');
  }

  /** Cluster attribute block. C's xdot_end_cluster ALWAYS agsets `_draw_` when
   *  the graph has clusters (even empty, e.g. peripheries=0), so emit it
   *  unconditionally; `_ldraw_` only when the cluster has a label.
   *  @see plugin/core/gvrender_core_dot.c:284 xdot_end_cluster */
  private clusterAttrs(sg: Graph): string {
    const d = this.draws.get(sg);
    const parts: string[] = [this.drawAttr('_draw_', d?.draw ?? '')];
    if (d?.ldraw) parts.push(this.drawAttr('_ldraw_', d.ldraw));
    if (sg.info.bb) parts.push('bb="' + this.bbStr(sg) + '"');
    // rec_attach_bb recurses into GD_clust, so a labelled cluster carries the
    // same lp/lwidth/lheight triple as the root. @see lib/common/output.c:249
    parts.push(...graphLabelAttrs(sg));
    return parts.join(' ');
  }

  /** Node attribute block: pos/width/height plus `_draw_`/`_ldraw_`. */
  private nodeAttrs(n: Node): string {
    const info = n.info;
    // attach_attrs derives the emitted size from ND_lw+ND_rw / ND_ht, NOT
    // ND_width/ND_height (output.c:307-308). They coincide except where an
    // engine leaves them divergent — patchwork's finishNode lets poly_init
    // clobber ND_width/height while the tile survives in lw/rw/ht.
    let s = 'pos="' + gfmt5(info.coord.x) + ',' + gfmt5(info.coord.y) + '"' +
      ' width=' + gfmt5((info.lw + info.rw) / 72) + ' height=' + gfmt5(info.ht / 72);
    // xlp — only when the node HAS an xlabel AND the xlabel placer actually set
    // its position (`ND_xlabel(n)->set`). An xlabel that was never placed is
    // omitted entirely — so an input `xlp` survives and is echoed.
    // @see lib/common/output.c:309-313
    const xlabel = info.xlabel as TextlabelT | undefined;
    if (xlabel && xlabel.set) s += ' xlp="' + lpStr(xlabel.pos) + '"';
    else s += pfx(echoAttr(n.attrs, 'xlp'));
    // rects — record field boxes. C gates on the SHAPE NAME being exactly
    // "record" (`strcmp(ND_shape(n)->name, "record") == 0`), so `Mrecord` and
    // HTML-table nodes get NO rects; confirmed against the native oracle. When
    // the shape is not a record the input's `rects` is never overwritten and is
    // echoed — patchwork forces every node to `box`, so a re-fed dot output
    // returns its old record rects untouched. @see lib/common/output.c:314-317
    const shape = info.shape as ShapeDesc | undefined;
    if (shape?.name === 'record') {
      const rects: string[] = [];
      appendRecordRects(n, info.shape_info as FieldT, rects);
      s += ' rects="' + rects.join(' ') + '"';
    } else {
      s += pfx(echoAttr(n.attrs, 'rects'));
    }
    const d = this.draws.get(n);
    if (d?.draw) s += ' ' + this.drawAttr('_draw_', d.draw);
    if (d?.ldraw) s += ' ' + this.drawAttr('_ldraw_', d.ldraw);
    return s;
  }

  /** The `[...]` attribute body for an edge (draw ops + spline `pos`), or ''. */
  private edgeAttrStr(e: Edge): string {
    const d = this.draws.get(e);
    const parts: string[] = [];
    if (d?.draw) parts.push(this.drawAttr('_draw_', d.draw));
    if (d?.ldraw) parts.push(this.drawAttr('_ldraw_', d.ldraw));
    if (d?.hdraw) parts.push(this.drawAttr('_hdraw_', d.hdraw));
    if (d?.tdraw) parts.push(this.drawAttr('_tdraw_', d.tdraw));
    if (d?.hldraw) parts.push(this.drawAttr('_hldraw_', d.hldraw));
    if (d?.tldraw) parts.push(this.drawAttr('_tldraw_', d.tldraw));
    const pos = formatEdgePos(e);
    if (pos) {
      parts.push(pos);
    } else {
      // C's attach_attrs only agsets `pos` when the edge HAS a spline
      // (output.c:348); an engine that never routes (patchwork) leaves the
      // INPUT's own pos attribute intact and write.c emits it verbatim.
      parts.push(...echoAttr(e.attrs, 'pos'));
    }
    // The label-position attributes live inside the SAME loop that writes `pos`
    // (output.c:377-396), so they are attached only for a routed, non-IGNORED
    // edge. Note the asymmetry C encodes: `lp`/`head_lp`/`tail_lp` are emitted
    // whenever the label EXISTS, but `xlp` additionally requires `->set` — an
    // unplaced xlabel is omitted. Order mirrors C: lp, xlp, head_lp, tail_lp.
    // Each gate is independent, and each FAILED gate leaves the input's own
    // value in the slot for write.c to echo: an unrouted edge (patchwork routes
    // none) returns the `lp` a previous dot run wrote.
    const attached = edgeAttrsAttached(e);
    const info = e.info;
    if (attached && info.label) parts.push('lp="' + lpStr(info.label.pos) + '"');
    else parts.push(...echoAttr(e.attrs, 'lp'));
    if (attached && info.xlabel && info.xlabel.set) {
      parts.push('xlp="' + lpStr(info.xlabel.pos) + '"');
    } else parts.push(...echoAttr(e.attrs, 'xlp'));
    if (attached && info.head_label) {
      parts.push('head_lp="' + lpStr(info.head_label.pos) + '"');
    } else parts.push(...echoAttr(e.attrs, 'head_lp'));
    if (attached && info.tail_label) {
      parts.push('tail_lp="' + lpStr(info.tail_label.pos) + '"');
    } else parts.push(...echoAttr(e.attrs, 'tail_lp'));
    return parts.join(' ');
  }
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/** @see plugin/core/gvrender_core_dot.c FORMAT_DOT */
export function createDotRenderer(): RendererPlugin {
  return new DotRenderer();
}

/** @see plugin/core/gvrender_core_dot.c FORMAT_XDOT */
export function createXdotRenderer(): RendererPlugin {
  return new XdotRenderer();
}
