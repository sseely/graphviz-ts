// SPDX-License-Identifier: EPL-2.0

/**
 * Edge spline routing orchestration for dot layout.
 *
 * Top-level entry point. Wires together the sub-modules (geom, clip,
 * poly, boxes, routing, rank) to compute and install Bezier splines
 * and arrowhead polygons on every edge in the graph.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 * @see lib/common/splines.c:clip_and_install
 * @see lib/common/routespl.c:routesplines_
 * @see lib/common/arrows.c:arrow_type_normal
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge as GraphEdge } from '../../model/edge.js';
import type { Point, Bezier, Spline } from '../../model/geom.js';
import { routeSpline } from '../../pathplan/route.js';
import type { Edge as BarrierEdge } from '../../pathplan/types.js';

import { normalizeVec, offsetPoint } from './edge-route-geom.js';
import type { NodeBox } from './edge-route-geom.js';
import { linearBezier } from './edge-route-poly.js';
import { routeWithRank, routeSimple } from './edge-route-routing.js';
import type { EdgeSplineResult, RankEdgeInfo } from './edge-route-routing.js';
import { rankEdgeInfoOf } from './edge-route-rank.js';

// ---------------------------------------------------------------------------
// Re-exports — callers that imported from this module keep working.
// ---------------------------------------------------------------------------

export { normalizeVec, negateVec, offsetPoint, clipToNodeBox } from './edge-route-geom.js';
export type { NodeBox } from './edge-route-geom.js';
export { xClipT, yClipT } from './edge-route-geom.js';
export { bezierClipNode, makeBoxInsideFn, bezierSubdivide } from './edge-route-clip.js';
export {
  boxesToPolygon, addForwardPolyPts, addReversePolyPts,
  polyEdgesFromPts, computeSpline,
} from './edge-route-poly.js';
export { makeTailBox, makeHeadBox, makeMaximalBbox, makeRankBox } from './edge-route-boxes.js';
export type { RankBoxParams } from './edge-route-boxes.js';
export { buildRankCorridor, clipToNodes, routeWithRank, routeSimple } from './edge-route-routing.js';
export type { EdgeSplineResult, RankEdgeInfo } from './edge-route-routing.js';
export { computeLeftBound, computeRightBound, rankHt, rankEdgeInfoOf } from './edge-route-rank.js';

// ---------------------------------------------------------------------------
// Constants
// @see lib/common/arrows.c
// ---------------------------------------------------------------------------

/** Arrow length in points. @see lib/common/arrows.c:#define ARROW_LENGTH 10. */
export const ARROW_LENGTH = 10;

/** Arrow width factor. @see lib/common/arrows.c:arrowwidth = 0.35 */
export const ARROW_WIDTH_FACTOR = 0.35;

// ---------------------------------------------------------------------------
// buildLinearBezier — alias kept for backward compatibility
// ---------------------------------------------------------------------------

/** Straight-line cubic Bezier at 1/3 and 2/3. @see lib/dotgen/dotsplines.c */
export function buildLinearBezier(p0: Point, p3: Point): Point[] {
  return linearBezier(p0, p3);
}

// ---------------------------------------------------------------------------
// routeBezier
// ---------------------------------------------------------------------------

/** Route via pathplan and return 4 control points, falling back to linear. */
export function routeBezier(from: Point, to: Point): Point[] {
  const noBarriers: BarrierEdge[] = [];
  const zero: Point = { x: 0, y: 0 };
  const raw = routeSpline(noBarriers, [from, to], [zero, zero]);
  if (raw.length < 4) return linearBezier(from, to);
  const p0 = raw[0] as Point;
  const p1 = raw[1] as Point;
  if (p1.x === p0.x && p1.y === p0.y) return linearBezier(from, to);
  return [p0, p1, raw[2] as Point, raw[3] as Point];
}

// ---------------------------------------------------------------------------
// arrowheadPolygon
// @see lib/common/arrows.c:arrow_type_normal0
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
// Spline record builders
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
// edgeDirection
// ---------------------------------------------------------------------------

/** Compute normalized tail→head direction between two node boxes. */
export function edgeDirection(tailBox: NodeBox, headBox: NodeBox): Point {
  return normalizeVec({
    x: headBox.center.x - tailBox.center.x,
    y: headBox.center.y - tailBox.center.y,
  });
}

// ---------------------------------------------------------------------------
// straightEdgeSpline / straightEdgeSplineWithRank
// @see lib/dotgen/dotsplines.c:make_regular_edge
// ---------------------------------------------------------------------------

/**
 * Compute Bezier control points and arrowhead geometry for a straight edge.
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 */
export function straightEdgeSpline(
  tailBox: NodeBox,
  headBox: NodeBox,
): EdgeSplineResult {
  return straightEdgeSplineWithRank(tailBox, headBox, undefined);
}

/**
 * Full implementation with optional rank geometry.
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 */
export function straightEdgeSplineWithRank(
  tailBox: NodeBox,
  headBox: NodeBox,
  rankInfo: RankEdgeInfo | undefined,
): EdgeSplineResult {
  return rankInfo !== undefined
    ? routeWithRank(tailBox, headBox, rankInfo)
    : routeSimple(tailBox, headBox, routeBezier);
}

// ---------------------------------------------------------------------------
// Node coordinate helpers
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

// ---------------------------------------------------------------------------
// routeOneEdge / routeDotEdges
// @see lib/dotgen/dotsplines.c:dot_splines_
// ---------------------------------------------------------------------------

/** Route and install spline + arrowhead for a single edge. */
export function routeOneEdge(e: GraphEdge, g: Graph): void {
  const result = straightEdgeSplineWithRank(
    nodeBoxOf(e.tail), nodeBoxOf(e.head), rankEdgeInfoOf(g, e.tail, e.head),
  );
  installEdgeSpline(e, result.bezierPts, result.arrowTip);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (e.info as any)._arrowPts = arrowheadPolygon(result.arrowTip, result.arrowDir);
}

/**
 * Compute and install straight-line edge splines for all unrouted edges in g.
 * @see lib/dotgen/dotsplines.c:dot_splines_
 */
export function routeDotEdges(g: Graph): void {
  for (const n of g.nodes.values()) {
    for (const e of n.outEdges(g)) {
      if (e.info.spl !== undefined) continue;
      if (e.tail === e.head) continue;
      if (!hasValidCoords(e)) continue;
      routeOneEdge(e, g);
    }
  }
}
