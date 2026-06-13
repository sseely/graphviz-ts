// SPDX-License-Identifier: EPL-2.0

/**
 * Box-sequence spline routing, ported from lib/common/routespl.c.
 *
 * @see lib/common/routespl.c:routesplines
 * @see lib/common/routespl.c:routepolylines
 * @see lib/common/routespl.c:checkpath
 * @see lib/common/routespl.c:limitBoxes
 */

import type { Point, Box } from '../model/geom.js';
import type { Path } from './types.js';
import { shortestPath, routeSpline, makePolyline } from '../pathplan/index.js';
import type { Poly } from '../pathplan/types.js';
import { INIT_DELTA, LOOP_TRIES, ROUTESPL_FUDGE } from './splines-constants.js';

// ---------------------------------------------------------------------------
// overlap helper
// ---------------------------------------------------------------------------

/** @see lib/common/routespl.c:overlap */
function overlap(i0: number, i1: number, j0: number, j1: number): number {
  if (i1 <= j0 || i0 >= j1) return 0;
  if (i0 <= j0 && i1 >= j1) return i1 - i0;
  if (j0 <= i0 && j1 >= i1) return j1 - j0;
  if (j0 <= i0) return j1 - i0;
  return i1 - j0;
}

// ---------------------------------------------------------------------------
// checkpath helpers
// ---------------------------------------------------------------------------

/** Remove degenerate boxes and return new count. */
function removeDegenerateBoxes(boxes: Box[], boxn: number): number {
  let i = 0;
  for (let bi = 0; bi < boxn; bi++) {
    if (Math.abs(boxes[bi].ll.y - boxes[bi].ur.y) < 0.01) continue;
    if (Math.abs(boxes[bi].ll.x - boxes[bi].ur.x) < 0.01) continue;
    boxes[i] = boxes[bi];
    i++;
  }
  return i;
}

/** Repair two non-adjacent boxes by swapping the offending edges. */
function repairFirstError(
  ba: Box, bb: Box, l: number, r: number, d: number, u: number,
): [number, number, number, number] {
  if (l === 1) { const xy = ba.ur.x; ba.ur.x = bb.ll.x; bb.ll.x = xy; l = 0; }
  else if (r === 1) { const xy = ba.ll.x; ba.ll.x = bb.ur.x; bb.ur.x = xy; r = 0; }
  else if (d === 1) { const xy = ba.ur.y; ba.ur.y = bb.ll.y; bb.ll.y = xy; d = 0; }
  else if (u === 1) { const xy = ba.ll.y; ba.ll.y = bb.ur.y; bb.ur.y = xy; u = 0; }
  return [l, r, d, u];
}

/** Repair remaining errors by splitting at midpoint. */
function repairMidpoint(
  ba: Box, bb: Box, l: number, r: number, d: number, u: number,
): void {
  if (l === 1) { const xy = (ba.ur.x + bb.ll.x) / 2 + 0.5; ba.ur.x = bb.ll.x = xy; }
  else if (r === 1) { const xy = (ba.ll.x + bb.ur.x) / 2 + 0.5; ba.ll.x = bb.ur.x = xy; }
  else if (d === 1) { const xy = (ba.ur.y + bb.ll.y) / 2 + 0.5; ba.ur.y = bb.ll.y = xy; }
  else if (u === 1) { const xy = (ba.ll.y + bb.ur.y) / 2 + 0.5; ba.ll.y = bb.ur.y = xy; }
}

/** Repair the pair (ba, bb) for any non-touch/overlap errors. */
function repairBoxPair(ba: Box, bb: Box): void {
  let l = ba.ur.x < bb.ll.x ? 1 : 0;
  let r = ba.ll.x > bb.ur.x ? 1 : 0;
  let d = ba.ur.y < bb.ll.y ? 1 : 0;
  let u = ba.ll.y > bb.ur.y ? 1 : 0;
  const errs = l + r + d + u;
  if (errs === 0) return;
  [l, r, d, u] = repairFirstError(ba, bb, l, r, d, u);
  for (let j = 0; j < errs - 1; j++) repairMidpoint(ba, bb, l, r, d, u);
}

/** Resolve overlapping boxes by trimming the larger one. */
function resolveOverlap(ba: Box, bb: Box, xov: number, yov: number): void {
  if (xov < yov) {
    if (ba.ur.x - ba.ll.x > bb.ur.x - bb.ll.x) {
      if (ba.ur.x < bb.ur.x) ba.ur.x = bb.ll.x; else ba.ll.x = bb.ur.x;
    } else {
      if (ba.ur.x < bb.ur.x) bb.ll.x = ba.ur.x; else bb.ur.x = ba.ll.x;
    }
  } else {
    if (ba.ur.y - ba.ll.y > bb.ur.y - bb.ll.y) {
      if (ba.ur.y < bb.ur.y) ba.ur.y = bb.ll.y; else ba.ll.y = bb.ur.y;
    } else {
      if (ba.ur.y < bb.ur.y) bb.ll.y = ba.ur.y; else bb.ur.y = ba.ll.y;
    }
  }
}

/** Clamp point p to lie within box. */
function clampPoint(p: Point, box: Box): void {
  if (p.x < box.ll.x || p.x > box.ur.x || p.y < box.ll.y || p.y > box.ur.y) {
    p.x = Math.min(Math.max(p.x, box.ll.x), box.ur.x);
    p.y = Math.min(Math.max(p.y, box.ll.y), box.ur.y);
  }
}

// ---------------------------------------------------------------------------
// checkPath
// ---------------------------------------------------------------------------

/**
 * Repairs minor errors in the box path (gaps, slight overlaps).
 * Returns true on hard failure; false on success.
 * Mutates boxes[] and pp in place.
 *
 * @see lib/common/routespl.c:checkpath
 */
export function checkPath(boxn: number, boxes: Box[], pp: Path): boolean {
  const bn = removeDegenerateBoxes(boxes, boxn);
  if (boxes[0].ll.x > boxes[0].ur.x || boxes[0].ll.y > boxes[0].ur.y) return true;

  for (let bi = 0; bi + 1 < bn; bi++) {
    const ba = boxes[bi];
    const bb = boxes[bi + 1];
    if (bb.ll.x > bb.ur.x || bb.ll.y > bb.ur.y) return true;
    repairBoxPair(ba, bb);
    const xov = overlap(ba.ll.x, ba.ur.x, bb.ll.x, bb.ur.x);
    const yov = overlap(ba.ll.y, ba.ur.y, bb.ll.y, bb.ur.y);
    if (xov > 0 && yov > 0) resolveOverlap(ba, bb, xov, yov);
  }

  clampPoint(pp.start.p, boxes[0]);
  clampPoint(pp.end.p, boxes[bn - 1]);
  pp.nbox = bn;
  return false;
}

// ---------------------------------------------------------------------------
// limitBoxes helpers
// ---------------------------------------------------------------------------

/** Evaluate de Casteljau subdivision to get a point on a cubic Bezier. */
function deCasteljauPoint(
  p0: Point, p1: Point, p2: Point, p3: Point, t: number,
): Point {
  const ax = p0.x + t * (p1.x - p0.x);
  const ay = p0.y + t * (p1.y - p0.y);
  const bx = p1.x + t * (p2.x - p1.x);
  const by = p1.y + t * (p2.y - p1.y);
  const cx = p2.x + t * (p3.x - p2.x);
  const cy = p2.y + t * (p3.y - p2.y);
  const dx = ax + t * (bx - ax);
  const dy = ay + t * (by - ay);
  const ex = bx + t * (cx - bx);
  const ey = by + t * (cy - by);
  return { x: dx + t * (ex - dx), y: dy + t * (ey - dy) };
}

/** Update box x-extents for a sample point if it lies in the y-band. */
function updateBoxExtents(boxes: Box[], boxn: number, sp: Point): void {
  for (let bi = 0; bi < boxn; bi++) {
    if (sp.y <= boxes[bi].ur.y + ROUTESPL_FUDGE &&
        sp.y >= boxes[bi].ll.y - ROUTESPL_FUDGE) {
      if (sp.x < boxes[bi].ll.x) boxes[bi].ll.x = sp.x;
      if (sp.x > boxes[bi].ur.x) boxes[bi].ur.x = sp.x;
    }
  }
}

/** Sample one cubic Bezier segment at numDiv+1 points. */
function sampleBezierSegment(
  boxes: Box[], boxn: number, pps: Point[],
  splinepi: number, numDiv: number,
): void {
  const p0 = pps[splinepi];
  const p1 = pps[splinepi + 1];
  const p2 = pps[splinepi + 2];
  const p3 = pps[splinepi + 3];
  for (let si = 0; si <= numDiv; si++) {
    const sp = deCasteljauPoint(p0, p1, p2, p3, si / numDiv);
    updateBoxExtents(boxes, boxn, sp);
  }
}

// ---------------------------------------------------------------------------
// limitBoxes
// ---------------------------------------------------------------------------

/**
 * Samples the spline to determine the x-extent of each box.
 * Called after routing to shrink boxes for better space reclamation.
 *
 * @see lib/common/routespl.c:limitBoxes
 */
export function limitBoxes(
  boxes: Box[],
  boxn: number,
  pps: Point[],
  pn: number,
  delta: number,
): void {
  const numDiv = Math.round(delta * boxn);
  for (let splinepi = 0; splinepi + 3 < pn; splinepi += 3) {
    sampleBezierSegment(boxes, boxn, pps, splinepi, numDiv);
  }
}

// ---------------------------------------------------------------------------
// Box → polygon conversion
// ---------------------------------------------------------------------------

function addForwardCorner(
  polypoints: Point[], boxes: Box[], bi: number, prev: number, next: number,
): boolean {
  if (prev !== next) {
    if (next === -1 || prev === 1) {
      polypoints.push({ x: boxes[bi].ll.x, y: boxes[bi].ur.y });
      polypoints.push({ x: boxes[bi].ll.x, y: boxes[bi].ll.y });
    } else {
      polypoints.push({ x: boxes[bi].ur.x, y: boxes[bi].ll.y });
      polypoints.push({ x: boxes[bi].ur.x, y: boxes[bi].ur.y });
    }
  } else if (prev === 0) {
    polypoints.push({ x: boxes[bi].ll.x, y: boxes[bi].ur.y });
    polypoints.push({ x: boxes[bi].ll.x, y: boxes[bi].ll.y });
  } else {
    if (!(prev === -1 && next === -1)) return false;
  }
  return true;
}

function addReverseCorner(
  polypoints: Point[], boxes: Box[], bi: number, prev: number, next: number,
): boolean {
  if (prev !== next) {
    if (next === -1 || prev === 1) {
      polypoints.push({ x: boxes[bi].ll.x, y: boxes[bi].ur.y });
      polypoints.push({ x: boxes[bi].ll.x, y: boxes[bi].ll.y });
    } else {
      polypoints.push({ x: boxes[bi].ur.x, y: boxes[bi].ll.y });
      polypoints.push({ x: boxes[bi].ur.x, y: boxes[bi].ur.y });
    }
  } else if (prev === 0) {
    polypoints.push({ x: boxes[bi].ur.x, y: boxes[bi].ll.y });
    polypoints.push({ x: boxes[bi].ur.x, y: boxes[bi].ur.y });
  } else {
    if (!(prev === -1 && next === -1)) return false;
    polypoints.push({ x: boxes[bi].ur.x, y: boxes[bi].ll.y });
    polypoints.push({ x: boxes[bi].ur.x, y: boxes[bi].ur.y });
    polypoints.push({ x: boxes[bi].ll.x, y: boxes[bi].ur.y });
    polypoints.push({ x: boxes[bi].ll.x, y: boxes[bi].ll.y });
  }
  return true;
}

/** Build the containing polygon from the box sequence. */
function buildPolyPoints(boxes: Box[], boxn: number): Point[] | null {
  const polypoints: Point[] = [];
  for (let bi = 0; bi < boxn; bi++) {
    const prev = bi > 0 ? (boxes[bi].ll.y > boxes[bi - 1].ll.y ? -1 : 1) : 0;
    const next = bi + 1 < boxn ? (boxes[bi + 1].ll.y > boxes[bi].ll.y ? 1 : -1) : 0;
    if (!addForwardCorner(polypoints, boxes, bi, prev, next)) return null;
  }
  for (let bi = boxn - 1; bi >= 0; bi--) {
    const prev = bi + 1 < boxn ? (boxes[bi].ll.y > boxes[bi + 1].ll.y ? -1 : 1) : 0;
    const next = bi > 0 ? (boxes[bi - 1].ll.y > boxes[bi].ll.y ? 1 : -1) : 0;
    if (!addReverseCorner(polypoints, boxes, bi, prev, next)) return null;
  }
  return polypoints;
}

// ---------------------------------------------------------------------------
// Flip helpers
// ---------------------------------------------------------------------------

function flipBoxesY(boxes: Box[], boxn: number): void {
  for (let bi = 0; bi < boxn; bi++) {
    const v = boxes[bi].ur.y;
    boxes[bi].ur.y = -boxes[bi].ll.y;
    boxes[bi].ll.y = -v;
  }
}

function flipPointsY(polypoints: Point[]): void {
  for (const p of polypoints) p.y *= -1;
}

// ---------------------------------------------------------------------------
// routeSplines_ (internal)
// ---------------------------------------------------------------------------

function buildEdgesFromPoly(polypoints: Point[]): Array<{ a: Point; b: Point }> {
  return polypoints.map((pt, idx) => ({
    a: pt,
    b: polypoints[(idx + 1) % polypoints.length],
  }));
}

function buildConstraintVectors(pp: Path): [Point, Point] {
  const evs: [Point, Point] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  if (pp.start.constrained) {
    evs[0] = { x: Math.cos(pp.start.theta), y: Math.sin(pp.start.theta) };
  }
  if (pp.end.constrained) {
    evs[1] = { x: -Math.cos(pp.end.theta), y: -Math.sin(pp.end.theta) };
  }
  return evs;
}

function isTriviallyBounded(ps: Point[]): boolean {
  const isHoriz = ps.every(p => Math.abs(ps[0].y - p.y) <= ROUTESPL_FUDGE);
  const isVert = ps.every(p => Math.abs(ps[0].x - p.x) <= ROUTESPL_FUDGE);
  return isHoriz || isVert;
}

function applyTrivialBounds(boxes: Box[], boxn: number, ps: Point[]): void {
  for (let i = 0; i < boxn; i++) {
    boxes[i].ll.x = ps[0].x;
    boxes[i].ur.x = ps[0].x;
  }
}

/** Run limitBoxes loop until all boxes are bounded or LOOP_TRIES exhausted. */
function runLimitLoop(
  boxes: Box[], boxn: number, ps: Point[],
  initLlx: number, initUrx: number,
): void {
  let delta = INIT_DELTA;
  let unbounded = true;
  for (let cnt = 0; unbounded && cnt < LOOP_TRIES; cnt++) {
    limitBoxes(boxes, boxn, ps, ps.length, delta);
    let allBounded = true;
    for (let bi = 0; bi < boxn; bi++) {
      if (boxes[bi].ll.x === initLlx || boxes[bi].ur.x === initUrx) {
        delta *= 2;
        allBounded = false;
        break;
      }
    }
    if (allBounded) unbounded = false;
  }
}

function routeSplinesInternal(pp: Path, polyline: boolean): Point[] | null {
  const boxes = pp.boxes;
  if (checkPath(pp.nbox, boxes, pp)) return null;
  const effectiveBoxn = pp.nbox;

  let flip = false;
  if (effectiveBoxn > 1 && boxes[0].ll.y > boxes[1].ll.y) {
    flip = true;
    flipBoxesY(boxes, effectiveBoxn);
  }

  const polypoints = buildPolyPoints(boxes, effectiveBoxn);
  if (polypoints === null) return null;

  if (flip) {
    flipBoxesY(boxes, effectiveBoxn);
    flipPointsY(polypoints);
  }

  const INITIAL_LLX = Number.MAX_VALUE;
  const INITIAL_URX = -Number.MAX_VALUE;
  for (let bi = 0; bi < effectiveBoxn; bi++) {
    boxes[bi].ll.x = INITIAL_LLX;
    boxes[bi].ur.x = INITIAL_URX;
  }

  const poly: Poly = { ps: polypoints };
  const eps: [Point, Point] = [
    { x: pp.start.p.x, y: pp.start.p.y },
    { x: pp.end.p.x, y: pp.end.p.y },
  ];
  const pl = shortestPath(poly, eps);
  if (pl === null) return null;

  let ps: Point[];
  if (polyline) {
    ps = makePolyline(pl);
  } else {
    const edges = buildEdgesFromPoly(polypoints);
    const evs = buildConstraintVectors(pp);
    ps = routeSpline(edges, pl, evs);
    if (ps.length === 0) return null;
  }

  if (isTriviallyBounded(ps)) {
    applyTrivialBounds(boxes, effectiveBoxn, ps);
    return ps;
  }

  runLimitLoop(boxes, effectiveBoxn, ps, INITIAL_LLX, INITIAL_URX);

  // fallback if still unbounded after LOOP_TRIES
  const anyUnbounded = boxes.slice(0, effectiveBoxn).some(
    b => b.ll.x === INITIAL_LLX || b.ur.x === INITIAL_URX,
  );
  if (anyUnbounded) {
    const polyspl = makePolyline(pl);
    limitBoxes(boxes, effectiveBoxn, polyspl, polyspl.length, INIT_DELTA);
  }

  return ps;
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/**
 * Routes a spline through the box sequence in pp.
 * Returns control points or null on failure.
 *
 * @see lib/common/routespl.c:routesplines
 */
export function routeSplines(pp: Path): Point[] | null {
  return routeSplinesInternal(pp, false);
}

/**
 * Routes a polyline through the box sequence in pp.
 * Returns control points or null on failure.
 *
 * @see lib/common/routespl.c:routepolylines
 */
export function routePolylines(pp: Path): Point[] | null {
  return routeSplinesInternal(pp, true);
}
