// SPDX-License-Identifier: EPL-2.0

/**
 * Point-in-shape test for polygon nodes, used by edge clipping
 * (bezier_clip via shape_clip0). Calculations use the unrotated node
 * shape centered on the origin.
 *
 * The rankdir rotation (ccwrotatepf by 90*GD_rankdir) and the GD_flip extent
 * swap ARE applied (mission-dot-splines T2 routes rankdir edges through this
 * clip). The polygon segment walk uses the outline ring at the node's resolved
 * penwidth (base + penwidth/2), matching C's outline periphery.
 *
 * @see lib/common/shapes.c:poly_inside
 * @see lib/common/shapes.c:same_side
 */

import type { Point } from '../model/geom.js';
import type { Node } from '../model/node.js';
import type { PolygonT } from './types.js';
import type { InsideContext } from './splines-geom.js';
import { polygonOutlineRing } from './poly-sizing.js';
import { ccwrotatepf } from '../model/geom.js';

/** Test if p0 and p1 are on the same side of the line L0-L1. @see shapes.c:same_side */
export function sameSide(p0: Point, p1: Point, L0: Point, L1: Point): boolean {
  const a = -(L1.y - L0.y);
  const b = L1.x - L0.x;
  const c = a * L0.x + b * L0.y;
  const s0 = a * p0.x + b * p0.y - c >= 0;
  const s1 = a * p1.x + b * p1.y - c >= 0;
  return s0 === s1;
}

/** Vertex-extent box of a fixedshape polygon. @see lib/common/shapes.c:polyBB */
function fixedShapeSize(poly: PolygonT): { w: number; h: number } {
  let xmax = 0;
  let ymax = 0;
  for (const v of poly.vertices ?? []) {
    xmax = Math.max(xmax, Math.abs(v.x));
    ymax = Math.max(ymax, Math.abs(v.y));
  }
  return { w: 2 * xmax, h: 2 * ymax };
}

/** Scale factors and outline half-extents for the inside test. */
interface InsideScale {
  scalex: number;
  scaley: number;
  boxURx: number;
  boxURy: number;
}

/** Node size + outline extents (points) for the inside scale. */
function insideDims(n: Node, poly: PolygonT, xsize: number, ysize: number):
  { w: number; h: number; ow: number; oh: number } {
  if (poly.option.fixedshape) {
    const { w, h } = fixedShapeSize(poly);
    return { w, h, ow: w, oh: h };
  }
  const w = 72 * (n.info.width || xsize / 72);
  const h = 72 * (n.info.height || ysize / 72);
  // Nodes that skipped poly_init (no measurer) have no outline dims.
  return { w, h, ow: 72 * n.info.outline_width || w, oh: 72 * n.info.outline_height || h };
}

/** @see lib/common/shapes.c:poly_inside (scale setup) */
function insideScale(n: Node, poly: PolygonT): InsideScale {
  // C swaps the node extents for flipped (LR/RL) layouts. @see poly_inside (GD_flip)
  const flip = n.root.info.flip === true;
  const lwrw = n.info.lw + n.info.rw;
  const xsize = flip ? n.info.ht : lwrw;
  const ysize = flip ? lwrw : n.info.ht;
  const { w, h, ow, oh } = insideDims(n, poly, xsize, ysize);
  return {
    scalex: xsize !== 0 ? w / xsize : w,
    scaley: ysize !== 0 ? h / ysize : h,
    boxURx: ow / 2,
    boxURy: oh / 2,
  };
}

/** Polygon segment walk over the vertex ring. @see shapes.c:poly_inside */
function polygonWalk(P: Point, vertex: Point[], sides: number): boolean {
  const O = { x: 0, y: 0 };
  let i = 0;
  let i1 = 1 % sides;
  const Q = vertex[i]!;
  const R = vertex[i1]!;
  if (!sameSide(P, O, Q, R)) return false; // outside this segment's face
  const s = sameSide(P, Q, R, O);
  if (s && sameSide(P, R, O, Q)) return true; // between the segment's sides
  for (let j = 1; j < sides; j++) {
    if (s) {
      i = i1;
      i1 = (i + 1) % sides;
    } else {
      i1 = i;
      i = (i + sides - 1) % sides;
    }
    if (!sameSide(P, O, vertex[i]!, vertex[i1]!)) return false;
  }
  return true;
}

/**
 * True when point p (relative to the node center) lies inside the
 * node's polygon shape.
 * @see lib/common/shapes.c:poly_inside
 */
/** Scaled-point shape test once the polygon descriptor is resolved. */
function insideShape(n: Node, poly: PolygonT, p: Point): boolean {
  const sc = insideScale(n, poly);
  const P = { x: p.x * sc.scalex, y: p.y * sc.scaley };
  if (Math.abs(P.x) > sc.boxURx || Math.abs(P.y) > sc.boxURy) return false;
  if (poly.sides <= 2) {
    return Math.hypot(P.x / sc.boxURx, P.y / sc.boxURy) < 1;
  }
  // C walks the outline ring (outermost periphery + penwidth/2
  // bisector offsets). @see shapes.c:poly_inside (outp selection)
  const outerStart = (Math.max(poly.peripheries, 1) - 1) * poly.sides;
  const outer = poly.vertices!.slice(outerStart, outerStart + poly.sides);
  const ring = polygonOutlineRing(outer, poly.sides, poly.penwidth ?? 1);
  return polygonWalk(P, ring, poly.sides);
}

export function polyInside(ctx: InsideContext, p: Point): boolean {
  const n = ctx.node as Node | undefined;
  if (n === undefined) return false;
  // C rotates the test point by the rank direction before testing against the
  // node's natural-frame polygon. @see shapes.c:poly_inside (ccwrotatepf)
  const rankdir = (n.root.info.rankdir ?? 0) & 0x3;
  const P = rankdir === 0 ? p : ccwrotatepf(p, rankdir * 90);
  if (ctx.bp) {
    const b = ctx.bp;
    return P.x >= b.ll.x && P.x <= b.ur.x && P.y >= b.ll.y && P.y <= b.ur.y;
  }
  const poly = n.info.shape_info as PolygonT | undefined;
  if (poly === undefined || poly.vertices === null) return false;
  return insideShape(n, poly, P);
}

/**
 * Point-in-record test: inside the field tree's bounding box, expanded
 * by half the penwidth (the outline). penwidth attr is read as default
 * 1 (no attr plumbing here; no test sets node penwidth).
 * @see lib/common/shapes.c:record_inside
 */
export function recordInside(ctx: InsideContext, p: Point): boolean {
  const n = ctx.node as Node | undefined;
  if (n === undefined) return false;
  // C converts the query point to the record's own (label) frame first:
  // ccwrotatepf(p, 90 * GD_rankdir). @see lib/common/shapes.c:record_inside
  const rankdir = (n.root.info.rankdir ?? 0) & 0x3;
  const P = rankdir === 0 ? p : ccwrotatepf(p, rankdir * 90);
  let bb: { ll: Point; ur: Point };
  if (ctx.bp) {
    bb = ctx.bp;
  } else {
    const fld = n.info.shape_info as { b?: { ll: Point; ur: Point } } | undefined;
    if (!fld?.b) return false;
    bb = fld.b;
  }
  const pw = 0.5; // DEFAULT_NODEPENWIDTH / 2
  return P.x >= bb.ll.x - pw && P.x <= bb.ur.x + pw
    && P.y >= bb.ll.y - pw && P.y <= bb.ur.y + pw;
}
