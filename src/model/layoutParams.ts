// SPDX-License-Identifier: EPL-2.0

/**
 * LayoutParams, RatioKind, and FontnameKind — supporting types for GraphInfo.
 * Ported from lib/common/types.h:layout_t and lib/common/types.h:ratio_t.
 *
 * @see lib/common/types.h:layout_t
 * @see lib/common/types.h:ratio_t
 * @see lib/common/types.h:fontname_kind
 */

import type { Point } from './geom.js';

// ---------------------------------------------------------------------------
// ratio_t — @see lib/common/types.h:ratio_t
// ---------------------------------------------------------------------------

/**
 * Ratio kind matching ratio_t enum.
 * R_NONE=0, R_VALUE, R_FILL, R_COMPRESS, R_AUTO, R_EXPAND
 *
 * @see lib/common/types.h:ratio_t
 */
export type RatioKind =
  | 'none'
  | 'value'
  | 'fill'
  | 'compress'
  | 'auto'
  | 'expand';

// ---------------------------------------------------------------------------
// fontname_kind — @see lib/common/types.h:fontname_kind
// ---------------------------------------------------------------------------

/**
 * Controls SVG font-name mangling.
 * NATIVEFONTS=0, PSFONTS=1, SVGFONTS=2
 *
 * @see lib/common/types.h:fontname_kind
 */
export const FontnameKind = {
  NativeFonts: 0,
  PsFonts: 1,
  SvgFonts: 2,
} as const;
export type FontnameKind = (typeof FontnameKind)[keyof typeof FontnameKind];

// ---------------------------------------------------------------------------
// layout_t — @see lib/common/types.h:layout_t
// ---------------------------------------------------------------------------

/**
 * Graph-level layout parameters; stored via GD_drawing.
 *
 * @see lib/common/types.h:layout_t
 * @see lib/common/types.h:GD_drawing
 */
export interface LayoutParams {
  /** Coordinate quantization step. @see lib/common/types.h:layout_t.quantum */
  quantum: number;
  /** Output scale factor. @see lib/common/types.h:layout_t.scale */
  scale: number;
  /**
   * Aspect ratio; set only when ratioKind === 'value'.
   * @see lib/common/types.h:layout_t.ratio
   */
  ratio: number;
  /** Dots per inch. @see lib/common/types.h:layout_t.dpi */
  dpi: number;
  /** Page margin. @see lib/common/types.h:layout_t.margin */
  margin: Point;
  /** Page size. @see lib/common/types.h:layout_t.page */
  page: Point;
  /** Desired graph drawing size. @see lib/common/types.h:layout_t.size */
  size: Point;
  /** Fit graph to page. @see lib/common/types.h:layout_t.filled */
  filled: boolean;
  /** Landscape orientation. @see lib/common/types.h:layout_t.landscape */
  landscape: boolean;
  /** Center graph on page. @see lib/common/types.h:layout_t.centered */
  centered: boolean;
  /** Ratio mode. @see lib/common/types.h:layout_t.ratio_kind */
  ratioKind: RatioKind;
  /**
   * Whether parallel edges should be concentrated into fewer edges.
   * @see lib/common/globals.h:Concentrate
   */
  concentrate?: boolean;
  /**
   * Parsed xdot data; typed fully in a later batch.
   * @see lib/common/types.h:layout_t.xdots
   */
  xdots: unknown | null;
  /**
   * Graph identifier string.
   * @see lib/common/types.h:layout_t.id
   */
  id: string | null;
}

/**
 * Construct a `LayoutParams` mirroring C's calloc-zeroed `layout_t` (GD_drawing),
 * with the given fields overridden. C zero-inits every field, then `graph_init`
 * sets only the ones it parses (ratio_kind, size, filled, …); this factory keeps
 * the unset fields at their C-zero defaults so callers populate just what they
 * need. @see lib/common/types.h:layout_t (allocated via agbindrec/calloc)
 */
export function makeDrawing(overrides: Partial<LayoutParams>): LayoutParams {
  const zero: Point = { x: 0, y: 0 };
  return {
    quantum: 0,
    scale: 0,
    ratio: 0,
    dpi: 0,
    margin: { ...zero },
    page: { ...zero },
    size: { ...zero },
    filled: false,
    landscape: false,
    centered: false,
    ratioKind: 'none',
    xdots: null,
    id: null,
    ...overrides,
  };
}
