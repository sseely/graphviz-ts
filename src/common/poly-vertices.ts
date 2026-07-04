// SPDX-License-Identifier: EPL-2.0

/**
 * Vertex computation helpers for polygon shape initialisation.
 *
 * @see lib/common/shapes.c:poly_init
 */

import type { PolygonT } from './types.js';
import type { Point } from '../model/geom.js';
import { polygonVertices, polygonRingOffsets, GAP } from './poly-sizing.js';
import { CYLINDER, STAR } from './shapeData.js';

/** Compute vertices for an ellipse/circle (sides <= 2). */
export function ellipseVertices(w: number, h: number): Point[] {
  return [
    { x: -w / 2, y: -h / 2 },
    { x:  w / 2, y:  h / 2 },
  ];
}

/**
 * Cylinder control polygon: 19 Bézier control points (origin-centred), ported
 * verbatim from C's cylinder_vertices. Drawn as a bezier outline, not a polygon.
 * @see lib/common/shapes.c:4159 cylinder_vertices
 */
export function cylinderVertices(w: number, h: number): Point[] {
  const x = w / 2, y = h / 2, yr = h / 11;
  const r = (1 - 0.551784) * yr;
  const yflip = (p: Point): Point => ({ x: p.x, y: -p.y });
  // v0..v6: top-right corner, top cap arc, top-left corner.
  const v: Point[] = [
    { x, y: y - yr }, { x, y: y - r }, { x: 0.551784 * x, y },
    { x: 0, y }, { x: -0.551784 * x, y }, { x: -x, y: y - r }, { x: -x, y: y - yr },
  ];
  v.push(v[6]!, { x: -x, y: yr - y }); // v7=v6, v8 (left side down)
  v.push(v[8]!); // v9=v8
  for (let k = 5; k >= 0; k--) v.push(yflip(v[k]!)); // v10..v15: bottom = yflip(v5..v0)
  v.push(v[15]!, v[0]!, v[0]!); // v16=v15, v17=v18=v0
  return v;
}

/**
 * Compute vertices for a simple box (sides == 4, no distortion/skew).
 * Order matches C poly_init: top-right → top-left → bottom-left → bottom-right.
 * @see lib/common/shapes.c:poly_init
 */
export function boxVertices(w: number, h: number, orientation = 0): Point[] {
  // C computes vertices[0] with the orientation rotation, then forces the other
  // three corners symmetric about it. For a box, orientation is a multiple of 90
  // (the isBox test), so vertices[0] steps TR->TL->BL->BR as orientation goes
  // 0->90->180->270 — same rectangle, different starting corner (hence
  // structural-match, not diverged). orientation=0 is the fixed order below.
  // @see lib/common/shapes.c:poly_init (2244-2268, isBox symmetry)
  const corners: Point[] = [
    { x:  w / 2, y:  h / 2 },  // TR — orientation 0
    { x: -w / 2, y:  h / 2 },  // TL — orientation 90
    { x: -w / 2, y: -h / 2 },  // BL — orientation 180
    { x:  w / 2, y: -h / 2 },  // BR — orientation 270
  ];
  const k = ((Math.round(orientation / 90) % 4) + 4) % 4;
  const p = corners[k]!;
  return [
    { x:  p.x, y:  p.y },
    { x: -p.x, y:  p.y },
    { x: -p.x, y: -p.y },
    { x:  p.x, y: -p.y },
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
function boxRings(w: number, h: number, peripheries: number, orientation: number): Point[] {
  const out: Point[] = [];
  for (let j = 0; j < peripheries; j++) {
    const inset = (peripheries - 1 - j) * GAP;
    out.push(...boxVertices(w - 2 * inset, h - 2 * inset, orientation));
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

/**
 * Star (5-pointed) base vertices: 10 points alternating an outer radius `r` and
 * inner radius `r0`, shifted down by `offset`. The box is first scaled to the
 * star aspect ratio (the `a < aspect` branch grows only the unused y extent).
 * @see lib/common/shapes.c:star_vertices (alpha = PI/10)
 */
export function starVertices(w: number, h: number): Point[] {
  const alpha = Math.PI / 10;
  const alpha2 = 2 * alpha, alpha3 = 3 * alpha, alpha4 = 2 * alpha2;
  let szx = w;
  const aspect = (1 + Math.sin(alpha3)) / (2 * Math.cos(alpha));
  if (h / szx > aspect) szx = h / aspect;
  const r = szx / (2 * Math.cos(alpha));
  const r0 = (r * Math.cos(alpha) * Math.cos(alpha4)) / (Math.sin(alpha4) * Math.cos(alpha2));
  const offset = (r * (1 - Math.sin(alpha3))) / 2;
  const v: Point[] = [];
  let theta = alpha;
  for (let i = 0; i < 10; i += 2) {
    v.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) - offset });
    theta += alpha2;
    v.push({ x: r0 * Math.cos(theta), y: r0 * Math.sin(theta) - offset });
    theta += alpha2;
  }
  return v;
}

/** Star periphery rings — like generalPolyRings but over the 10 star vertices. */
function starRings(
  box: { w: number; h: number; base?: { w: number; h: number } },
  peripheries: number,
): Point[] {
  if (peripheries <= 1 || box.base === undefined) return starVertices(box.w, box.h);
  const inner = starVertices(box.base.w, box.base.h);
  const offs = polygonRingOffsets(inner, 10);
  const rings: Point[][] = [inner];
  for (let j = 1; j < peripheries; j++) {
    rings.push(inner.map((v, i) => ({ x: v.x + j * offs[i]!.x, y: v.y + j * offs[i]!.y })));
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
  // Cylinder is a 19-point bezier control polygon, not a regular 19-gon.
  if (poly.option.shape === CYLINDER) return cylinderVertices(w, h);
  // C generates one ring even for peripheries=0 (outp >= 1); the draw
  // loop is what skips it. @see lib/common/shapes.c:poly_init (outp)
  const peripheries = Math.max(poly.peripheries, 1);
  if (poly.option.shape === STAR) return starRings({ w, h, base }, peripheries);
  if (sides <= 2) return ellipseRings(w, h, peripheries);
  // C's isBox test: right angles only (diamond = orientation 45).
  if (sides === 4 && Math.abs(poly.orientation % 90) < 0.5
      && poly.distortion === 0 && poly.skew === 0) {
    return boxRings(w, h, peripheries, poly.orientation);
  }
  return generalPolyRings(poly, { w, h, base }, peripheries);
}
