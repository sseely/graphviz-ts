// SPDX-License-Identifier: EPL-2.0

/**
 * Pure style-resolution functions: parse style strings and resolve
 * pen/fill properties from node attributes.  Data-in / data-out only —
 * no rendering, no ObjState mutation (AD2).
 *
 * Exported interface:
 *
 *   interface PolyStyleFlags {
 *     filled, dashed, dotted, bold, invis, diagonals,
 *     rounded, radial, striped, wedged: boolean
 *   }
 *
 *   interface NodeAttrs {
 *     style?: string; fillcolor?: string; color?: string
 *   }
 *
 *   parseStyleFlags(style?: string)        → PolyStyleFlags
 *   resolvePenType(flags)                  → PenType
 *   resolvePenWidth(flags, penwidthAttr?)  → number
 *   resolveNodeFill(attrs)                 → { filled: boolean; color: string }
 *   resolvePenColor(colorAttr?)            → string
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
}

/**
 * Minimal node attribute bag consumed by resolveNodeFill.
 * Mirrors the subset of node attrs read by findFill / isFilled in C.
 */
export interface NodeAttrs {
  style?: string | undefined;
  fillcolor?: string | undefined;
  color?: string | undefined;
}

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
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All-false sentinel returned for empty/undefined style strings. */
function zeroFlags(): PolyStyleFlags {
  return {
    filled: false, dashed: false, dotted: false, bold: false,
    invis: false, diagonals: false, rounded: false,
    radial: false, striped: false, wedged: false,
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a graphviz style attribute string into a flag set.
 *
 * Splits on commas, trims whitespace, skips tokens containing '('
 * (e.g. "setlinewidth(3)") — penwidth is handled separately by
 * resolvePenWidth, not here.
 *
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
 *
 * Precedence: dashed checked before dotted, matching the order in
 * lib/gvc/gvrender.c:493-495 (gvrender_set_style processes "dashed"
 * on line 493, "dotted" on line 495 — when both flags are set we
 * report Dashed to preserve that ordering intent).
 *
 * @see lib/gvc/gvrender.c:493
 */
export function resolvePenType(flags: PolyStyleFlags): PenType {
  if (flags.dashed) return PenType.Dashed;
  if (flags.dotted) return PenType.Dotted;
  return PenType.Solid;
}

/**
 * Resolve pen width from flags and the raw penwidth attribute string.
 *
 * Precedence (verified in lib/common/shapes.c:539-541, stylenode):
 *   1. Explicit penwidth attr (if it parses to a finite number) — wins.
 *   2. bold flag → PENWIDTH_BOLD (2.0).
 *   3. Default → 1.0.
 *
 * @see lib/common/shapes.c:539 stylenode (N_penwidth applied first)
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
 *
 * A node is filled when its style contains "filled" (or "radial").
 * Fill color precedence mirrors lib/common/shapes.c:findFillDflt:
 *   fillcolor attr → color attr → DEFAULT_FILL ("lightgrey").
 *
 * For two-color/gradient specs ("c1:c2") the first solid color is
 * returned (AD3); parseGradientSpec is reused, not reimplemented.
 * When not filled, color is returned as "".
 *
 * @see lib/common/shapes.c:401 findFillDflt
 * @see lib/common/shapes.c:417 findFill → DEFAULT_FILL="lightgrey"
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

/** Choose raw fill color then split gradient spec (AD3). */
function pickFillColor(
  fillcolor: string | undefined,
  color: string | undefined,
): string {
  // precedence: fillcolor → color → DEFAULT_FILL (lib/common/shapes.c:401-413)
  const raw =
    (fillcolor && fillcolor.length > 0) ? fillcolor :
    (color && color.length > 0) ? color :
    DEFAULT_FILL;
  const grad = parseGradientSpec(raw);
  return grad !== null ? grad[0] : raw;
}

/**
 * Resolve pen (stroke) color from the raw color attribute.
 *
 * Returns the color attr if non-empty, else DEFAULT_COLOR ("black").
 * For colorList specs ("c1:c2") returns the first color (AD3).
 *
 * @see lib/common/shapes.c:389 penColor
 * @see lib/common/const.h:48 DEFAULT_COLOR = "black"
 */
export function resolvePenColor(colorAttr: string | undefined): string {
  if (!colorAttr || colorAttr.length === 0) return DEFAULT_COLOR;
  const grad = parseGradientSpec(colorAttr);
  return grad !== null ? grad[0] : colorAttr;
}
