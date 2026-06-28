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
import { buildOutEdgeIndex } from '../../model/node.js';
import type { Point } from '../../model/geom.js';
import type { NodeBox } from './edge-route-geom.js';
import type { PortRoute } from './edge-route-routing.js';
import { resolvePort } from '../../common/splines-path-shared.js';
import { clipAndInstall } from '../../common/splines-clip.js';

import { normalizeVec } from './edge-route-geom.js';
import { arrowDrawOpsForEnd } from './edge-route-arrow.js';
import { linearBezier } from './edge-route-poly.js';
import { rankEdgeInfoOf } from './edge-route-rank.js';
import { routeRegularEdgeFaithful } from './edge-route-faithful.js';
import { edgeRouteCmp } from './edge-order.js';
import { isFlatAdjacent, makeFlatAdjEdges } from './splines-flat.js';
import { ShapeKind, type ShapeDesc } from '../../common/types.js';
import {
  collectNonAdjacentFlatGroup, routeFlatEdgeGroupFaithful,
} from './splines-flat-multi.js';
import { makeFlatLabeledEdge, makeAdjFlatNoPortEdge } from './splines-flat-labeled.js';
import { EDGETYPE_SPLINE, swapEndsP, swapSpline, getMainEdge } from './splines.js';
import { FLATORDER } from './fastgr.js';
import { IGNORED } from './rank.js';
import { buildDotSinfo } from './self-loop.js';

import {
  nodeBoxOf,
  edgeRenderPenwidth,
  edgePenwidthAttr,
  installEdgeSpline,
  straightEdgeSplineWithRank,
  defaultEdgeDir,
} from './edge-route-helpers.js';

import {
  routeBackEdge,
  routeMultiRankEdgeFaithful,
  makeFwdEdge,
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
  polyEdgesFromPts, computeSpline,
} from './edge-route-poly.js';
export { makeTailBox, makeHeadBox, makeMaximalBbox, makeRankBox } from './edge-route-boxes.js';
export type { RankBoxParams } from './edge-route-boxes.js';
export {
  buildRankCorridor, clipToNodes, routeWithRank, routeSimple,
  normalArrowLen,
} from './edge-route-routing.js';
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
  routeBackEdge,
} from './edge-route-chain.js';

// ---------------------------------------------------------------------------
// buildLinearBezier — alias kept for backward compatibility
// ---------------------------------------------------------------------------

/** Straight-line cubic Bezier at 1/3 and 2/3. @see lib/dotgen/dotsplines.c */
export function buildLinearBezier(p0: Point, p3: Point): Point[] {
  return linearBezier(p0, p3);
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
 * Route a multi-rank back/forward edge for the non-forward dir path through the
 * faithful pipeline (clipAndInstall gates arrows by the dir attribute). Returns
 * true when it handled the edge.
 */
function dispatchMultiRankNonForward(
  e: GraphEdge, tailBox: NodeBox, headBox: NodeBox, g: Graph,
): boolean {
  if (isMultiRankBackEdge(e)) {
    routeBackEdge(e, tailBox, headBox, g);
    return true;
  }
  if (isMultiRankFwdEdge(e)) return routeFaithfulMultiRank(e, g);
  return false;
}

/**
 * Route a dir=back/both/none edge through the faithful pipeline. Adjacent back
 * edges go via makefwdedge (T1); multi-rank back/forward via the chain pipeline;
 * adjacent regular via make_regular_edge. clipAndInstall gates head/tail arrows
 * by the dir attribute. @see lib/dotgen/dotsplines.c:make_regular_edge
 */
function routeEdgeNonForward(e: GraphEdge, g: Graph): void {
  if (routeFaithfulAdjacentBack(e, g)) return; // T1 (AD-1): faithful adjacent back edge
  const tailBox = nodeBoxOf(e.tail, g);
  const headBox = nodeBoxOf(e.head, g);
  if (dispatchMultiRankNonForward(e, tailBox, headBox, g)) return;
  // Same-rank (flat) edges dispatch by topology regardless of ED_dir; the flat
  // routers otherwise live only in the forward path, so reach them here too —
  // e.g. a dir=both flat adjacent side-port edge (2437: AA3:se -> AA4:sw).
  if (e.tail.info.rank !== undefined && e.tail.info.rank === e.head.info.rank
    && routeFlatEdge(e, g)) return;
  routeFaithfulRegularPlain(e, g);
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

/**
 * Route a plain adjacent-rank forward edge through the faithful pipeline and
 * install it. Returns false when the faithful path declines (not adjacent-rank),
 * so the caller falls back to the fitter.
 */
function routeFaithfulRegularPlain(e: GraphEdge, g: Graph): boolean {
  const pts = routeRegularEdgeFaithful(g, e);
  if (pts === null) return false;
  clipAndInstall(e, e.head, pts, pts.length, buildDotSinfo());
  return true;
}

/**
 * Route an adjacent-rank back edge (head exactly one rank above tail) through
 * the faithful pipeline (AD-1). A back edge is the forward edge with swapped
 * ends (C `makefwdedge`): route the forward view as a plain adjacent edge, then
 * `clipAndInstall` installs the forward-geometry spline on the ORIGINAL edge
 * (makeFwdEdge sets `to_orig`/`edge_type`). `dotSplines_` runs `edgeNormalize`
 * *before* `routeDotEdges`, so the global `swapSpline` pass has already run for
 * this edge — apply the back-edge swap here so the spline runs tail→head with
 * the arrow at the head. Returns false when `e` is not an adjacent back edge.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (BWDEDGE makefwdedge), edge_normalize
 */
function routeFaithfulAdjacentBack(e: GraphEdge, g: Graph): boolean {
  const tr = e.tail.info.rank;
  const hr = e.head.info.rank;
  if (tr === undefined || hr === undefined || tr !== hr + 1) return false;
  const fwd = makeFwdEdge(e);
  const pts = routeRegularEdgeFaithful(g, fwd);
  if (pts === null) return false;
  clipAndInstall(fwd, fwd.head, pts, pts.length, buildDotSinfo());
  if (swapEndsP(e) && e.info.spl) swapSpline(e.info.spl);
  return true;
}

/** Route and install spline + arrowhead(s) for a single edge. */
export function routeOneEdge(e: GraphEdge, g: Graph): void {
  const dirAttr = e.attrs.get('dir') ?? defaultEdgeDir(g);
  const pw = edgeRenderPenwidth(e);
  if (dirAttr !== 'forward') {
    routeEdgeNonForward(e, g);
    return;
  }
  if (routeFaithfulAdjacentBack(e, g)) return; // T1 (AD-1): faithful adjacent back edge
  const tailBox = nodeBoxOf(e.tail, g);
  const headBox = nodeBoxOf(e.head, g);
  if (isMultiRankBackEdge(e)) {
    routeBackEdge(e, tailBox, headBox, g);
    return;
  }
  if (isMultiRankFwdEdge(e)) {
    routeFaithfulMultiRank(e, g); // T3 (AD-2): faithful chain pipeline
    return;
  }
  routeForwardEdge(e, g, tailBox, headBox, pw);
}

/**
 * Route a multi-rank forward edge through the faithful chain pipeline (steers
 * the port via REGULAREDGE side boxes, then routeSplines over the full virtual
 * chain). Returns false when the faithful path declines the edge.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag forward path)
 */
function routeFaithfulMultiRank(e: GraphEdge, g: Graph): boolean {
  const pts = routeMultiRankEdgeFaithful(g, e);
  if (pts === null) return false;
  clipAndInstall(e, e.head, pts, pts.length, buildDotSinfo());
  return true;
}

/**
 * True when either endpoint resolves to an active side-mask port (after dyna
 * resolution). Such edges route through the faithful box-channel pipeline
 * (AD2); plain and centre-only-port edges keep the simplified fitter so the
 * 115 no-side-port goldens stay byte-identical (AD3).
 * @see lib/common/splines.c:beginpath (sidemask)
 */
function hasSidePort(e: GraphEdge): boolean {
  const tp = resolvePort(e.tail, e.head, e.info.tail_port);
  const hp = resolvePort(e.head, e.tail, e.info.head_port);
  return (tp.side ?? 0) !== 0 || (hp.side ?? 0) !== 0;
}

/** True when x is an unrouted adjacent same-rank side-port flat edge. */
function isGroupableFlat(x: GraphEdge, g: Graph): boolean {
  return x.info.spl === undefined
    && x.tail.info.rank === x.head.info.rank
    && isFlatAdjacent(g, x) && hasSidePort(x);
}

/**
 * Collect all unrouted adjacent same-rank side-port flat edges between e's two
 * endpoints (either direction), ordered so group[0].tail is the lower-order
 * (left) node. C groups every adjacent flat between a node pair into one
 * make_flat_adj_edges call and normalizes its lead edge forward (makefwdedge) so
 * tn = the left node; the port's buildFlatAux derives otn from edges[0].tail, so
 * the lead edge must be forward for the reversed back edge to clone auxh->auxt
 * and curl (size 7) instead of straight (size 4).
 * @see lib/dotgen/dotsplines.c:make_flat_edge (makefwdedge of *edges), dot_splines_
 */
function collectAdjacentFlatGroup(e: GraphEdge, g: Graph): GraphEdge[] {
  const u = e.tail, v = e.head;
  const lo = (u.info.order ?? 0) <= (v.info.order ?? 0) ? u : v;
  const sharesPair = (x: GraphEdge): boolean =>
    (x.tail === u && x.head === v) || (x.tail === v && x.head === u);
  const group = g.edges.filter(x => sharesPair(x) && isGroupableFlat(x, g));
  group.sort((a, b) => Number(b.tail === lo) - Number(a.tail === lo) || a.seq - b.seq);
  return group;
}

/**
 * Route a side-port edge through the faithful `beginPath → routeSplines →
 * endPath → clipAndInstall` pipeline. A same-rank edge routes via the flat
 * pipeline (make_flat_edge); an adjacent-rank regular edge via
 * make_regular_edge. Returns false when the faithful path declines the edge,
 * so the caller falls back to the simplified fitter. clipAndInstall installs
 * the spline and stashes arrow polygons — do not also call
 * installEdgeSpline/arrowheadPolygon here.
 * @see lib/dotgen/dotsplines.c:make_flat_edge, make_regular_edge
 */
function routeFaithfulSidePort(e: GraphEdge, g: Graph): boolean {
  const sameRank = e.tail.info.rank !== undefined && e.tail.info.rank === e.head.info.rank;
  // Adjacent flat endpoints route via the rotated-aux pipeline (make_flat_adj_edges),
  // which installs the spline directly; the box channel handles non-adjacent flats.
  // C groups ALL adjacent flats between a node pair into ONE aux call (cnt=N);
  // route the whole group so the reversed back edge clones auxh->auxt and curls.
  // @see lib/dotgen/dotsplines.c:dot_splines_ (ED_adjacent edge-group loop)
  if (sameRank && isFlatAdjacent(g, e)) {
    const group = collectAdjacentFlatGroup(e, g);
    return makeFlatAdjEdges(g, group, group.length, EDGETYPE_SPLINE) === 0
      && e.info.spl !== undefined;
  }
  // Non-adjacent flats: C groups identical-port siblings into ONE make_flat_edge
  // call and nests their splines (cnt-loop). Collect the group and route once;
  // the group router clip-installs every sibling, so the main loop skips them.
  // cnt=1 reduces to the former single routeFlatEdgeFaithful path (AD-1).
  // @see lib/dotgen/dotsplines.c:make_flat_edge, make_flat_bottom_edges
  if (sameRank) {
    const group = collectNonAdjacentFlatGroup(e, g);
    return routeFlatEdgeGroupFaithful(g, group, group.length) && e.info.spl !== undefined;
  }
  const pts = routeRegularEdgeFaithful(g, e);
  if (pts === null) return false;
  clipAndInstall(e, e.head, pts, pts.length, buildDotSinfo());
  return true;
}

/** graphviz #1323: C make_flat_adj_edges bails on a flat edge between ADJACENT
 *  nodes with a record-shape endpoint — no spline is built, map_edge "lost"s it,
 *  and it is never drawn. Detect that case so the router leaves e.info.spl
 *  undefined (edgeHasDrawableContent then skips it), matching the oracle.
 *  @see lib/dotgen/dotsplines.c:make_flat_adj_edges */
function isLostFlatAdjRecordEdge(g: Graph, e: GraphEdge): boolean {
  const tr = e.tail.info.rank;
  if (tr === undefined || tr !== e.head.info.rank) return false;
  if (!isFlatAdjacent(g, e)) return false;
  const rec = (s: unknown): boolean => (s as ShapeDesc | undefined)?.kind === ShapeKind.SH_RECORD;
  return rec(e.tail.info.shape) || rec(e.head.info.shape);
}

/**
 * Dispatch a same-rank (flat) edge to its faithful router. C routes flat edges
 * by topology in `dot_splines_` independent of ED_dir (only the arrowheads
 * differ by direction), so this is reachable from both the forward and the
 * non-forward (dir=both/back/none) paths. Returns true when the edge was
 * consumed (routed, or intentionally left unrouted per #1323); false to let the
 * caller fall through to the regular/fitter path.
 * @see lib/dotgen/dotsplines.c:dot_splines_ (flat edge group dispatch)
 */
function routeFlatEdge(e: GraphEdge, g: Graph): boolean {
  if (isLostFlatAdjRecordEdge(g, e)) return true; // #1323: lost edge, leave unrouted
  // Labeled same-rank edges: non-adjacent routes around the flat label vnode
  // (make_flat_labeled_edge); adjacent no-port routes straight with the label
  // above (make_flat_adj_edges → makeSimpleFlatLabels). Both decline for every
  // other edge, so only labeled flats are diverted. @see dotsplines.c:1527-1533
  if (makeFlatLabeledEdge(g, e)) return true;
  if (makeAdjFlatNoPortEdge(g, e)) return true;
  if (hasSidePort(e) && routeFaithfulSidePort(e, g)) return true;
  return false;
}

/** Route + install a plain forward edge, attaching declared ports if any. */
function routeForwardEdge(
  e: GraphEdge, g: Graph, tailBox: NodeBox, headBox: NodeBox, pw: number,
): void {
  if (routeFlatEdge(e, g)) return;
  // T2 (AD-1/AD-2): plain adjacent-rank forward edges route through the faithful
  // pathplan path (make_regular_edge). routeRegularEdgeFaithful declines (null)
  // for anything not adjacent-rank, so the fitter below only handles declines.
  if (routeFaithfulRegularPlain(e, g)) return;
  const rankInfo = rankEdgeInfoOf(g, e.tail, e.head);
  const result = straightEdgeSplineWithRank(
    tailBox, headBox, rankInfo, edgePenwidthAttr(e), portRouteOf(e),
  );
  installEdgeSpline(e, result.bezierPts, result.arrowTip);
  e.info.headArrowOps = arrowDrawOpsForEnd(e, 'head', result.arrowTip, result.arrowDir, pw);
}

/**
 * Collect every real out-edge (same set as `g.nodes.values()` × out-edges) in
 * C `dot_splines_` routing order: rank-major collection + `edgecmp` sort. Order
 * matters because `recover_slack` mutates shared virtual nodes that other edges
 * read as `maximal_bbox` neighbours (S1). When the graph is unranked, preserve
 * the legacy insertion order (the sort keys are rank-derived).
 * @see lib/dotgen/dotsplines.c:dot_splines_ (edges list build + edgecmp sort)
 */
function orderedDotEdges(g: Graph): GraphEdge[] {
  const outIdx = buildOutEdgeIndex(g);
  const edges: GraphEdge[] = [];
  for (const n of g.nodes.values()) {
    for (const e of outIdx.get(n) ?? []) edges.push(e);
  }
  if (g.info.rank !== undefined) edges.sort(edgeRouteCmp);
  return edges;
}

/**
 * Compute and install edge splines for all unrouted edges in g.
 * @see lib/dotgen/dotsplines.c:dot_splines_
 */
/**
 * Route one not-yet-routed edge, applying the `dot_splines_` skip guards. No-op
 * if the edge is already routed or ineligible (FLATORDER/IGNORED, self-loop, or
 * lacking valid coords). Used both by the unified `dotSplines_` loop — which
 * routes lone edges at their `edgecmp` position, interleaved with groups, as C
 * does — and by the `routeDotEdges` backstop sweep below.
 * @see lib/dotgen/dotsplines.c:dot_splines_ (per-edge dispatch + 295 skip)
 */
export function routeLoneEdge(e: GraphEdge, g: Graph): void {
  if (e.info.spl !== undefined) return;
  // C dot_splines_ skips FLATORDER/IGNORED edges when building the route list;
  // an IGNORED edge (e.g. a concentrate-merged parallel duplicate) must get no
  // spline so emit draws only the representative. @see dotsplines.c:295
  const et = e.info.edge_type ?? 0;
  if (et === FLATORDER || et === IGNORED) return;
  // A *labeled* flat edge merged into a same-rank representative (flat_rev:
  // the cycle back-edge of an opposing flat pair `a->b`/`b->a`) draws nothing.
  // C gathers it into ND_other, but because its label differs from the
  // representative's, edgecmp's `ED_label(e0)!=ED_label(e1)` test breaks it into
  // its own one-edge group, routed by make_flat_labeled_edge. There the label
  // node resolves through `to_virt` to the representative's *tail* (a real node,
  // not a deleted label vnode), so the spline boxes degenerate and routesplines
  // returns no points — no spline is installed and the label is never drawn.
  // An *unlabeled* merged edge instead shares the representative's null label,
  // groups with it, and make_flat_edge routes every group member (both legs of
  // an opposing pair are drawn), so it must NOT be skipped here.
  // @see lib/dotgen/dotsplines.c:make_flat_edge / make_flat_labeled_edge,
  //      lib/dotgen/mincross.c:flat_rev
  if (e.tail.info.rank === e.head.info.rank
      && e.info.label !== undefined && getMainEdge(e) !== e) return;
  if (e.tail === e.head) return;
  if (!hasValidCoords(e)) return;
  routeOneEdge(e, g);
}

export function routeDotEdges(g: Graph): void {
  for (const e of orderedDotEdges(g)) routeLoneEdge(e, g);
}
