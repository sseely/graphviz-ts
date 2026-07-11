// SPDX-License-Identifier: EPL-2.0

/**
 * Pure style-resolution functions: parse style strings and resolve
 * pen/fill properties from node attributes.  Data-in / data-out only —
 * no rendering, no ObjState mutation (AD2).
 *
 * Exports: parseStyleFlags, resolvePenType, resolvePenWidth,
 * resolveNodeFill, resolveNodeFillEx, resolvePenColor,
 * resolveClusterFill, resolveClusterFillEx, findStopColor.
 * Types: PolyStyleFlags, NodeAttrs, ClusterAttrs, ClusterFill, ResolvedFill.
 *
 * @see lib/common/types.h:graphviz_polygon_style_t
 * @see lib/common/shapes.c:checkStyle
 * @see lib/common/shapes.c:stylenode
 * @see lib/common/shapes.c:penColor
 * @see lib/common/shapes.c:findFill
 * @see lib/common/emit.c:isFilled
 * @see lib/common/emit.c:4010 parse_style
 * @see lib/gvc/gvrender.c:481 gvrender_set_style
 * @see lib/common/const.h (DEFAULT_COLOR="black", DEFAULT_FILL="lightgrey")
 */

import { PenType } from '../gvc/context.js';
import { parseGradientSpec } from './htmltable-emit-fill.js';
import { parseSegs } from './multicolor.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** @see lib/common/types.h:graphviz_polygon_style_t */
export interface PolyStyleFlags {
  filled: boolean;
  dashed: boolean;
  dotted: boolean;
  bold: boolean;
  invis: boolean;
  diagonals: boolean;
  rounded: boolean;
  radial: boolean;
  striped: boolean;
  wedged: boolean;
  underline: boolean;
  /**
   * Pen width from a `setlinewidth(N)` style token, or null when absent.
   * @see lib/gvc/gvrender.c:501 gvrender_set_style (atof of paren argument)
   */
  setLineWidth: number | null;
}

/**
 * Minimal node attribute bag consumed by resolveNodeFill / resolveNodeFillEx.
 * Mirrors the subset of node attrs read by findFill / isFilled in C.
 */
export interface NodeAttrs {
  style?: string | undefined;
  fillcolor?: string | undefined;
  color?: string | undefined;
  /** @see lib/common/emit.c gradientangle attr */
  gradientangle?: string | undefined;
}

/**
 * Minimal cluster attribute bag consumed by resolveClusterFill /
 * resolveClusterFillEx.
 * Mirrors the attrs read in emit_clusters (lib/common/emit.c:3805-3853).
 */
export interface ClusterAttrs {
  style?: string | undefined;
  color?: string | undefined;
  pencolor?: string | undefined;
  fillcolor?: string | undefined;
  bgcolor?: string | undefined;
  penwidth?: string | undefined;
  /** @see lib/common/emit.c gradientangle attr */
  gradientangle?: string | undefined;
}

/**
 * Resolved fill and pen colors for a cluster boundary polygon.
 * @see lib/common/emit.c:emit_clusters:3805-3853
 */
export interface ClusterFill {
  /** Whether the cluster interior should be painted. */
  filled: boolean;
  /** Fill color to use when filled=true. */
  fillColor: string;
  /** Pen (stroke) color. */
  penColor: string;
}

/**
 * Discriminated fill result (AD4, AD6).
 * 'none' = not filled; 'solid' = single color;
 * 'linear'/'radial' = gradient from findStopColor.
 * @see lib/common/emit.c:4335 findStopColor
 */
export type ResolvedFill =
  | { kind: 'none' }
  | { kind: 'solid'; color: string }
  | { kind: 'linear' | 'radial'; fillColor: string; stopColor: string; frac: number; angle: number };

// ---------------------------------------------------------------------------
// Constants — lib/common/const.h
// ---------------------------------------------------------------------------

/** @see lib/common/const.h:48 — #define DEFAULT_COLOR "black" */
const DEFAULT_COLOR = 'black';

/** @see lib/common/const.h:69 — #define DEFAULT_FILL "lightgrey" */
const DEFAULT_FILL = 'lightgrey';

/** @see lib/gvc/gvcjob.h:41 — #define PENWIDTH_BOLD 2.0 */
const PENWIDTH_BOLD = 2.0;

// ---------------------------------------------------------------------------
// Token → flag lookup (replaces switch to keep CCN ≤ 10)
// ---------------------------------------------------------------------------

/** Keys of PolyStyleFlags whose value is boolean (excludes setLineWidth). */
type BoolFlagKey = {
  [K in keyof PolyStyleFlags]: PolyStyleFlags[K] extends boolean ? K : never;
}[keyof PolyStyleFlags];

/**
 * Direct-mapped tokens: token string → PolyStyleFlags boolean key.
 * "radial" is absent here because it also sets filled=true (handled inline).
 * @see lib/gvc/gvrender.c:481 gvrender_set_style
 * @see lib/common/shapes.c:checkStyle
 */
const TOKEN_FLAG: Readonly<Record<string, BoolFlagKey>> = {
  filled: 'filled',
  dashed: 'dashed',
  dotted: 'dotted',
  bold: 'bold',
  invis: 'invis',
  diagonals: 'diagonals',
  rounded: 'rounded',
  striped: 'striped',
  wedged: 'wedged',
  underline: 'underline',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All-false sentinel returned for empty/undefined style strings. */
function zeroFlags(): PolyStyleFlags {
  return {
    filled: false, dashed: false, dotted: false, bold: false,
    invis: false, diagonals: false, rounded: false,
    radial: false, striped: false, wedged: false, underline: false,
    setLineWidth: null,
  };
}

/** C parse_style truncates the style list at FUNLIMIT tokens. @see lib/common/emit.c:4001 */
const FUNLIMIT = 64;

/**
 * The raw style tokens C's parse_style produces (comma-separated, trimmed,
 * non-empty), truncated to empty past FUNLIMIT. These are what xdot's
 * `xdot_style` re-emits as `S` ops (it skips filled/bold/setlinewidth). The
 * port resolves style into a PenType for SVG; xdot needs the original tokens.
 * @see lib/common/emit.c:4010 parse_style · gvrender_core_dot.c:161 xdot_style
 */
export function styleTokens(style: string | undefined): string[] {
  if (!style) return [];
  const out: string[] = [];
  let fun = 0;
  for (const raw of style.split(',')) {
    const token = raw.trim();
    if (token.length === 0) continue;
    if (fun === FUNLIMIT - 1) return [];
    fun++;
    out.push(token);
  }
  return out;
}

/**
 * Extract the numeric argument of a `setlinewidth(N)` token, or null if the
 * token is not a setlinewidth form. Mirrors gvrender_set_style reading
 * `atof` of the parenthesized argument (atof → 0.0 on a non-numeric arg).
 * @see lib/gvc/gvrender.c:501
 */
function parseSetLineWidth(token: string): number | null {
  const m = /^setlinewidth\s*\(\s*([^)]*)\)\s*$/.exec(token);
  if (m === null) return null;
  const v = parseFloat(m[1]);
  return Number.isNaN(v) ? 0 : v;
}

/**
 * Apply a single trimmed style token to the flags in place.
 * "radial" implies filled=true (lib/common/shapes.c:checkStyle:499-500).
 * Unknown tokens are silently ignored.
 */
function applyToken(flags: PolyStyleFlags, token: string): void {
  if (token === 'radial') { flags.radial = true; flags.filled = true; return; }
  const key = TOKEN_FLAG[token];
  if (key !== undefined) flags[key] = true;
}

/** True when s is a non-empty string. */
function nonEmpty(s: string | undefined): s is string {
  return s !== undefined && s.length > 0;
}

/** Return s if non-empty, else fallback. */
function orElse(s: string | undefined, fallback: string): string {
  return nonEmpty(s) ? s : fallback;
}

/** Return the first solid color from a raw color string (AD3). */
function firstSolidColor(raw: string): string {
  const grad = parseGradientSpec(raw);
  return grad !== null ? grad[0] : raw;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a graphviz style attribute string into a flag set.
 *
 * Splits on commas and trims. A `setlinewidth(N)` token captures its pen-width
 * argument; other tokens containing '(' are ignored. When the non-empty token
 * count reaches FUNLIMIT (64), C's parse_style returns early before building
 * the style list — the observable effect is an empty style list (no flags
 * applied), which we reproduce by returning zeroFlags().
 *
 * @see lib/common/emit.c:4010 parse_style (FUNLIMIT truncation)
 * @see lib/gvc/gvrender.c:481 gvrender_set_style (setlinewidth → penwidth)
 */
export function parseStyleFlags(style: string | undefined): PolyStyleFlags {
  const flags = zeroFlags();
  if (!style) return flags;
  let fun = 0;
  for (const raw of style.split(',')) {
    const token = raw.trim();
    if (token.length === 0) continue;
    // C truncates at the FUNLIMIT-th token, skipping the pointer-construction
    // loop → the returned list is empty → no flags apply.
    if (fun === FUNLIMIT - 1) return zeroFlags();
    fun++;
    const lw = parseSetLineWidth(token);
    if (lw !== null) { flags.setLineWidth = lw; continue; }
    if (!token.includes('(')) applyToken(flags, token);
  }
  return flags;
}

/**
 * Resolve PenType from parsed style flags.
 * Dashed is checked before dotted (lib/gvc/gvrender.c:493-495).
 * @see lib/gvc/gvrender.c:493
 */
/**
 * True when a style string contains the "invisible" pen alias.
 *
 * `gvrender_set_style` maps BOTH "invis" and "invisible" to PEN_NONE
 * (`streq(line,"invis") || streq(line,"invisible")`), suppressing the object's
 * draw. The exact "invis" token additionally drives emit_node/emit_edge's early
 * return and the point shape's `{invis,filled}` whitelist (checkStyle uses exact
 * "invis"), so it is tracked separately as `flags.invis`. This helper reports the
 * "invisible"-only alias, which suppresses drawing for shapes that pass their raw
 * style through gvrender_set_style (poly/record/edge) but NOT for the point shape.
 * Tokenization mirrors parseStyleFlags (comma split, FUNLIMIT truncation).
 * @see lib/gvc/gvrender.c:497 gvrender_set_style
 * @see lib/common/shapes.c:point_gencode (point_style whitelist)
 */
export function styleHasInvisibleAlias(style: string | undefined): boolean {
  if (!style) return false;
  let fun = 0;
  for (const raw of style.split(',')) {
    const token = raw.trim();
    if (token.length === 0) continue;
    if (fun === FUNLIMIT - 1) return false;
    fun++;
    if (token === 'invisible') return true;
  }
  return false;
}

export function resolvePenType(flags: PolyStyleFlags): PenType {
  // invis → PEN_NONE (gvrender.c:497-498); downstream polygon/textspan emission
  // is pen-gated. Nodes/edges never reach here with invis (emit shortcircuits).
  if (flags.invis) return PenType.None;
  if (flags.dashed) return PenType.Dashed;
  if (flags.dotted) return PenType.Dotted;
  return PenType.Solid;
}

/**
 * Resolve pen width from flags and the raw penwidth attribute string.
 * Precedence: explicit `penwidth` attr → `setlinewidth(N)` style →
 * `bold` flag (2.0) → default (1.0). The explicit attr wins because stylenode
 * applies N_penwidth after gvrender_set_style. (When both `bold` and
 * `setlinewidth` appear in one style string, C is order-dependent; that rare
 * combination is not modelled here — setlinewidth wins.)
 * @see lib/common/shapes.c:539 stylenode
 * @see lib/gvc/gvrender.c:500 gvrender_set_style (bold/setlinewidth)
 * @see lib/gvc/gvcjob.h:41 PENWIDTH_BOLD = 2.0
 */
export function resolvePenWidth(
  flags: PolyStyleFlags,
  penwidthAttr: string | undefined,
): number {
  if (penwidthAttr && penwidthAttr.length > 0) {
    const v = parseFloat(penwidthAttr);
    if (isFinite(v)) return v;
  }
  if (flags.setLineWidth !== null) return flags.setLineWidth;
  if (flags.bold) return PENWIDTH_BOLD;
  return 1.0;
}

/**
 * Resolve fill state and fill color for a node.
 * Precedence: fillcolor → color → DEFAULT_FILL ("lightgrey").
 * Gradient specs return the first solid color (AD3).
 * @see lib/common/shapes.c:401 findFillDflt
 * @see lib/common/emit.c:705 isFilled
 * @see lib/common/const.h:69 DEFAULT_FILL = "lightgrey"
 */
export function resolveNodeFill(attrs: NodeAttrs): {
  filled: boolean;
  color: string;
} {
  const flags = parseStyleFlags(attrs.style);
  if (!flags.filled) return { filled: false, color: '' };
  const color = pickFillColor(attrs.fillcolor, attrs.color);
  return { filled: true, color };
}

/** Choose raw fill color then extract first solid (AD3). */
function pickFillColor(
  fillcolor: string | undefined,
  color: string | undefined,
): string {
  const raw = nonEmpty(fillcolor) ? fillcolor
    : nonEmpty(color) ? color
    : DEFAULT_FILL;
  return firstSolidColor(raw);
}

/**
 * Resolve pen (stroke) color. Returns first solid color from colorList,
 * or DEFAULT_COLOR ("black") when attr is absent.
 * @see lib/common/shapes.c:389 penColor
 * @see lib/common/const.h:48 DEFAULT_COLOR = "black"
 */
export function resolvePenColor(colorAttr: string | undefined): string {
  if (!colorAttr || colorAttr.length === 0) return DEFAULT_COLOR;
  return firstSolidColor(colorAttr);
}

// ---------------------------------------------------------------------------
// Cluster fill helpers (CCN ≤ 3 each)
// ---------------------------------------------------------------------------

/**
 * Derive raw fillcolor and pencolor from cluster attrs.
 * color sets both; pencolor/fillcolor override their respective side.
 * @see lib/common/emit.c:emit_clusters:3835-3840
 */
function clusterColorAttrs(
  attrs: ClusterAttrs,
): { fillcolor: string | undefined; pencolor: string | undefined } {
  const base = nonEmpty(attrs.color) ? attrs.color : undefined;
  const pencolor = orElse(attrs.pencolor, base ?? '');
  const fillcolor = orElse(attrs.fillcolor, base ?? '');
  return {
    fillcolor: nonEmpty(fillcolor) ? fillcolor : undefined,
    pencolor: nonEmpty(pencolor) ? pencolor : undefined,
  };
}

/**
 * Apply bgcolor backward-compat: bgcolor activates fill when none set.
 * @see lib/common/emit.c:emit_clusters:3846-3849
 */
function applyBgcolor(
  attrs: ClusterAttrs,
  filled: boolean,
  fillcolor: string | undefined,
): { filled: boolean; fillcolor: string | undefined } {
  if ((!filled || !fillcolor) && nonEmpty(attrs.bgcolor)) {
    return { filled: true, fillcolor: attrs.bgcolor };
  }
  return { filled, fillcolor };
}

/**
 * Resolve cluster fill: filled flag, fill color, and pen color.
 * Ports emit_clusters (lib/common/emit.c:3805-3853). GUI state branches
 * are not ported (browser-only; states managed externally).
 * @see lib/common/emit.c:emit_clusters:3805-3853
 */
export function resolveClusterFill(attrs: ClusterAttrs): ClusterFill {
  const flags = parseStyleFlags(attrs.style);
  const colors = clusterColorAttrs(attrs);
  const bg = applyBgcolor(attrs, flags.filled, colors.fillcolor);
  const rawPen = colors.pencolor ?? DEFAULT_COLOR;
  const rawFill = bg.fillcolor ?? DEFAULT_FILL;
  return {
    filled: bg.filled,
    fillColor: firstSolidColor(rawFill),
    penColor: firstSolidColor(rawPen),
  };
}
/** @see lib/common/emit.c:4335 findStopColor */
export function findStopColor(
  colorlist: string,
): { fillColor: string; stopColor: string; frac: number } | null {
  const { segs, error } = parseSegs(colorlist);
  if (error === 1 || error === 2) return null;
  if (segs.length < 2) return null;
  const seg0 = segs[0]!;
  const seg1 = segs[1]!;
  if (seg0.color === null) return null;
  const fillColor = seg0.color;
  const stopColor = seg1.color ?? DEFAULT_COLOR;
  const frac = seg0.hasFraction ? seg0.t
    : seg1.hasFraction ? 1 - seg1.t
    : 0;
  return { fillColor, stopColor, frac };
}

/** Parse gradientangle attr to integer, default 0. */
function parseAngle(gradientangle: string | undefined): number {
  if (!gradientangle || gradientangle.length === 0) return 0;
  const v = parseInt(gradientangle, 10);
  return isFinite(v) ? v : 0;
}

/** Build ResolvedFill from raw color + flags. AD6: two-color → gradient. */
function buildResolvedFill(
  rawColor: string,
  flags: PolyStyleFlags,
  angle: number,
): ResolvedFill {
  const stop = findStopColor(rawColor);
  if (stop === null) return { kind: 'solid', color: rawColor };
  const kind = flags.radial ? 'radial' : 'linear';
  return { kind, fillColor: stop.fillColor, stopColor: stop.stopColor, frac: stop.frac, angle };
}

/**
 * Discriminated fill for a node (AD4, AD6). New Ex variant — original
 * resolveNodeFill shape unchanged for G3 compatibility.
 * @see lib/common/emit.c:4335 findStopColor
 * @see lib/common/shapes.c:findFill
 */
export function resolveNodeFillEx(attrs: NodeAttrs): ResolvedFill {
  const flags = parseStyleFlags(attrs.style);
  if (!flags.filled) return { kind: 'none' };
  const raw = nonEmpty(attrs.fillcolor) ? attrs.fillcolor
    : nonEmpty(attrs.color) ? attrs.color
    : DEFAULT_FILL;
  return buildResolvedFill(raw, flags, parseAngle(attrs.gradientangle));
}

/**
 * Discriminated fill for a cluster (AD4, AD6). New Ex variant — original
 * resolveClusterFill shape unchanged for G4 compatibility.
 * @see lib/common/emit.c:emit_clusters:3805-3853
 * @see lib/common/emit.c:4335 findStopColor
 */
export function resolveClusterFillEx(attrs: ClusterAttrs): ResolvedFill {
  const flags = parseStyleFlags(attrs.style);
  const colors = clusterColorAttrs(attrs);
  const bg = applyBgcolor(attrs, flags.filled, colors.fillcolor);
  if (!bg.filled) return { kind: 'none' };
  const raw = bg.fillcolor ?? DEFAULT_FILL;
  return buildResolvedFill(raw, flags, parseAngle(attrs.gradientangle));
}
