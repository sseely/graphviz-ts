// SPDX-License-Identifier: EPL-2.0

/**
 * Vertex computation helpers for polygon shape initialisation.
 *
 * @see lib/common/shapes.c:poly_init
 */

import type { PolygonT } from './types.js';
import type { Point } from '../model/geom.js';
import { polygonVertices, polygonRingOffsets, GAP } from './poly-sizing.js';

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

/**
 * Concentric ellipse rings, innermost first (C vertex layout
 * vertices[i + j*sides], sides = 2). The node box spans the OUTERMOST
 * ring; inner rings shrink by GAP per ring — the inverse of poly_init,
 * which grows bb to the outermost ring after placing rings outward.
 * @see lib/common/shapes.c:poly_init (ellipse peripheries, :2173-2184)
 */
function ellipseRings(w: number, h: number, peripheries: number): Point[] {
  const out: Point[] = [];
  for (let j = 0; j < peripheries; j++) {
    const inset = (peripheries - 1 - j) * GAP;
    out.push(...ellipseVertices(w - 2 * inset, h - 2 * inset));
  }
  return out;
}

/**
 * Concentric box rings, innermost first. For right-angled boxes the C
 * bisector offset is exactly GAP per axis per ring.
 * @see lib/common/shapes.c:poly_init (peripheries bisector loop)
 */
function boxRings(w: number, h: number, peripheries: number): Point[] {
  const out: Point[] = [];
  for (let j = 0; j < peripheries; j++) {
    const inset = (peripheries - 1 - j) * GAP;
    out.push(...boxVertices(w - 2 * inset, h - 2 * inset));
  }
  return out;
}

/**
 * General polygon rings, innermost first, in C's forward order: the
 * base ring is scaled to the pre-growth box, then each further ring
 * steps OUTWARD by the per-vertex bisector GAP offsets computed from
 * the base ring's angles. Without a base box (no-measurer fallback)
 * the node box is used directly, stepping inward — exact only for
 * peripheries = 1.
 * @see lib/common/shapes.c:poly_init (peripheries bisector loop)
 */
function generalPolyRings(
  poly: PolygonT,
  box: { w: number; h: number; base?: { w: number; h: number } },
  peripheries: number,
): Point[] {
  if (peripheries <= 1 || box.base === undefined) {
    return generalPolyVertices(poly, box.w, box.h);
  }
  const inner = generalPolyVertices(poly, box.base.w, box.base.h);
  const offs = polygonRingOffsets(inner, poly.sides);
  const rings: Point[][] = [inner];
  for (let j = 1; j < peripheries; j++) {
    rings.push(inner.map((v, i) =>
      ({ x: v.x + j * offs[i]!.x, y: v.y + j * offs[i]!.y })));
  }
  return rings.flat();
}

/** Choose vertex layout strategy based on polygon descriptor and size. */
export function computeVertices(
  poly: PolygonT,
  w: number,
  h: number,
  base?: { w: number; h: number },
): Point[] {
  const sides = poly.sides;
  // C generates one ring even for peripheries=0 (outp >= 1); the draw
  // loop is what skips it. @see lib/common/shapes.c:poly_init (outp)
  const peripheries = Math.max(poly.peripheries, 1);
  if (sides <= 2) return ellipseRings(w, h, peripheries);
  // C's isBox test: right angles only (diamond = orientation 45).
  if (sides === 4 && Math.abs(poly.orientation % 90) < 0.5
      && poly.distortion === 0 && poly.skew === 0) {
    return boxRings(w, h, peripheries);
  }
  return generalPolyRings(poly, { w, h, base }, peripheries);
}
