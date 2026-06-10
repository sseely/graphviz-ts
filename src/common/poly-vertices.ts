// SPDX-License-Identifier: EPL-2.0

/**
 * Vertex computation helpers for polygon shape initialisation.
 *
 * @see lib/common/shapes.c:poly_init
 */

import type { PolygonT } from './types.js';
import type { Point } from '../model/geom.js';
import { polygonVertices } from './poly-sizing.js';

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
export function generalPolyVertices(poly: PolygonT, w: number, h: number): Point[] {
  // C computes the unit ring (distort/skew/orient), then scales so its
  // extents exactly span the node box. @see shapes.c:poly_init (scale)
  const { verts, xmax, ymax } = polygonVertices(
    { x: w, y: h },
    {
      sides: poly.sides,
      orientation: poly.orientation,
      distortion: poly.distortion,
      skew: poly.skew,
    },
    false,
  );
  const sx = xmax !== 0 ? w / (2 * xmax) : 1;
  const sy = ymax !== 0 ? h / (2 * ymax) : 1;
  return verts.map((v) => ({ x: v.x * sx, y: v.y * sy }));
}

/** Choose vertex layout strategy based on polygon descriptor and size. */
export function computeVertices(poly: PolygonT, w: number, h: number): Point[] {
  const sides = poly.sides;
  if (sides <= 2) return ellipseVertices(w, h);
  // C's isBox test: right angles only (diamond = orientation 45).
  if (sides === 4 && Math.abs(poly.orientation % 90) < 0.5
      && poly.distortion === 0 && poly.skew === 0) {
    return boxVertices(w, h);
  }
  return generalPolyVertices(poly, w, h);
}
