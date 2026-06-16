// SPDX-License-Identifier: EPL-2.0

/**
 * Low-level Bezier geometry helpers ported from lib/common/splines.c
 * and lib/common/geomprocs.h.
 *
 * @see lib/common/splines.c:bezier_clip
 * @see lib/common/geomprocs.h
 */

import type { Point, Box } from '../model/geom.js';

// ---------------------------------------------------------------------------
// Approximate equality
// ---------------------------------------------------------------------------

/**
 * Returns true if distance-squared between p and q is less than tol^2.
 * @see lib/common/geom.h:APPROXEQPT
 */
export function approxEqPt(p: Point, q: Point, tol: number): boolean {
  const dx = p.x - q.x;
  const dy = p.y - q.y;
  return dx * dx + dy * dy < tol * tol;
}

// ---------------------------------------------------------------------------
// Bezier evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluates cubic Bezier sp[] at parameter t.
 * When left !== null, fills left[0..3] with the left subdivision.
 * When right !== null, fills right[0..3] with the right subdivision.
 * Returns the point on the curve.
 *
 * @see lib/common/geomprocs.h:Bezier
 */
export function evalBezier(
  sp: Point[],
  t: number,
  left: Point[] | null,
  right: Point[] | null,
): Point {
  const ab: Point = { x: sp[0].x + t * (sp[1].x - sp[0].x), y: sp[0].y + t * (sp[1].y - sp[0].y) };
  const bc: Point = { x: sp[1].x + t * (sp[2].x - sp[1].x), y: sp[1].y + t * (sp[2].y - sp[1].y) };
  const cd: Point = { x: sp[2].x + t * (sp[3].x - sp[2].x), y: sp[2].y + t * (sp[3].y - sp[2].y) };
  const abbc: Point = { x: ab.x + t * (bc.x - ab.x), y: ab.y + t * (bc.y - ab.y) };
  const bccd: Point = { x: bc.x + t * (cd.x - bc.x), y: bc.y + t * (cd.y - bc.y) };
  const pt: Point = { x: abbc.x + t * (bccd.x - abbc.x), y: abbc.y + t * (bccd.y - abbc.y) };
  if (left !== null) {
    left[0] = sp[0]; left[1] = ab; left[2] = abbc; left[3] = pt;
  }
  if (right !== null) {
    right[0] = pt; right[1] = bccd; right[2] = cd; right[3] = sp[3];
  }
  return pt;
}

// ---------------------------------------------------------------------------
// Bounding box update
// ---------------------------------------------------------------------------

/** Maximum distance away from the chord, in points. @see lib/common/emit.c:HW */
const HW = 2.0;
/** Guard against 0/0 in ptToLine2. @see lib/common/geom.c:SMALL */
const SMALL = 0.0000000001;

/**
 * Distance from point p to line a-b, squared.
 * @see lib/common/geom.c:ptToLine2
 */
function ptToLine2(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let a2 = (p.y - a.y) * dx - (p.x - a.x) * dy;
  a2 *= a2; // square — ensures positive
  if (a2 < SMALL) return 0; // avoid 0/0 problems
  return a2 / (dx * dx + dy * dy);
}

/**
 * True when the quadrilateral cp is nearly collinear (within HW of the chord),
 * i.e. the bezier segment is sufficiently refined.
 * @see lib/common/emit.c:check_control_points
 */
function checkControlPoints(cp: Point[]): boolean {
  const dis1 = ptToLine2(cp[0], cp[3], cp[1]);
  const dis2 = ptToLine2(cp[0], cp[3], cp[2]);
  return dis1 < HW * HW && dis2 < HW * HW;
}

/** True when any control point lies outside bb. */
function anyOutside(bb: Box, cp: Point[]): boolean {
  return cp.some(p =>
    p.x > bb.ur.x || p.x < bb.ll.x || p.y > bb.ur.y || p.y < bb.ll.y);
}

/** Expand bb by the control points cp. */
function expandByPoints(bb: Box, cp: Point[]): void {
  for (const p of cp) {
    if (p.x > bb.ur.x) bb.ur.x = p.x;
    else if (p.x < bb.ll.x) bb.ll.x = p.x;
    if (p.y > bb.ur.y) bb.ur.y = p.y;
    else if (p.y < bb.ll.y) bb.ll.y = p.y;
  }
}

/**
 * Expands bb to contain the cubic Bezier segment cp by adaptively refining the
 * segment to its true curve extent (not the control hull).
 * @see lib/common/emit.c:update_bb_bz
 */
export function updateBbBz(bb: Box, cp: Point[]): void {
  if (!anyOutside(bb, cp)) return;
  if (checkControlPoints(cp)) {
    expandByPoints(bb, cp);
    return;
  }
  const left: Point[] = [];
  const right: Point[] = [];
  evalBezier(cp, 0.5, left, right);
  updateBbBz(bb, left);
  updateBbBz(bb, right);
}

// ---------------------------------------------------------------------------
// bezier_clip
// ---------------------------------------------------------------------------

/**
 * Context for inside tests — mirrors C inside_t.
 * @see lib/common/types.h:inside_t
 */
export interface InsideContext {
  /** Node coordinate (ND_coord). */
  nodeCoord: Point;
  /** Node right-width (ND_rw) — saved/restored by shape_clip0. */
  rw: number;
  /** Optional port box. */
  bp: Box | null;
  /** Node being clipped; poly_inside reads its shape info. @see inside_t.s.n */
  node?: unknown;
}

/**
 * Clips Bezier sp[0..3] to a shape boundary using binary search.
 * `leftInside` specifies that sp[0] is inside (else sp[3] is inside).
 * Mutates sp in place.
 *
 * @see lib/common/splines.c:bezier_clip
 */
export function bezierClip(
  insideCtx: InsideContext,
  insideFn: (ctx: InsideContext, p: Point) => boolean,
  sp: Point[],
  leftInside: boolean,
): void {
  // left/right subdivision results
  const seg: Point[] = [
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
  ];
  const best: Point[] = [
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
  ];
  const left = leftInside ? null : seg;
  const right = leftInside ? seg : null;
  let pt: Point = leftInside ? { x: sp[0].x, y: sp[0].y } : { x: sp[3].x, y: sp[3].y };
  let low = 0.0;
  let high = 1.0;
  let found = false;
  do {
    const opt = pt;
    const t = (high + low) / 2.0;
    pt = evalBezier(sp, t, left, right);
    if (insideFn(insideCtx, pt)) {
      if (leftInside) { low = t; } else { high = t; }
      for (let i = 0; i < 4; i++) best[i] = { x: seg[i].x, y: seg[i].y };
      found = true;
    } else {
      if (leftInside) { high = t; } else { low = t; }
    }
    // convergence check uses opt vs current pt
    if (Math.abs(opt.x - pt.x) <= 0.5 && Math.abs(opt.y - pt.y) <= 0.5) break;
  } while (true); // eslint-disable-line no-constant-condition
  const src = found ? best : seg;
  for (let i = 0; i < 4; i++) sp[i] = src[i];
}
