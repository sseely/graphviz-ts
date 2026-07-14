// SPDX-License-Identifier: EPL-2.0

/**
 * Geometric primitives for compound-edge spline clipping.
 * Bezier subdivision, crossing detection, and box-intersection math
 * extracted from lib/dotgen/compound.c.
 *
 * @see lib/dotgen/compound.c
 */

import type { Point, Box } from '../../model/geom.js';
import { cround } from '../../common/arith.js';

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/**
 * Sign comparison for doubles, matching C fcmp().
 * Returns -1, 0, or 1.
 *
 * @see lib/util/gv_math.h:fcmp
 */
export function fcmp(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Returns true if point p is on or inside box bb.
 *
 * @see lib/dotgen/compound.c:inBoxf
 */
export function inBoxf(p: Point, bb: Box): boolean {
  return p.x >= bb.ll.x && p.x <= bb.ur.x && p.y >= bb.ll.y && p.y <= bb.ur.y;
}

/**
 * Midpoint of two points. Matches C mid_pointf().
 *
 * @see lib/common/utils.c:mid_pointf
 */
export function midPointf(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ---------------------------------------------------------------------------
// Bezier subdivision
// ---------------------------------------------------------------------------

/** One triangle row for De Casteljau; avoids nested array allocation. */
type CasteljauRow = [Point, Point, Point, Point];

/** Compute one row of the De Casteljau triangle at parameter t. */
export function casteljauStep(prev: CasteljauRow, t: number): CasteljauRow {
  const u = 1 - t;
  return [
    { x: u * prev[0].x + t * prev[1].x, y: u * prev[0].y + t * prev[1].y },
    { x: u * prev[1].x + t * prev[2].x, y: u * prev[1].y + t * prev[2].y },
    { x: u * prev[2].x + t * prev[3].x, y: u * prev[2].y + t * prev[3].y },
    { x: 0, y: 0 }, // unused slot; keeps tuple type uniform
  ];
}

/**
 * De Casteljau subdivision of a cubic Bezier at parameter t.
 * Returns left-half or right-half control points.
 * Matches C Bezier() triangle computation.
 *
 * @see lib/common/utils.c:Bezier
 */
export function subdivideBezier(
  v: readonly Point[],
  t: number,
  side: 'left' | 'right',
): Point[] {
  const r0: CasteljauRow = [{ ...v[0] }, { ...v[1] }, { ...v[2] }, { ...v[3] }];
  const r1 = casteljauStep(r0, t);
  const r2 = casteljauStep(r1, t);
  const r3 = casteljauStep(r2, t);
  return side === 'left'
    ? [r0[0], r1[0], r2[0], r3[0]]
    : [r3[0], r2[1], r1[2], r0[3]];
}

// ---------------------------------------------------------------------------
// Crossing counters
// ---------------------------------------------------------------------------

/**
 * Count control-polygon crossings of vertical line x = xcoord.
 *
 * @see lib/dotgen/compound.c:countVertCross
 */
export function countVertCross(pts: Point[], xcoord: number): number {
  let sign = fcmp(pts[0].x, xcoord);
  let count = sign === 0 ? 1 : 0;
  for (let i = 1; i <= 3; i++) {
    const old = sign;
    sign = fcmp(pts[i].x, xcoord);
    if (sign !== old && old !== 0) count++;
  }
  return count;
}

/**
 * Count control-polygon crossings of horizontal line y = ycoord.
 *
 * @see lib/dotgen/compound.c:countHorzCross
 */
export function countHorzCross(pts: Point[], ycoord: number): number {
  let sign = fcmp(pts[0].y, ycoord);
  let count = sign === 0 ? 1 : 0;
  for (let i = 1; i <= 3; i++) {
    const old = sign;
    sign = fcmp(pts[i].y, ycoord);
    if (sign !== old && old !== 0) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// findAxisCrossing — unified vertical/horizontal binary subdivision
// ---------------------------------------------------------------------------

/**
 * Axis-line specification for findAxisCrossing.
 * Bundles the line coordinate and perpendicular range to avoid 6-param
 * signatures on recursive calls.
 */
export interface LineSpec {
  /** The coordinate of the axis-aligned line being tested. */
  lineCoord: number;
  /** Lower bound of the perpendicular range. */
  rangeMin: number;
  /** Upper bound of the perpendicular range. */
  rangeMax: number;
  /** 'v' = vertical (x = lineCoord); 'h' = horizontal (y = lineCoord). */
  axis: 'v' | 'h';
}

/** Return true if the Bezier endpoint lies within spec's perpendicular range. */
export function endpointInRange(pts: Point[], spec: LineSpec): boolean {
  const perp = spec.axis === 'v' ? pts[3].y : pts[3].x;
  return perp >= spec.rangeMin && perp <= spec.rangeMax;
}

/** Return true if the endpoint coord is within 0.005 of the line. */
export function endpointNearLine(pts: Point[], spec: LineSpec): boolean {
  const coord = spec.axis === 'v' ? pts[3].x : pts[3].y;
  return Math.abs(coord - spec.lineCoord) <= 0.005;
}

/** Count crossings of pts with the axis line described by spec. */
export function countCrossings(pts: Point[], spec: LineSpec): number {
  return spec.axis === 'v'
    ? countVertCross(pts, spec.lineCoord)
    : countHorzCross(pts, spec.lineCoord);
}

/**
 * Find the first t in [tmin, tmax] where the Bezier crosses the axis line
 * described by spec. Returns -1 if not found.
 * Recursive binary subdivision (Graphics Gems pp.411-415).
 *
 * Replaces findVertical and findHorizontal from compound.c.
 *
 * @see lib/dotgen/compound.c:findVertical
 * @see lib/dotgen/compound.c:findHorizontal
 */
export function findAxisCrossing(
  pts: Point[], tmin: number, tmax: number, spec: LineSpec,
): number {
  if (tmin === tmax) return tmin;
  const nc = countCrossings(pts, spec);
  if (nc === 0) return -1;
  if (nc === 1 && endpointNearLine(pts, spec)) {
    return endpointInRange(pts, spec) ? tmax : -1;
  }
  const tmid = (tmin + tmax) / 2;
  const tL = findAxisCrossing(subdivideBezier(pts, 0.5, 'left'), tmin, tmid, spec);
  return tL >= 0
    ? tL
    : findAxisCrossing(subdivideBezier(pts, 0.5, 'right'), tmid, tmax, spec);
}

// ---------------------------------------------------------------------------
// splineIntersectf
// ---------------------------------------------------------------------------

/** Update best-t and rewrite pts[0..3] from orig at parameter t if better. */
export function tryUpdateIntersect(
  t: number, tmin: number, orig: Point[], pts: Point[],
): number {
  if (t < 0 || t >= tmin) return tmin;
  const left = subdivideBezier(orig, t, 'left');
  for (let i = 0; i < 4; i++) pts[i] = left[i];
  return t;
}

/** Build the four LineSpec values for the sides of a box. */
export function boxLineSpecs(bb: Box): [LineSpec, LineSpec, LineSpec, LineSpec] {
  return [
    { axis: 'v', lineCoord: bb.ll.x, rangeMin: bb.ll.y, rangeMax: bb.ur.y },
    { axis: 'v', lineCoord: bb.ur.x, rangeMin: bb.ll.y, rangeMax: bb.ur.y },
    { axis: 'h', lineCoord: bb.ll.y, rangeMin: bb.ll.x, rangeMax: bb.ur.x },
    { axis: 'h', lineCoord: bb.ur.y, rangeMin: bb.ll.x, rangeMax: bb.ur.x },
  ];
}

/**
 * Find the earliest intersection of Bezier pts[0..3] with box bb and
 * truncate pts to that point. Returns true when an intersection was found.
 *
 * @see lib/dotgen/compound.c:splineIntersectf
 */
export function splineIntersectf(pts: Point[], bb: Box): boolean {
  let tmin = 2.0;
  const orig = pts.map(p => ({ ...p }));
  for (const spec of boxLineSpecs(bb)) {
    tmin = tryUpdateIntersect(
      findAxisCrossing(pts, 0, Math.min(1, tmin), spec), tmin, orig, pts);
  }
  return tmin < 2.0;
}

// ---------------------------------------------------------------------------
// boxIntersectf
// ---------------------------------------------------------------------------

/** Check left-side intersection of segment pp→cp with bb. */
export function tryLeftSide(pp: Point, cp: Point, bb: Box): Point | null {
  if (cp.x >= bb.ll.x) return null;
  const x = bb.ll.x;
  const y = pp.y + cround((x - pp.x) * (pp.y - cp.y) / (pp.x - cp.x));
  return y >= bb.ll.y && y <= bb.ur.y ? { x, y } : null;
}

/** Check right-side intersection of segment pp→cp with bb. */
export function tryRightSide(pp: Point, cp: Point, bb: Box): Point | null {
  if (cp.x <= bb.ur.x) return null;
  const x = bb.ur.x;
  const y = pp.y + cround((x - pp.x) * (pp.y - cp.y) / (pp.x - cp.x));
  return y >= bb.ll.y && y <= bb.ur.y ? { x, y } : null;
}

/** Check bottom-side intersection of segment pp→cp with bb. */
export function tryBottomSide(pp: Point, cp: Point, bb: Box): Point | null {
  if (cp.y >= bb.ll.y) return null;
  const y = bb.ll.y;
  const x = pp.x + cround((y - pp.y) * (pp.x - cp.x) / (pp.y - cp.y));
  return x >= bb.ll.x && x <= bb.ur.x ? { x, y } : null;
}

/** Check top-side intersection of segment pp→cp with bb. */
export function tryTopSide(pp: Point, cp: Point, bb: Box): Point | null {
  if (cp.y <= bb.ur.y) return null;
  const y = bb.ur.y;
  const x = pp.x + cround((y - pp.y) * (pp.x - cp.x) / (pp.y - cp.y));
  return x >= bb.ll.x && x <= bb.ur.x ? { x, y } : null;
}

/**
 * Find intersection of segment [pp, cp] with box bb.
 * pp is inside/on the box; cp is outside. Tries four sides in C order.
 * The slope-scaled delta is rounded with C `round()` (half away from zero),
 * NOT Math.round: the delta is negative whenever the cluster wall lies
 * below/left of the endpoint, and dot node coords are integers here, so
 * exact .5 ties are routine.
 *
 * @see lib/dotgen/compound.c:boxIntersectf
 */
export function boxIntersectf(pp: Point, cp: Point, bb: Box): Point {
  return (
    tryLeftSide(pp, cp, bb) ??
    tryRightSide(pp, cp, bb) ??
    tryBottomSide(pp, cp, bb) ??
    tryTopSide(pp, cp, bb) ??
    { x: pp.x, y: pp.y } // fallback: C asserts; TS degrades gracefully
  );
}
