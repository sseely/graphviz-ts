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

/**
 * Direct-mapped tokens: token string → PolyStyleFlags key.
 * "radial" is absent here because it also sets filled=true (handled inline).
 * @see lib/gvc/gvrender.c:481 gvrender_set_style
 * @see lib/common/shapes.c:checkStyle
 */
const TOKEN_FLAG: Readonly<Record<string, keyof PolyStyleFlags>> = {
  filled: 'filled',
  dashed: 'dashed',
  dotted: 'dotted',
  bold: 'bold',
  invis: 'invis',
  invisible: 'invis',
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
  };
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
 * Splits on commas, trims whitespace, skips tokens containing '('.
 * @see lib/common/emit.c:4010 parse_style
 * @see lib/gvc/gvrender.c:481 gvrender_set_style
 */
export function parseStyleFlags(style: string | undefined): PolyStyleFlags {
  const flags = zeroFlags();
  if (!style) return flags;
  for (const raw of style.split(',')) {
    const token = raw.trim();
    if (!token.includes('(')) applyToken(flags, token);
  }
  return flags;
}

/**
 * Resolve PenType from parsed style flags.
 * Dashed is checked before dotted (lib/gvc/gvrender.c:493-495).
 * @see lib/gvc/gvrender.c:493
 */
export function resolvePenType(flags: PolyStyleFlags): PenType {
  if (flags.dashed) return PenType.Dashed;
  if (flags.dotted) return PenType.Dotted;
  return PenType.Solid;
}

/**
 * Resolve pen width from flags and the raw penwidth attribute string.
 * Precedence: explicit attr → bold flag (2.0) → default (1.0).
 * @see lib/common/shapes.c:539 stylenode
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
