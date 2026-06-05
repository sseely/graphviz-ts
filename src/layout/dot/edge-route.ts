// SPDX-License-Identifier: EPL-2.0

/**
 * Straight-line edge spline routing for dot layout.
 *
 * Computes Bezier control points and arrowhead polygons for simple
 * (non-obstacle) straight-line edges, then installs them on each edge
 * as a Spline so the SVG renderer can emit <path> and <polygon> elements.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 * @see lib/common/splines.c:clip_and_install
 * @see lib/common/arrows.c:arrow_type_normal
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge as GraphEdge } from '../../model/edge.js';
import type { Point, Bezier, Spline } from '../../model/geom.js';
import { routeSpline } from '../../pathplan/route.js';
import type { Edge as BarrierEdge } from '../../pathplan/types.js';

/** Arrow length in points. @see lib/common/arrows.c:#define ARROW_LENGTH 10. */
export const ARROW_LENGTH = 10;

/** Arrow width factor. @see lib/common/arrows.c:arrowwidth = 0.35 */
export const ARROW_WIDTH_FACTOR = 0.35;

// ---------------------------------------------------------------------------
// Vector helpers — all exported so Lizard counts them as separate functions
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
// clipToNodeBox helpers
// @see lib/common/splines.c:clip_and_install (box-clipping logic)
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
}

/**
 * Clip a ray from box.center in direction `dir` to the node box boundary.
 * @see lib/dotgen/dotsplines.c — box clipping used in clip_and_install
 */
export function clipToNodeBox(box: NodeBox, dir: Point): Point {
  if (dir.x === 0 && dir.y === 0) return { x: box.center.x, y: box.center.y };
  const halfW = dir.x > 0 ? box.rw : box.lw;
  const t = Math.min(xClipT(dir.x, halfW), yClipT(dir.y, box.ht / 2));
  if (t === Infinity) return { x: box.center.x, y: box.center.y };
  return { x: box.center.x + dir.x * t, y: box.center.y + dir.y * t };
}

// ---------------------------------------------------------------------------
// EdgeSplineResult + routeBezier
// ---------------------------------------------------------------------------

/** Result of computing a straight-line edge spline. */
export interface EdgeSplineResult {
  bezierPts: Point[];
  arrowTip: Point;
  arrowDir: Point;
}

/** Route via pathplan and return 4 control points, falling back to linear. */
export function routeBezier(from: Point, to: Point): Point[] {
  const noBarriers: BarrierEdge[] = [];
  const zero: Point = { x: 0, y: 0 };
  const raw = routeSpline(noBarriers, [from, to], [zero, zero]);
  if (raw.length < 4) return buildLinearBezier(from, to);
  const p0 = raw[0] as Point;
  const p1 = raw[1] as Point;
  if (p1.x === p0.x && p1.y === p0.y) return buildLinearBezier(from, to);
  return [p0, p1, raw[2] as Point, raw[3] as Point];
}

// ---------------------------------------------------------------------------
// straightEdgeSpline
// @see lib/dotgen/dotsplines.c:make_regular_edge (straight-line case)
// ---------------------------------------------------------------------------

/** Compute normalized tail→head direction between two node boxes. */
export function edgeDirection(tailBox: NodeBox, headBox: NodeBox): Point {
  return normalizeVec({
    x: headBox.center.x - tailBox.center.x,
    y: headBox.center.y - tailBox.center.y,
  });
}

/**
 * Compute Bezier control points and arrowhead geometry for a straight edge.
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 */
export function straightEdgeSpline(tailBox: NodeBox, headBox: NodeBox): EdgeSplineResult {
  const dir = edgeDirection(tailBox, headBox);
  const headToTail = negateVec(dir);
  const tailClip = clipToNodeBox(tailBox, dir);
  const arrowTip = clipToNodeBox(headBox, headToTail);
  const arrowBase = offsetPoint(arrowTip, headToTail, ARROW_LENGTH);
  return { bezierPts: routeBezier(tailClip, arrowBase), arrowTip, arrowDir: headToTail };
}

// ---------------------------------------------------------------------------
// buildLinearBezier
// ---------------------------------------------------------------------------

/**
 * Straight-line cubic Bezier: control points at 1/3 and 2/3 interpolation.
 * @see lib/dotgen/dotsplines.c — fallback bezier for straight-line edges
 */
export function buildLinearBezier(p0: Point, p3: Point): Point[] {
  return [
    p0,
    { x: p0.x + (p3.x - p0.x) / 3,       y: p0.y + (p3.y - p0.y) / 3 },
    { x: p0.x + (2 * (p3.x - p0.x)) / 3, y: p0.y + (2 * (p3.y - p0.y)) / 3 },
    p3,
  ];
}

// ---------------------------------------------------------------------------
// arrowheadPolygon
// @see lib/common/arrows.c:arrow_type_normal
// ---------------------------------------------------------------------------

/**
 * Three-point arrowhead polygon: [leftBase, tip, rightBase].
 * @see lib/common/arrows.c:arrow_type_normal0
 */
export function arrowheadPolygon(arrowTip: Point, arrowDir: Point): Point[] {
  const dir = normalizeVec(arrowDir);
  const base = offsetPoint(arrowTip, dir, ARROW_LENGTH);
  const hw = ARROW_LENGTH * ARROW_WIDTH_FACTOR;
  const perp: Point = { x: -dir.y * hw, y: dir.x * hw };
  return [
    { x: base.x + perp.x, y: base.y + perp.y },
    arrowTip,
    { x: base.x - perp.x, y: base.y - perp.y },
  ];
}

// ---------------------------------------------------------------------------
// installEdgeSpline
// @see lib/common/splines.c:clip_and_install, new_spline
// ---------------------------------------------------------------------------

/** Build a Bezier record for a single cubic segment. */
export function makeBezierRecord(bezierPts: Point[], arrowTip: Point): Bezier {
  return {
    list: bezierPts,
    size: bezierPts.length,
    sflag: 0,
    eflag: 1,
    sp: bezierPts[0] ?? { x: 0, y: 0 },
    ep: arrowTip,
  };
}

/** Build a zero-bb Spline wrapping a single Bezier record. */
export function makeSplineRecord(bz: Bezier): Spline {
  return { list: [bz], size: 1, bb: { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } } };
}

/** Create and install a Spline on the edge. @see lib/common/splines.c:clip_and_install */
export function installEdgeSpline(e: GraphEdge, bezierPts: Point[], arrowTip: Point): void {
  e.info.spl = makeSplineRecord(makeBezierRecord(bezierPts, arrowTip));
}

// ---------------------------------------------------------------------------
// routeDotEdges helpers
// ---------------------------------------------------------------------------

/** Returns a NodeBox with defaulted lw/rw/ht for a node. */
export function nodeBoxOf(n: Node): NodeBox {
  return {
    center: n.info.coord,
    lw: n.info.lw > 0 ? n.info.lw : 27,
    rw: n.info.rw > 0 ? n.info.rw : 27,
    ht: n.info.ht > 0 ? n.info.ht : 36,
  };
}

/** True when both endpoints have defined coordinates. */
export function coordsDefined(e: GraphEdge): boolean {
  return e.tail.info.coord !== undefined && e.head.info.coord !== undefined;
}

/** True when both endpoints sit at the origin (un-initialised). */
export function bothAtOrigin(e: GraphEdge): boolean {
  const tc = e.tail.info.coord;
  const hc = e.head.info.coord;
  return tc.x === 0 && tc.y === 0 && hc.x === 0 && hc.y === 0;
}

/** True when the edge's endpoints have usable coordinates. */
export function hasValidCoords(e: GraphEdge): boolean {
  return coordsDefined(e) && !bothAtOrigin(e);
}

/** Route and install spline + arrowhead for a single edge. */
export function routeOneEdge(e: GraphEdge): void {
  const result = straightEdgeSpline(nodeBoxOf(e.tail), nodeBoxOf(e.head));
  installEdgeSpline(e, result.bezierPts, result.arrowTip);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (e.info as any)._arrowPts = arrowheadPolygon(result.arrowTip, result.arrowDir);
}

// ---------------------------------------------------------------------------
// routeDotEdges
// @see lib/dotgen/dotsplines.c:dot_splines_ (regular edge routing)
// ---------------------------------------------------------------------------

/**
 * Compute and install straight-line edge splines for all unrouted edges in g.
 *
 * Skips edges that already have a Spline, are self-loops, or have unset
 * coordinates.  The arrowhead polygon is stored in `(e.info as any)._arrowPts`
 * because EdgeInfo has no typed field for it yet.
 *
 * @see lib/dotgen/dotsplines.c:dot_splines_
 */
export function routeDotEdges(g: Graph): void {
  for (const n of g.nodes.values()) {
    for (const e of n.outEdges(g)) {
      if (e.info.spl !== undefined) continue;
      if (e.tail === e.head) continue;
      if (!hasValidCoords(e)) continue;
      routeOneEdge(e);
    }
  }
}
