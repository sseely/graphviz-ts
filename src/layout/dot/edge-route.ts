// SPDX-License-Identifier: EPL-2.0

/**
 * Edge spline routing orchestration for dot layout.
 *
 * Top-level entry point. Wires together the sub-modules (geom, clip,
 * poly, boxes, routing, rank, helpers, chain) to compute and install
 * Bezier splines and arrowhead polygons on every edge in the graph.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 * @see lib/common/splines.c:clip_and_install
 * @see lib/common/routespl.c:routesplines_
 * @see lib/common/arrows.c:arrow_type_normal
 */

import type { Graph } from '../../model/graph.js';
import type { Edge as GraphEdge } from '../../model/edge.js';
import type { Point } from '../../model/geom.js';
import type { NodeBox } from './edge-route-geom.js';
import type { EdgeSplineResult, PortRoute } from './edge-route-routing.js';
import { resolvePort } from '../../common/splines-path-shared.js';

import { normalizeVec, negateVec } from './edge-route-geom.js';
import { arrowheadPolygon } from './edge-route-arrow.js';
import { linearBezier } from './edge-route-poly.js';
import { arrowEndClip, tailArrowEndClip } from './edge-route-clip.js';
import { routeEdgeRaw, normalArrowLen } from './edge-route-routing.js';
import { rankEdgeInfoOf } from './edge-route-rank.js';

import {
  nodeBoxOf,
  edgeRenderPenwidth,
  edgePenwidthAttr,
  installEdgeSpline,
  routeBezier,
  straightEdgeSplineWithRank,
  defaultEdgeDir,
} from './edge-route-helpers.js';

import {
  routeBackEdge,
  routeFwdMultiRankEdge,
} from './edge-route-chain.js';

// Suppress unused-import warning for re-exported symbols
void (linearBezier as unknown);

// ---------------------------------------------------------------------------
// Re-exports — callers that imported from this module keep working.
// ---------------------------------------------------------------------------

export { normalizeVec, negateVec, offsetPoint, clipToNodeBox } from './edge-route-geom.js';
export type { NodeBox } from './edge-route-geom.js';
export { xClipT, yClipT } from './edge-route-geom.js';
export {
  bezierClipNode, makeBoxInsideFn, bezierSubdivide, tailArrowEndClip,
} from './edge-route-clip.js';
export {
  boxesToPolygon, addForwardPolyPts, addReversePolyPts,
  polyEdgesFromPts, computeSpline, computeSplineMulti,
} from './edge-route-poly.js';
export { makeTailBox, makeHeadBox, makeMaximalBbox, makeRankBox } from './edge-route-boxes.js';
export type { RankBoxParams } from './edge-route-boxes.js';
export {
  buildRankCorridor, clipToNodes, routeWithRank, routeSimple,
  routeEdgeRaw, normalArrowLen,
} from './edge-route-routing.js';
export type { RawEdgeRoute } from './edge-route-routing.js';
export type { EdgeSplineResult, RankEdgeInfo } from './edge-route-routing.js';
export {
  computeLeftBound, computeRightBound, rankHt, rankEdgeInfoOf,
} from './edge-route-rank.js';
export { ARROW_LENGTH, ARROW_WIDTH_FACTOR, arrowheadPolygon } from './edge-route-arrow.js';

// Re-export helpers so existing callers keep working.
export {
  nodeBoxOf, edgeRenderPenwidth, edgePenwidthAttr,
  makeBezierRecord, makeSplineRecord, installEdgeSpline,
  routeBezier, straightEdgeSplineWithRank,
} from './edge-route-helpers.js';
export {
  walkVirtChain, walkFwdVirtChain,
  clipCompoundTail, clipCompoundHead,
  buildBackEdgeVirtBox, buildBackEdgeGapBox,
  routeBackEdge, routeFwdMultiRankEdge,
} from './edge-route-chain.js';

// ---------------------------------------------------------------------------
// buildLinearBezier — alias kept for backward compatibility
// ---------------------------------------------------------------------------

/** Straight-line cubic Bezier at 1/3 and 2/3. @see lib/dotgen/dotsplines.c */
export function buildLinearBezier(p0: Point, p3: Point): Point[] {
  return linearBezier(p0, p3);
}

// ---------------------------------------------------------------------------
// straightEdgeSpline — alias kept for backward compatibility
// ---------------------------------------------------------------------------

/**
 * Compute Bezier control points and arrowhead geometry for a straight edge.
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 */
export function straightEdgeSpline(
  tailBox: NodeBox,
  headBox: NodeBox,
  penwidth = 1.0,
): EdgeSplineResult {
  return straightEdgeSplineWithRank(tailBox, headBox, undefined, penwidth);
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
// Coordinate validity guards
// ---------------------------------------------------------------------------

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

/** True when edge is a back-edge spanning multiple ranks (tail rank > head rank). */
function isMultiRankBackEdge(e: GraphEdge): boolean {
  return e.info.to_virt !== undefined
    && (e.tail.info.rank ?? 0) > (e.head.info.rank ?? 0);
}

/** True when forward edge spans more than one rank via a virtual chain. */
function isMultiRankFwdEdge(e: GraphEdge): boolean {
  return e.info.to_virt !== undefined
    && (e.head.info.rank ?? 0) > (e.tail.info.rank ?? 0) + 1;
}

/**
 * Route a multi-rank back/forward edge for the non-forward dir path; arrows
 * gated by dirAttr. Returns true when it handled the edge.
 */
function dispatchMultiRankNonForward(
  e: GraphEdge, tailBox: NodeBox, headBox: NodeBox, g: Graph, dirAttr: string,
): boolean {
  if (isMultiRankBackEdge(e)) {
    routeBackEdge(e, tailBox, headBox, g);
    return true;
  }
  if (isMultiRankFwdEdge(e)) {
    // Curve a multi-rank edge around intervening ranks; arrows gated by dir.
    routeFwdMultiRankEdge(e, tailBox, headBox, g, dirAttr);
    return true;
  }
  return false;
}

/** Route dir=back/both/none: raw node-clip, selective arrow clips. */
/** Apply tail/head arrowhead polygons + end-clips to a routed non-forward edge. */
function applyEndArrows(
  e: GraphEdge,
  raw: ReturnType<typeof routeEdgeRaw>,
  pw: number,
  wantTail: boolean,
  wantHead: boolean,
): Point[] {
  const elen = normalArrowLen(edgePenwidthAttr(e));
  let bezPts = raw.bezierPts;
  if (wantTail) {
    (e.info as unknown as Record<string, unknown>)._tailArrowPts =
      arrowheadPolygon(raw.tailTip, negateVec(raw.arrowDir), pw);
    bezPts = tailArrowEndClip(bezPts, raw.tailTip, elen);
  }
  if (wantHead) {
    bezPts = arrowEndClip(bezPts, raw.arrowTip, elen);
    (e.info as unknown as Record<string, unknown>)._arrowPts =
      arrowheadPolygon(raw.arrowTip, raw.arrowDir, pw);
  }
  return bezPts;
}

function routeEdgeNonForward(
  e: GraphEdge, g: Graph, dirAttr: string, pw: number,
): void {
  const tailBox = nodeBoxOf(e.tail, g);
  const headBox = nodeBoxOf(e.head, g);
  if (dispatchMultiRankNonForward(e, tailBox, headBox, g, dirAttr)) return;
  const rankInfo = rankEdgeInfoOf(g, e.tail, e.head);
  const wantHead = dirAttr === 'both';
  const wantTail = dirAttr === 'back' || dirAttr === 'both';
  const raw = routeEdgeRaw(tailBox, headBox, rankInfo, routeBezier);
  const bezPts = applyEndArrows(e, raw, pw, wantTail, wantHead);
  installEdgeSpline(e, bezPts, raw.arrowTip);
}

/**
 * Build the active router's port data from an edge's resolved tail/head ports.
 * Dynamic (`_`) ports are resolved against the opposite endpoint first. Returns
 * `undefined` when neither end has an active port, so plain edges take the
 * unchanged center-clip path (byte-stability gate).
 * @see lib/common/splines.c:beginpath (P.start.p = coord + port.p; clip flag)
 */
function portRouteOf(e: GraphEdge): PortRoute | undefined {
  const tp = resolvePort(e.tail, e.head, e.info.tail_port);
  const hp = resolvePort(e.head, e.tail, e.info.head_port);
  if (!tp.defined && !hp.defined) return undefined;
  const tc = e.tail.info.coord;
  const hc = e.head.info.coord;
  return {
    tailP: tp.defined ? { x: tc.x + tp.p.x, y: tc.y + tp.p.y } : null,
    headP: hp.defined ? { x: hc.x + hp.p.x, y: hc.y + hp.p.y } : null,
    clipTail: tp.defined ? tp.clip : true,
    clipHead: hp.defined ? hp.clip : true,
  };
}

/** Route and install spline + arrowhead(s) for a single edge. */
export function routeOneEdge(e: GraphEdge, g: Graph): void {
  const dirAttr = e.attrs.get('dir') ?? defaultEdgeDir(g);
  const pw = edgeRenderPenwidth(e);
  if (dirAttr !== 'forward') {
    routeEdgeNonForward(e, g, dirAttr, pw);
    return;
  }
  const tailBox = nodeBoxOf(e.tail, g);
  const headBox = nodeBoxOf(e.head, g);
  if (isMultiRankBackEdge(e)) {
    routeBackEdge(e, tailBox, headBox, g);
    return;
  }
  if (isMultiRankFwdEdge(e)) {
    routeFwdMultiRankEdge(e, tailBox, headBox, g, 'forward');
    return;
  }
  routeForwardEdge(e, g, tailBox, headBox, pw);
}

/** Route + install a plain forward edge, attaching declared ports if any. */
function routeForwardEdge(
  e: GraphEdge, g: Graph, tailBox: NodeBox, headBox: NodeBox, pw: number,
): void {
  const rankInfo = rankEdgeInfoOf(g, e.tail, e.head);
  const result = straightEdgeSplineWithRank(
    tailBox, headBox, rankInfo, edgePenwidthAttr(e), portRouteOf(e),
  );
  installEdgeSpline(e, result.bezierPts, result.arrowTip);
  (e.info as unknown as Record<string, unknown>)._arrowPts =
    arrowheadPolygon(result.arrowTip, result.arrowDir, pw);
}

/**
 * Compute and install edge splines for all unrouted edges in g.
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
