// SPDX-License-Identifier: EPL-2.0

/**
 * Geometric helpers for compound edge clipping — bezier subdivision,
 * crossing detection, spline/box intersection.
 *
 * @see lib/dotgen/compound.c
 */

import type { Point, Box } from '../../model/geom.js';

/** Sign comparison matching C fcmp(). @see lib/util/gv_math.h:fcmp */
export function fcmp(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** True if p is on or inside box bb. @see lib/dotgen/compound.c:inBoxf */
export function inBoxf(p: Point, bb: Box): boolean {
  return p.x >= bb.ll.x && p.x <= bb.ur.x && p.y >= bb.ll.y && p.y <= bb.ur.y;
}

/** Midpoint of two points. @see lib/common/utils.c:mid_pointf */
export function midPointf(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ---------------------------------------------------------------------------
// De Casteljau subdivision
// ---------------------------------------------------------------------------

type CasteljauRow = [Point, Point, Point, Point];

/** One De Casteljau subdivision step. */
export function casteljauStep(prev: CasteljauRow, t: number): CasteljauRow {
  const u = 1 - t;
  return [
    { x: u * prev[0].x + t * prev[1].x, y: u * prev[0].y + t * prev[1].y },
    { x: u * prev[1].x + t * prev[2].x, y: u * prev[1].y + t * prev[2].y },
    { x: u * prev[2].x + t * prev[3].x, y: u * prev[2].y + t * prev[3].y },
    { x: 0, y: 0 },
  ];
}

/** Subdivide cubic Bezier at t; return left or right half. @see lib/common/utils.c:Bezier */
export function subdivideBezier(v: readonly Point[], t: number, side: 'left' | 'right'): Point[] {
  const r0: CasteljauRow = [{ ...v[0] }, { ...v[1] }, { ...v[2] }, { ...v[3] }];
  const r1 = casteljauStep(r0, t);
  const r2 = casteljauStep(r1, t);
  const r3 = casteljauStep(r2, t);
  return side === 'left' ? [r0[0], r1[0], r2[0], r3[0]] : [r3[0], r2[1], r1[2], r0[3]];
}

// ---------------------------------------------------------------------------
// Crossing counters
// ---------------------------------------------------------------------------

/** Count control-polygon crossings of x = xcoord. */
export function countVertCross(pts: Point[], xcoord: number): number {
  let sign = fcmp(pts[0].x, xcoord);
  let count = sign === 0 ? 1 : 0;
  for (let i = 1; i <= 3; i++) {
    const old = sign; sign = fcmp(pts[i].x, xcoord);
    if (sign !== old && old !== 0) count++;
  }
  return count;
}

/** Count control-polygon crossings of y = ycoord. */
export function countHorzCross(pts: Point[], ycoord: number): number {
  let sign = fcmp(pts[0].y, ycoord);
  let count = sign === 0 ? 1 : 0;
  for (let i = 1; i <= 3; i++) {
    const old = sign; sign = fcmp(pts[i].y, ycoord);
    if (sign !== old && old !== 0) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Axis-range search — bundles coord + lo/hi bounds into one object (≤5 params)
// ---------------------------------------------------------------------------

/** Axis-range constraint for findVertical / findHorizontal. */
export interface AxisRange { coord: number; lo: number; hi: number; }

/** Extract AxisRange for the vertical sides of a box. */
export function vertRange(bb: Box, side: 'left' | 'right'): AxisRange {
  return { coord: side === 'left' ? bb.ll.x : bb.ur.x, lo: bb.ll.y, hi: bb.ur.y };
}

/** Extract AxisRange for the horizontal sides of a box. */
export function horzRange(bb: Box, side: 'bottom' | 'top'): AxisRange {
  return { coord: side === 'bottom' ? bb.ll.y : bb.ur.y, lo: bb.ll.x, hi: bb.ur.x };
}

/** nc===1 endpoint check: return tmax only if endpoint is ON the line and in range. */
export function checkVertEndpoint(p3: Point, ax: AxisRange, tmax: number): number {
  return p3.y >= ax.lo && p3.y <= ax.hi ? tmax : -1;
}

/** nc===1 endpoint check: return tmax only if endpoint is ON the line and in range. */
export function checkHorzEndpoint(p3: Point, ax: AxisRange, tmax: number): number {
  return p3.x >= ax.lo && p3.x <= ax.hi ? tmax : -1;
}

/** Subdivide-and-recurse for vertical crossing search. */
export function searchVert(pts: Point[], tmin: number, tmax: number, ax: AxisRange): number {
  const tmid = (tmin + tmax) / 2;
  const tl = findVertical(subdivideBezier(pts, 0.5, 'left'), tmin, tmid, ax);
  return tl >= 0 ? tl : findVertical(subdivideBezier(pts, 0.5, 'right'), tmid, tmax, ax);
}

/** Find first t where Bezier crosses x=ax.coord, y in [ax.lo,ax.hi]. @see lib/dotgen/compound.c:findVertical */
export function findVertical(pts: Point[], tmin: number, tmax: number, ax: AxisRange): number {
  // C's only base case is `tmin == tmax` (reached at fp underflow, after the
  // no_cross==0 / no_cross==1 branches have resolved). An earlier `tmax-tmin <
  // 1e-5` short-circuit is NOT faithful: it returns a valid t ~17 levels deep,
  // BEFORE the no_cross==1 y-range check can reject an out-of-range crossing —
  // making the tail clip accept a false positive on the box's opposite edge
  // (1879 ltail edges clipped to the cluster's right edge at a y below the box
  // instead of its bottom edge). @see lib/dotgen/compound.c:findVertical
  if (tmin === tmax) return tmin;
  const nc = countVertCross(pts, ax.coord);
  if (nc === 0) return -1;
  if (nc === 1 && Math.abs(pts[3].x - ax.coord) <= 0.005) return checkVertEndpoint(pts[3], ax, tmax);
  return searchVert(pts, tmin, tmax, ax);
}

/** Subdivide-and-recurse for horizontal crossing search. */
export function searchHorz(pts: Point[], tmin: number, tmax: number, ax: AxisRange): number {
  const tmid = (tmin + tmax) / 2;
  const tl = findHorizontal(subdivideBezier(pts, 0.5, 'left'), tmin, tmid, ax);
  return tl >= 0 ? tl : findHorizontal(subdivideBezier(pts, 0.5, 'right'), tmid, tmax, ax);
}

/** Find first t where Bezier crosses y=ax.coord, x in [ax.lo,ax.hi]. @see lib/dotgen/compound.c:findHorizontal */
export function findHorizontal(pts: Point[], tmin: number, tmax: number, ax: AxisRange): number {
  // See findVertical: C's only base case is `tmin == tmax`. @see compound.c:findHorizontal
  if (tmin === tmax) return tmin;
  const nc = countHorzCross(pts, ax.coord);
  if (nc === 0) return -1;
  if (nc === 1 && Math.abs(pts[3].y - ax.coord) <= 0.005) return checkHorzEndpoint(pts[3], ax, tmax);
  return searchHorz(pts, tmin, tmax, ax);
}

// ---------------------------------------------------------------------------
// splineIntersectf
// ---------------------------------------------------------------------------

/** Update best-t and truncate pts to that crossing. */
export function tryUpdateIntersect(t: number, tmin: number, orig: Point[], pts: Point[]): number {
  if (t < 0 || t >= tmin) return tmin;
  const left = subdivideBezier(orig, t, 'left');
  for (let i = 0; i < 4; i++) pts[i] = left[i];
  return t;
}

/**
 * Find earliest Bezier/box crossing; truncate pts to that point.
 * @see lib/dotgen/compound.c:splineIntersectf
 */
export function splineIntersectf(pts: Point[], bb: Box): boolean {
  let tmin = 2.0;
  const orig = pts.map(p => ({ ...p }));
  tmin = tryUpdateIntersect(findVertical(pts, 0, 1, vertRange(bb, 'left')), tmin, orig, pts);
  tmin = tryUpdateIntersect(findVertical(pts, 0, Math.min(1, tmin), vertRange(bb, 'right')), tmin, orig, pts);
  tmin = tryUpdateIntersect(findHorizontal(pts, 0, Math.min(1, tmin), horzRange(bb, 'bottom')), tmin, orig, pts);
  tmin = tryUpdateIntersect(findHorizontal(pts, 0, Math.min(1, tmin), horzRange(bb, 'top')), tmin, orig, pts);
  return tmin < 2.0;
}

// ---------------------------------------------------------------------------
// boxIntersectf
// ---------------------------------------------------------------------------

/** Left-side intersection of pp→cp with bb. */
export function tryLeftSide(pp: Point, cp: Point, bb: Box): Point | null {
  if (cp.x >= bb.ll.x) return null;
  const x = bb.ll.x;
  const y = pp.y + Math.round((x - pp.x) * (pp.y - cp.y) / (pp.x - cp.x));
  return y >= bb.ll.y && y <= bb.ur.y ? { x, y } : null;
}

/** Right-side intersection of pp→cp with bb. */
export function tryRightSide(pp: Point, cp: Point, bb: Box): Point | null {
  if (cp.x <= bb.ur.x) return null;
  const x = bb.ur.x;
  const y = pp.y + Math.round((x - pp.x) * (pp.y - cp.y) / (pp.x - cp.x));
  return y >= bb.ll.y && y <= bb.ur.y ? { x, y } : null;
}

/** Bottom-side intersection of pp→cp with bb. */
export function tryBottomSide(pp: Point, cp: Point, bb: Box): Point | null {
  if (cp.y >= bb.ll.y) return null;
  const y = bb.ll.y;
  const x = pp.x + Math.round((y - pp.y) * (pp.x - cp.x) / (pp.y - cp.y));
  return x >= bb.ll.x && x <= bb.ur.x ? { x, y } : null;
}

/** Top-side intersection of pp→cp with bb. */
export function tryTopSide(pp: Point, cp: Point, bb: Box): Point | null {
  if (cp.y <= bb.ur.y) return null;
  const y = bb.ur.y;
  const x = pp.x + Math.round((y - pp.y) * (pp.x - cp.x) / (pp.y - cp.y));
  return x >= bb.ll.x && x <= bb.ur.x ? { x, y } : null;
}

/**
 * Intersection of segment [pp→cp] with box bb (pp inside/on, cp outside).
 * Tries sides in C order: left, right, bottom, top. Uses Math.round().
 * @see lib/dotgen/compound.c:boxIntersectf
 */
export function boxIntersectf(pp: Point, cp: Point, bb: Box): Point {
  return tryLeftSide(pp, cp, bb)
    ?? tryRightSide(pp, cp, bb)
    ?? tryBottomSide(pp, cp, bb)
    ?? tryTopSide(pp, cp, bb)
    ?? { x: pp.x, y: pp.y };
}
