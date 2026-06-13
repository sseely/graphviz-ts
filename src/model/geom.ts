// SPDX-License-Identifier: EPL-2.0

/**
 * Geometric primitive types ported from lib/common/geom.h and lib/common/types.h.
 *
 * @see lib/common/geom.h
 * @see lib/common/types.h
 * @see lib/common/const.h
 */

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

/**
 * Floating-point 2-D point.
 *
 * @see lib/common/geom.h: struct pointf_s { double x, y; }
 */
export type Point = { x: number; y: number };

// ---------------------------------------------------------------------------
// Boxes
// ---------------------------------------------------------------------------

/**
 * Floating-point axis-aligned bounding box, defined by lower-left and
 * upper-right corners.
 *
 * C uses uppercase `LL`/`UR`; TypeScript uses `ll`/`ur` per camelCase
 * convention documented in the port mapping table.
 *
 * @see lib/common/geom.h: typedef struct { pointf LL, UR; } boxf
 */
export type Box = { ll: Point; ur: Point };

// ---------------------------------------------------------------------------
// Bezier curves and splines
// ---------------------------------------------------------------------------

/**
 * A single Bezier curve segment used in edge spline rendering.
 *
 * @see lib/common/types.h: typedef struct bezier
 */
export type Bezier = {
  /** @see lib/common/types.h: pointf *list */
  list: Point[];
  /** @see lib/common/types.h: size_t size */
  size: number;
  /** @see lib/common/types.h: uint32_t sflag */
  sflag: number;
  /** @see lib/common/types.h: uint32_t eflag */
  eflag: number;
  /** @see lib/common/types.h: pointf sp */
  sp: Point;
  /** @see lib/common/types.h: pointf ep */
  ep: Point;
};

/**
 * A collection of Bezier curves that form an edge spline, together with
 * its bounding box.
 *
 * @see lib/common/types.h: typedef struct splines
 */
export type Spline = {
  /** @see lib/common/types.h: bezier *list */
  list: Bezier[];
  /** @see lib/common/types.h: size_t size */
  size: number;
  /** @see lib/common/types.h: boxf bb */
  bb: Box;
};

// ---------------------------------------------------------------------------
// Port
// ---------------------------------------------------------------------------

/**
 * Internal edge endpoint specification.
 *
 * @see lib/common/types.h: typedef struct port
 */
export type Port = {
  /** Aiming point relative to node center. @see lib/common/types.h: pointf p */
  p: Point;
  /** Slope in radians. @see lib/common/types.h: double theta */
  theta: number;
  /**
   * When non-null, points to the bounding box of the rectangular port target.
   * @see lib/common/types.h: boxf *bp
   */
  bp: Box | null;
  /** If true, edge has port info at this end. @see lib/common/types.h: bool defined */
  defined: boolean;
  /** If true, constraints such as theta are set. @see lib/common/types.h: bool constrained */
  constrained: boolean;
  /** If true, clip end to node/port shape. @see lib/common/types.h: bool clip */
  clip: boolean;
  /** If true, assign compass point dynamically. @see lib/common/types.h: bool dyna */
  dyna: boolean;
  /** For mincross. @see lib/common/types.h: unsigned char order */
  order: number;
  /**
   * If port is on perimeter of node, contains the bitwise OR of the sides
   * (TOP, BOTTOM, etc.) it is on.
   * @see lib/common/types.h: unsigned char side
   */
  side: number;
  /**
   * Port name if explicitly given, otherwise null.
   * @see lib/common/types.h: char *name
   */
  name: string | null;
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rotation helpers
// ---------------------------------------------------------------------------

/**
 * Counter-clockwise rotate point p by ccwrot degrees (0, 90, 180, or 270).
 *
 * Matches the four-case switch in lib/common/geom.c:ccwrotatepf exactly:
 *   0   → identity
 *   90  → perp(p)  = { x: -p.y, y: p.x }
 *   180 → { x: p.x, y: -p.y }    (note: keep x, negate y — matches geom.c:180 case)
 *   270 → exch_xyf(p) = { x: p.y, y: p.x }
 *
 * @see lib/common/geom.c:ccwrotatepf
 */
export function ccwrotatepf(p: Point, ccwrot: number): Point {
  switch (ccwrot) {
    case 0:   return p;
    case 90:  return { x: -p.y, y: p.x };
    case 180: return { x: p.x, y: -p.y };
    case 270: return { x: p.y, y: p.x };
    default:  return p;
  }
}

/**
 * Returns true if box `b0` completely contains box `b1`.
 *
 * Matches the C `CONTAINS` macro exactly:
 * ```c
 * #define CONTAINS(b0,b1) \
 *   (((b0).UR.x >= (b1).UR.x) && ((b0).UR.y >= (b1).UR.y) && \
 *    ((b0).LL.x <= (b1).LL.x) && ((b0).LL.y <= (b1).LL.y))
 * ```
 *
 * @see lib/common/geom.h: CONTAINS macro
 */
export function boxContains(b0: Box, b1: Box): boolean {
  return (
    b0.ur.x >= b1.ur.x &&
    b0.ur.y >= b1.ur.y &&
    b0.ll.x <= b1.ll.x &&
    b0.ll.y <= b1.ll.y
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Points per inch — used throughout Graphviz for unit conversion.
 *
 * @see lib/common/geom.h: #define POINTS_PER_INCH 72
 */
export const POINTS_PER_INCH = 72;

/**
 * Default line spacing multiplier for multi-line labels.
 *
 * @see lib/common/const.h: #define LINESPACING 1.20
 */
export const LINESPACING = 1.20;
