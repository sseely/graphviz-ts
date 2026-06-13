// SPDX-License-Identifier: EPL-2.0

/**
 * Perpendicular-offset geometry for parallel multi-color edge rendering.
 *
 * Ports computeoffset_p and computeoffset_qr from lib/common/emit.c.
 * Pure data-in / data-out; no rendering or ObjState mutation.
 * Consumed by the M1 parallel-bezier branch in src/gvc/device.ts.
 *
 * @see lib/common/emit.c:1836 computeoffset_p
 * @see lib/common/emit.c:1849 computeoffset_qr
 * @see lib/common/emit.c:55   #define EPSILON 0.0001
 * @see lib/common/emit.c:2364 #define SEP 2.0
 */

import type { Point } from '../model/geom.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Epsilon guard used in the offset vector computation to keep the result
 * finite as the line-segment length approaches zero.
 * @see lib/common/emit.c:55
 */
export const OFFSET_EPSILON = 0.0001;

/**
 * Perpendicular separation between parallel color curves (in graph units).
 * @see lib/common/emit.c:2364
 */
export const PARALLEL_SEP = 2.0;

// ---------------------------------------------------------------------------
// Offset helpers
// ---------------------------------------------------------------------------

/**
 * Calculate an offset vector, length d, perpendicular to line p→q.
 * The result vector points 90° counter-clockwise from the direction p→q.
 * Formula: res = { (p.y-q.y)*d/len, -(p.x-q.x)*d/len }
 *
 * @see lib/common/emit.c:1836 computeoffset_p
 */
export function computeOffsetP(p: Point, q: Point, d: number): Point {
  const x = p.x - q.x;
  const y = p.y - q.y;
  // keep d finite as line length approaches 0
  const scale = d / Math.sqrt(x * x + y * y + OFFSET_EPSILON);
  return { x: y * scale, y: -x * scale };
}

/**
 * Calculate an offset vector, length d, perpendicular to spline p,q,r,s
 * at the middle control points q and r.  When q and r coincide (len < ε),
 * falls back to the p→s direction.
 *
 * @see lib/common/emit.c:1849 computeoffset_qr
 */
export function computeOffsetQR(p: Point, q: Point, r: Point, s: Point, d: number): Point {
  const x = q.x - r.x;
  const y = q.y - r.y;
  let len = Math.hypot(x, y);
  let cx = x;
  let cy = y;
  if (len < OFFSET_EPSILON) {
    // control points on top of each other — use slope between endpoints
    cx = p.x - s.x;
    cy = p.y - s.y;
    len = Math.sqrt(cx * cx + cy * cy + OFFSET_EPSILON);
  }
  const scale = d / len;
  return { x: cy * scale, y: -cx * scale };
}

// ---------------------------------------------------------------------------
// Build parallel-offset spline data
// ---------------------------------------------------------------------------

/**
 * One parallel-offset bezier: a clone of the bezier's control-point array
 * with every point offset by offVec × d (in-place via the tmp array).
 *
 * Returns { offlist, tmplist } for a SINGLE bezier segment with `size`
 * control points (must be 4k+1 for k cubic segments).
 *
 * Algorithm:
 *   - offlist[j]     = computeOffsetP(pf[j-1 or pf2_prev], pf[j+1], SEP)   at j=0 or next segment start
 *   - offlist[j+1/2] = computeOffsetQR(pf0,pf1,pf2,pf3, SEP)               for the two middle CPs
 *   - offlist[last]  = computeOffsetP(pf2, pf3, SEP)
 *   - tmplist[j]     = pf[j] - numc2 * offlist[j]                           (outermost lane)
 *
 * @see lib/common/emit.c:2449-2480
 */
export function buildOffsetLists(
  pts: Point[],
  numc2: number,
): { offlist: Point[]; tmplist: Point[] } {
  const size = pts.length;
  const offlist: Point[] = new Array<Point>(size).fill({ x: 0, y: 0 });
  const tmplist: Point[] = new Array<Point>(size).fill({ x: 0, y: 0 });

  let pf3 = pts[0]!;
  let pf2: Point = { x: 0, y: 0 };
  let j = 0;
  for (j = 0; j < size - 1; j += 3) {
    const pf0 = pf3;
    const pf1 = pts[j + 1]!;
    if (j === 0) {
      offlist[j] = computeOffsetP(pf0, pf1, PARALLEL_SEP);
    } else {
      offlist[j] = computeOffsetP(pf2, pf1, PARALLEL_SEP);
    }
    pf2 = pts[j + 2]!;
    pf3 = pts[j + 3]!;
    const mid = computeOffsetQR(pf0, pf1, pf2, pf3, PARALLEL_SEP);
    offlist[j + 1] = mid;
    offlist[j + 2] = mid;
    tmplist[j]     = { x: pf0.x - numc2 * offlist[j]!.x,     y: pf0.y - numc2 * offlist[j]!.y };
    tmplist[j + 1] = { x: pf1.x - numc2 * offlist[j + 1]!.x, y: pf1.y - numc2 * offlist[j + 1]!.y };
    tmplist[j + 2] = { x: pf2.x - numc2 * offlist[j + 2]!.x, y: pf2.y - numc2 * offlist[j + 2]!.y };
  }
  // last segment — no next pf1; use pf2→pf3 direction
  offlist[j] = computeOffsetP(pf2, pf3, PARALLEL_SEP);
  tmplist[j] = { x: pf3.x - numc2 * offlist[j]!.x, y: pf3.y - numc2 * offlist[j]!.y };

  return { offlist, tmplist };
}

/**
 * Advance every tmp point by one offset step (add offlist[i] to tmplist[i]).
 * Called once per color before drawing that color's curve.
 * @see lib/common/emit.c:2501-2504
 */
export function advanceTmpList(tmplist: Point[], offlist: Point[]): void {
  for (let i = 0; i < tmplist.length; i++) {
    tmplist[i] = { x: tmplist[i]!.x + offlist[i]!.x, y: tmplist[i]!.y + offlist[i]!.y };
  }
}
