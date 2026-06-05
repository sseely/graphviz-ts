// SPDX-License-Identifier: EPL-2.0

/**
 * Vertex computation helpers for polygon shape initialisation.
 *
 * @see lib/common/shapes.c:poly_init
 */

import type { PolygonT } from './types.js';
import type { Point } from '../model/geom.js';

/** Compute vertices for an ellipse/circle (sides <= 2). */
export function ellipseVertices(w: number, h: number): Point[] {
  return [
    { x: -w / 2, y: -h / 2 },
    { x:  w / 2, y:  h / 2 },
  ];
}

/**
 * Compute vertices for a simple box (sides == 4, no distortion/skew).
 * Order matches C poly_init: top-right → top-left → bottom-left → bottom-right.
 * @see lib/common/shapes.c:poly_init
 */
export function boxVertices(w: number, h: number): Point[] {
  return [
    { x:  w / 2, y:  h / 2 },  // top-right
    { x: -w / 2, y:  h / 2 },  // top-left
    { x: -w / 2, y: -h / 2 },  // bottom-left
    { x:  w / 2, y: -h / 2 },  // bottom-right
  ];
}

/**
 * Compute vertices for a regular polygon with arbitrary sides.
 *
 * Starting angle matches C poly_init: first vertex at 3π/n - π/2
 * (top-right for n=4, top for n=3).
 * @see lib/common/shapes.c:poly_init (polygon vertex loop)
 */
export function generalPolyVertices(
  sides: number,
  rx: number,
  ry: number,
  orientDeg: number,
): Point[] {
  const orient = (orientDeg * Math.PI) / 180;
  const pts: Point[] = [];
  for (let i = 0; i < sides; i++) {
    // C starts at first_angle = 3π/n - π/2 (= offset by 1.5 sectors)
    const angle = orient + (2 * Math.PI * (i + 1.5)) / sides - Math.PI / 2;
    pts.push({ x: rx * Math.cos(angle), y: ry * Math.sin(angle) });
  }
  return pts;
}

/** Choose vertex layout strategy based on polygon descriptor and size. */
export function computeVertices(poly: PolygonT, w: number, h: number): Point[] {
  const sides = poly.sides;
  if (sides <= 2) return ellipseVertices(w, h);
  if (sides === 4 && poly.distortion === 0 && poly.skew === 0) {
    return boxVertices(w, h);
  }
  return generalPolyVertices(sides, w / 2, h / 2, poly.orientation);
}
