// SPDX-License-Identifier: EPL-2.0

/**
 * Geometric helpers for edge spline routing: vector math and node-box
 * ray clipping.
 *
 * @see lib/common/splines.c:clip_and_install (box-clipping logic)
 */

import type { Point } from '../../model/geom.js';

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

/** Normalize a 2-D vector; returns {0,0} if near-zero length. */
export function normalizeVec(v: Point): Point {
  const d = Math.sqrt(v.x * v.x + v.y * v.y);
  if (d < 1e-10) return { x: 0, y: 0 };
  return { x: v.x / d, y: v.y / d };
}

/** Reverse a vector. */
export function negateVec(v: Point): Point { return { x: -v.x, y: -v.y }; }

/** Offset a point by dir * scale. */
export function offsetPoint(p: Point, dir: Point, scale: number): Point {
  return { x: p.x + dir.x * scale, y: p.y + dir.y * scale };
}

// ---------------------------------------------------------------------------
// clipToNodeBox
// ---------------------------------------------------------------------------

/** Min positive t along x-axis for the given boundary half-width. */
export function xClipT(dirX: number, halfW: number): number {
  if (dirX > 0) return halfW / dirX;
  if (dirX < 0) return -halfW / dirX;
  return Infinity;
}

/** Min positive t along y-axis for the given boundary half-height. */
export function yClipT(dirY: number, halfH: number): number {
  if (dirY > 0) return halfH / dirY;
  if (dirY < 0) return -halfH / dirY;
  return Infinity;
}

/**
 * Node box dimensions bundled for clipping.
 * @see lib/common/types.h:Agnodeinfo_t (ND_lw, ND_rw, ND_ht)
 */
export interface NodeBox {
  center: Point;
  lw: number;
  rw: number;
  ht: number;
  /** True when the node shape is elliptical (sides === 1 in C poly_inside). */
  isEllipse?: boolean;
}

/**
 * Clip a ray from box.center in direction `dir` to the node boundary.
 * For ellipse nodes uses the ellipse formula; for box nodes uses the box formula.
 * @see lib/common/shapes.c:poly_inside
 */
export function clipToNodeBox(box: NodeBox, dir: Point): Point {
  if (dir.x === 0 && dir.y === 0) return { x: box.center.x, y: box.center.y };
  if (box.isEllipse) {
    const rx = (box.lw + box.rw) / 2;
    const ry = box.ht / 2;
    const fx = dir.x / rx;
    const fy = dir.y / ry;
    const d = Math.sqrt(fx * fx + fy * fy);
    if (d < 1e-10) return { x: box.center.x, y: box.center.y };
    const t = 1 / d;
    return { x: box.center.x + dir.x * t, y: box.center.y + dir.y * t };
  }
  const halfW = dir.x > 0 ? box.rw : box.lw;
  const t = Math.min(xClipT(dir.x, halfW), yClipT(dir.y, box.ht / 2));
  if (t === Infinity) return { x: box.center.x, y: box.center.y };
  return { x: box.center.x + dir.x * t, y: box.center.y + dir.y * t };
}
