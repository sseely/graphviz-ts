// SPDX-License-Identifier: EPL-2.0

/**
 * Polygon construction and spline routing from path boxes.
 *
 * Ports the box-to-polygon conversion and spline fitting sections of
 * routesplines_ in the C source.
 *
 * @see lib/common/routespl.c:routesplines_
 */

import type { Point, Box } from '../../model/geom.js';
import { routeSpline } from '../../pathplan/route.js';
import { shortestPath } from '../../pathplan/shortest.js';
import type { Edge as BarrierEdge } from '../../pathplan/types.js';

// ---------------------------------------------------------------------------
// Forward and reverse polygon passes
// @see lib/common/routespl.c:routesplines_ (post-flip forward/reverse loops)
// ---------------------------------------------------------------------------

/**
 * Compute prev/next direction codes for the forward pass at box bi.
 * next=1 when next box ll.y is greater (path goes "right-then-down").
 * @see lib/common/routespl.c:routesplines_ (forward loop direction logic)
 */
function fwdDirs(boxes: Box[], bi: number): { prev: number; next: number } {
  const n = boxes.length;
  const prev = bi > 0 ? (boxes[bi].ll.y > boxes[bi - 1].ll.y ? -1 : 1) : 0;
  const next = bi + 1 < n ? (boxes[bi + 1].ll.y > boxes[bi].ll.y ? 1 : -1) : 0;
  return { prev, next };
}

/**
 * Emit polygon points for one box in the forward pass.
 * @see lib/common/routespl.c:routesplines_ (forward loop body)
 */
function emitFwdBox(b: Box, prev: number, next: number, pts: Point[]): void {
  if (prev !== next) {
    if (next === -1 || prev === 1) {
      pts.push({ x: b.ll.x, y: b.ur.y }, { x: b.ll.x, y: b.ll.y });
    } else {
      pts.push({ x: b.ur.x, y: b.ll.y }, { x: b.ur.x, y: b.ur.y });
    }
  } else if (prev === 0) {
    pts.push({ x: b.ll.x, y: b.ur.y }, { x: b.ll.x, y: b.ll.y });
  }
  // prev === next === -1: no points added (straight section)
}

/**
 * Forward pass: right-side polygon vertices from box[0] to box[N-1].
 * @see lib/common/routespl.c:routesplines_ (forward loop)
 */
export function addForwardPolyPts(boxes: Box[], pts: Point[]): void {
  for (let bi = 0; bi < boxes.length; bi++) {
    const { prev, next } = fwdDirs(boxes, bi);
    emitFwdBox(boxes[bi], prev, next, pts);
  }
}

/**
 * Compute prev/next direction codes for the reverse pass at box bi.
 * @see lib/common/routespl.c:routesplines_ (reverse loop direction logic)
 */
function revDirs(boxes: Box[], bi: number): { prev: number; next: number } {
  const n = boxes.length;
  const prev = bi + 1 < n ? (boxes[bi].ll.y > boxes[bi + 1].ll.y ? -1 : 1) : 0;
  const next = bi > 0 ? (boxes[bi - 1].ll.y > boxes[bi].ll.y ? 1 : -1) : 0;
  return { prev, next };
}

/** Emit the four-corner case for the reverse pass all-corners branch. */
function emitAllCorners(b: Box, pts: Point[]): void {
  pts.push(
    { x: b.ur.x, y: b.ll.y }, { x: b.ur.x, y: b.ur.y },
    { x: b.ll.x, y: b.ur.y }, { x: b.ll.x, y: b.ll.y },
  );
}

/**
 * Emit polygon points for one box in the reverse pass.
 * @see lib/common/routespl.c:routesplines_ (reverse loop body)
 */
function emitRevBox(b: Box, prev: number, next: number, pts: Point[]): void {
  if (prev !== next) {
    if (next === -1 || prev === 1) {
      pts.push({ x: b.ll.x, y: b.ur.y }, { x: b.ll.x, y: b.ll.y });
    } else {
      pts.push({ x: b.ur.x, y: b.ll.y }, { x: b.ur.x, y: b.ur.y });
    }
  } else if (prev === 0) {
    pts.push({ x: b.ur.x, y: b.ll.y }, { x: b.ur.x, y: b.ur.y });
  } else {
    emitAllCorners(b, pts);
  }
}

/**
 * Reverse pass: left-side polygon vertices from box[N-1] to box[0].
 * @see lib/common/routespl.c:routesplines_ (reverse loop)
 */
export function addReversePolyPts(boxes: Box[], pts: Point[]): void {
  for (let bi = boxes.length - 1; bi >= 0; bi--) {
    const { prev, next } = revDirs(boxes, bi);
    emitRevBox(boxes[bi], prev, next, pts);
  }
}

/**
 * Convert path boxes to polygon vertices.
 *
 * Boxes are in tail→head path order. In TS SVG coords (y-down), ll.y
 * increases from tail to head — this is the C post-flip state, so the
 * forward+reverse pass logic ports directly.
 *
 * @see lib/common/routespl.c:routesplines_
 */
export function boxesToPolygon(boxes: Box[]): Point[] {
  if (boxes.length === 0) return [];
  const pts: Point[] = [];
  addForwardPolyPts(boxes, pts);
  addReversePolyPts(boxes, pts);
  return pts;
}

// ---------------------------------------------------------------------------
// computeSpline
// @see lib/common/routespl.c:routesplines_ (shortest-path + spline section)
// ---------------------------------------------------------------------------

/** Build polygon barrier edges (consecutive pairs, closed). */
export function polyEdgesFromPts(polygon: Point[]): BarrierEdge[] {
  const n = polygon.length;
  return polygon.map((a, i) => ({ a, b: polygon[(i + 1) % n] }));
}

/** Straight-line cubic Bezier with control points at 1/3 and 2/3. */
export function linearBezier(p0: Point, p3: Point): Point[] {
  return [
    p0,
    { x: p0.x + (p3.x - p0.x) / 3,       y: p0.y + (p3.y - p0.y) / 3 },
    { x: p0.x + (2 * (p3.x - p0.x)) / 3, y: p0.y + (2 * (p3.y - p0.y)) / 3 },
    p3,
  ];
}

/**
 * Fit spline via routeSpline.
 * Degenerate Beziers (P0=P1) are valid — C's Proutespline produces them
 * for straight paths with zero endpoint slopes, and bezier_clip still
 * gives correct clipping behavior.
 * @see lib/pathplan/route.c:reallyroutespline (splinefits section)
 */
export function tryRouteSpline(barriers: BarrierEdge[], wpts: Point[]): Point[] | null {
  const zero: Point = { x: 0, y: 0 };
  const raw = routeSpline(barriers, wpts, [zero, zero]);
  if (raw.length < 4) return null;
  return [raw[0] as Point, raw[1] as Point, raw[2] as Point, raw[3] as Point];
}

/**
 * Build polygon from boxes, find shortest path, fit Bezier with barriers.
 * @see lib/common/routespl.c:routesplines_
 */
export function computeSpline(boxes: Box[], startPt: Point, endPt: Point): Point[] {
  const polygon = boxesToPolygon(boxes);
  if (polygon.length < 3) return linearBezier(startPt, endPt);
  const wpts = shortestPath({ ps: polygon }, [startPt, endPt]);
  if (wpts === null || wpts.length < 2) return linearBezier(startPt, endPt);
  return tryRouteSpline(polyEdgesFromPts(polygon), wpts)
    ?? linearBezier(startPt, endPt);
}
