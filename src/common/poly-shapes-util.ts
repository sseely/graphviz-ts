// SPDX-License-Identifier: EPL-2.0
//
// Shared helpers for the special node-shape renderers (poly-shapes-cases.ts),
// ported from C's round_corners support code (lib/common/shapes.c). The case
// functions build a `D[]` vertex array from the box vertices `AF[]` and the
// bevel polygon `B[]`, then render through the coord-add + transform adapters.

import type { Point } from '../model/geom.js';
import type { RenderJob } from '../gvc/job.js';
import type { RendererPlugin } from '../gvc/context.js';
import { transformPoint } from '../gvc/device.js';
import { BOX3D, COMPONENT, DOGEAR } from './shapeData.js';

/** Minimal render context for a special shape (subset of RingCtx). */
export interface ShapeCtx {
  renderer: RendererPlugin;
  job: RenderJob;
}

/** @see lib/common/shapes.c:30 RBCONST */
const RBCONST = 12;
/** @see lib/common/shapes.c:31 RBCURVE (rounded-corner curve offset) */
const RBCURVE = 0.5;

/** @see lib/common/geomprocs.h interpolate_pointf: p + t*(q-p) */
export function interpolatePoint(t: number, p: Point, q: Point): Point {
  return { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) };
}

/** Componentwise point add / subtract (C does these inline). */
export function vadd(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function vsub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** mid_x(AF): X midpoint of the AF[0]-AF[1] edge. @see shapes.c:687 */
export function midX(af: Point[]): number {
  return (af[0]!.x + af[1]!.x) / 2;
}

/** mid_y(&AF[1]): Y midpoint of the AF[1]-AF[2] edge. @see shapes.c:696 */
export function midY1(af: Point[]): number {
  return (af[1]!.y + af[2]!.y) / 2;
}

/**
 * The recurring "dsDNA" centre line shared by the SBOLv shapes:
 * from (AF[1].x, midY) to (AF[0].x, AF[2].y + (AF[0].y-AF[3].y)/2).
 * @see lib/common/shapes.c (e.g. :949-953, :1026-1030)
 */
export function dsDnaLine(af: Point[]): [Point, Point] {
  return [
    { x: af[1]!.x, y: midY1(af) },
    { x: af[0]!.x, y: af[2]!.y + (af[0]!.y - af[3]!.y) / 2 },
  ];
}

/** Axis-aligned rectangle [TL→TR→BR→BL] from a corner + width/height. */
export function rect(x: number, y: number, w: number, h: number): Point[] {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

/** dsDNA-line Y on the right end: AF[2].y + (AF[0].y-AF[3].y)/2. */
export function dnaY(af: Point[]): number {
  return af[2]!.y + (af[0]!.y - af[3]!.y) / 2;
}

/** Next vertex (wrapping to index 0 on the last side). */
function nextV(af: Point[], seg: number, sides: number): Point {
  return seg + 1 < sides ? af[seg + 1]! : af[0]!;
}

/**
 * Build the bevel/inset polygon B[]: per side, the corner (or, when `rounded`,
 * an inset curve start) plus the interpolated points at t and 1-t (and, when
 * rounded, a trailing 1-RBCURVE*t point); then the first three points are
 * repeated as a wrap. Non-rounded → 3*sides+3 points; rounded → 4*sides+3.
 * @see lib/common/shapes.c:566 alloc_interpolation_points
 */
export function interpolationPoints(
  af: Point[], sides: number, shape: number, rounded = false,
): Point[] {
  let rbconst = RBCONST;
  for (let seg = 0; seg < sides; seg++) {
    const p0 = af[seg]!;
    const p1 = nextV(af, seg, sides);
    rbconst = Math.min(rbconst, Math.hypot(p1.x - p0.x, p1.y - p0.y) / 3);
  }
  const b: Point[] = [];
  for (let seg = 0; seg < sides; seg++) {
    const p0 = af[seg]!;
    const p1 = nextV(af, seg, sides);
    let t = rbconst / Math.hypot(p1.x - p0.x, p1.y - p0.y);
    if (shape === BOX3D || shape === COMPONENT) t /= 3;
    else if (shape === DOGEAR) t /= 2;
    b.push(rounded ? interpolatePoint(RBCURVE * t, p0, p1) : p0);
    b.push(interpolatePoint(t, p0, p1), interpolatePoint(1 - t, p0, p1));
    if (rounded) b.push(interpolatePoint(1 - RBCURVE * t, p0, p1));
  }
  b.push(b[0]!, b[1]!, b[2]!);
  return b;
}

/** Render a custom polygon (node-relative pts → coord-add + device transform). */
export function renderShapePolygon(
  pts: Point[], coord: Point, ctx: ShapeCtx, filled: boolean,
): void {
  const dev = pts.map((v) => transformPoint({ x: v.x + coord.x, y: v.y + coord.y }, ctx.job));
  ctx.renderer.polygon(dev, filled, ctx.job);
}

/** Render a custom polyline (node-relative pts → coord-add + device transform). */
export function renderShapePolyline(pts: Point[], coord: Point, ctx: ShapeCtx): void {
  const dev = pts.map((v) => transformPoint({ x: v.x + coord.x, y: v.y + coord.y }, ctx.job));
  ctx.renderer.polyline(dev, ctx.job);
}

/** Render a Bézier curve (node-relative control pts → coord-add + transform). */
export function renderShapeBezier(pts: Point[], coord: Point, ctx: ShapeCtx, filled: boolean): void {
  const dev = pts.map((v) => transformPoint({ x: v.x + coord.x, y: v.y + coord.y }, ctx.job));
  ctx.renderer.bezier(dev, filled, ctx.job);
}
