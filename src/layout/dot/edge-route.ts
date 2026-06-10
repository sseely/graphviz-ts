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
import { nodeAttr } from '../../common/poly-init.js';
import type { Point, Box, Bezier, Spline } from '../../model/geom.js';
import { routeSpline } from '../../pathplan/route.js';
import type { Edge as BarrierEdge } from '../../pathplan/types.js';

import { normalizeVec, negateVec } from './edge-route-geom.js';
import type { NodeBox } from './edge-route-geom.js';
import { arrowheadPolygon } from './edge-route-arrow.js';
import { linearBezier, computeSplineMulti } from './edge-route-poly.js';
import { bezierClipNode, arrowEndClip, tailArrowEndClip } from './edge-route-clip.js';
import { nodeInsideFn, routeWithRank, routeSimple, routeEdgeRaw, normalArrowLen } from './edge-route-routing.js';
import type { EdgeSplineResult, RankEdgeInfo } from './edge-route-routing.js';
import { rankEdgeInfoOf, computeLeftBound, computeRightBound } from './edge-route-rank.js';
import { makeTailBox, makeHeadBox, makeRankBox, makeMaximalBbox } from './edge-route-boxes.js';
import type { RankBoxParams } from './edge-route-boxes.js';

// ---------------------------------------------------------------------------
// Re-exports — callers that imported from this module keep working.
// ---------------------------------------------------------------------------

export { normalizeVec, negateVec, offsetPoint, clipToNodeBox } from './edge-route-geom.js';
export type { NodeBox } from './edge-route-geom.js';
export { xClipT, yClipT } from './edge-route-geom.js';
export { bezierClipNode, makeBoxInsideFn, bezierSubdivide, tailArrowEndClip } from './edge-route-clip.js';
export {
  boxesToPolygon, addForwardPolyPts, addReversePolyPts,
  polyEdgesFromPts, computeSpline, computeSplineMulti,
} from './edge-route-poly.js';
export { makeTailBox, makeHeadBox, makeMaximalBbox, makeRankBox } from './edge-route-boxes.js';
export type { RankBoxParams } from './edge-route-boxes.js';
export { buildRankCorridor, clipToNodes, routeWithRank, routeSimple, routeEdgeRaw, normalArrowLen } from './edge-route-routing.js';
export type { RawEdgeRoute } from './edge-route-routing.js';
export type { EdgeSplineResult, RankEdgeInfo } from './edge-route-routing.js';
export { computeLeftBound, computeRightBound, rankHt, rankEdgeInfoOf } from './edge-route-rank.js';
export { ARROW_LENGTH, ARROW_WIDTH_FACTOR, arrowheadPolygon } from './edge-route-arrow.js';

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

function isUsableSpline(raw: Point[]): boolean {
  if (raw.length < 4) return false;
  const p0 = raw[0] as Point;
  const p1 = raw[1] as Point;
  return p0.x !== p1.x || p0.y !== p1.y;
}

/** Route via pathplan and return 4 control points, falling back to linear. */
export function routeBezier(from: Point, to: Point): Point[] {
  const noBarriers: BarrierEdge[] = [];
  const zero: Point = { x: 0, y: 0 };
  const raw = routeSpline(noBarriers, [from, to], [zero, zero]);
  if (!isUsableSpline(raw)) return linearBezier(from, to);
  return [raw[0] as Point, raw[1] as Point, raw[2] as Point, raw[3] as Point];
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
  penwidth = 1.0,
): EdgeSplineResult {
  return straightEdgeSplineWithRank(tailBox, headBox, undefined, penwidth);
}

/**
 * Full implementation with optional rank geometry.
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 */
export function straightEdgeSplineWithRank(
  tailBox: NodeBox,
  headBox: NodeBox,
  rankInfo: RankEdgeInfo | undefined,
  penwidth = 1.0,
): EdgeSplineResult {
  return rankInfo !== undefined
    ? routeWithRank(tailBox, headBox, rankInfo, penwidth)
    : routeSimple(tailBox, headBox, routeBezier);
}

// ---------------------------------------------------------------------------
// Node coordinate helpers
// ---------------------------------------------------------------------------

/** Ellipse shape names (use ellipse clip, not box clip). @see lib/common/shapes.c:poly_inside */
const ELLIPSE_SHAPES = new Set(['ellipse', 'oval', 'circle', 'egg', 'doublecircle', 'Mcircle', 'point']);

/** Record shapes clip against the field box, not node ht (which carries
 *  record_init's +1 rounding kluge). @see lib/common/shapes.c:record_inside */
function recordClipBox(n: Node): { lw: number; rw: number; ht: number } | undefined {
  const f = n.info.shape_info as { b?: { ll: Point; ur: Point } } | undefined;
  if (!f?.b) return undefined;
  const halfW = (f.b.ur.x - f.b.ll.x) / 2;
  return { lw: halfW, rw: halfW, ht: f.b.ur.y - f.b.ll.y };
}

/** Returns a NodeBox with defaulted lw/rw/ht for a node. */
export function nodeBoxOf(n: Node, g: Graph): NodeBox {
  const shapeName = nodeAttr(n, g, 'shape') ?? 'ellipse';
  if (shapeName === 'record' || shapeName === 'Mrecord') {
    const rb = recordClipBox(n);
    if (rb) return { center: n.info.coord, ...rb, isEllipse: false };
  }
  return {
    center: n.info.coord,
    lw: n.info.lw > 0 ? n.info.lw : 27,
    rw: n.info.rw > 0 ? n.info.rw : 27,
    ht: n.info.ht > 0 ? n.info.ht : 36,
    isEllipse: ELLIPSE_SHAPES.has(shapeName),
  };
}

// ---------------------------------------------------------------------------
// Back-edge multi-rank routing helpers
// @see lib/dotgen/dotsplines.c:make_regular_edge (back-edge handling)
// ---------------------------------------------------------------------------

/** Walk virtual chain from e.head to e.tail. Returns [e.head, v1, v2, …, e.tail]. */
function walkVirtChain(e: GraphEdge): Node[] {
  const nodes: Node[] = [e.head];
  let cur = e.info.to_virt;
  while (cur !== undefined && cur.head !== e.tail) {
    nodes.push(cur.head);
    const out = cur.head.info.out;
    cur = (out !== undefined && out.size > 0) ? out.list[0] : undefined;
  }
  if (cur !== undefined) nodes.push(e.tail);
  return nodes;
}

/** Left x corridor imposed by the left neighbor of virtual node v in its rank. */
function leftNeighborLLX(v: Node, g: Graph): number {
  const rankArr = g.info.rank;
  const r = v.info.rank;
  if (rankArr === undefined || r === undefined) return -Infinity;
  const rk = rankArr[r];
  if (rk === undefined) return -Infinity;
  const idx = rk.v.indexOf(v);
  if (idx <= 0) return -Infinity;
  const nb = rk.v[idx - 1]!;
  const halfSep = (g.info.nodesep ?? 18) / 2;
  return nb.info.coord.x + (nb.info.rw > 0 ? nb.info.rw : 27) + halfSep;
}

/** Constrained llx for a gap box between two chain nodes. */
function backEdgeGapLLX(from: Node, to: Node, g: Graph, leftBound: number): number {
  const fromLLX = leftNeighborLLX(from, g);
  const toLLX = leftNeighborLLX(to, g);
  if (fromLLX > -Infinity && toLLX > -Infinity) return Math.min(fromLLX, toLLX);
  return leftBound;
}

/** Rank box for one intermediate virtual node, constrained by its left neighbor. */
function buildBackEdgeVirtBox(v: Node, g: Graph, lb: number, rb: number): Box {
  const r = v.info.rank!;
  const rk = g.info.rank![r]!;
  const cy = v.info.coord.y;
  const rw = v.info.rw > 0 ? v.info.rw : 9;
  const rawLLX = leftNeighborLLX(v, g);
  const llx = rawLLX > -Infinity ? rawLLX : lb;
  const urx = Math.min(v.info.coord.x + rw + 2, rb);
  return { ll: { x: llx, y: cy - rk.ht1 }, ur: { x: urx, y: cy + rk.ht2 } };
}

/** Inter-rank gap box between two consecutive chain nodes. */
function buildBackEdgeGapBox(from: Node, to: Node, g: Graph, lb: number, rb: number): Box {
  const rArr = g.info.rank!;
  const fromRk = rArr[from.info.rank!]!;
  const toRk = rArr[to.info.rank!]!;
  const rp: RankBoxParams = {
    llx: backEdgeGapLLX(from, to, g, lb), urx: rb,
    tailCy: from.info.coord.y, tailHt1: fromRk.ht1,
    headCy: to.info.coord.y, headHt2: toRk.ht2,
  };
  return makeRankBox(rp);
}

/**
 * Build corridor boxes for back-edge routing from A→D (head→tail in C coords).
 * chain = [e.head=A, v1, ..., e.tail=D] from walkVirtChain.
 * C's hackflag creates a synthetic edge with tail=A, head=D and routes A→D.
 * The result is reversed in routeBackEdge to get the visual D→A spline.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag path)
 */
function buildBackEdgeCorridorBoxes(
  chain: Node[], g: Graph,
): { boxes: Box[]; startPt: Point; endPt: Point } {
  const lb = computeLeftBound(g);
  const rb = computeRightBound(g);
  const aNode = chain[0]!;
  const dNode = chain[chain.length - 1]!;
  const aBox = nodeBoxOf(aNode, g);
  const dBox = nodeBoxOf(dNode, g);
  const rArr = g.info.rank!;
  const aRk = rArr[aNode.info.rank!]!;
  const dRk = rArr[dNode.info.rank!]!;
  const boxes: Box[] = [makeTailBox(makeMaximalBbox(aBox, aRk.ht1, aRk.ht2), aNode.info.coord.y)];
  for (let i = 0; i < chain.length - 1; i++) {
    boxes.push(buildBackEdgeGapBox(chain[i]!, chain[i + 1]!, g, lb, rb));
    if (i + 1 < chain.length - 1) {
      boxes.push(buildBackEdgeVirtBox(chain[i + 1]!, g, lb, rb));
    }
  }
  boxes.push(makeHeadBox(makeMaximalBbox(dBox, dRk.ht1, dRk.ht2), dNode.info.coord.y));
  return {
    startPt: { x: aNode.info.coord.x, y: aNode.info.coord.y - 1 },
    endPt:   { x: dNode.info.coord.x, y: dNode.info.coord.y + 1 },
    boxes,
  };
}

/** Clip the first 4 points of a compound bezier to startBox boundary (leftInside). */
function clipCompoundTail(pts: Point[], box: NodeBox): Point[] {
  const first4 = [pts[0]!, pts[1]!, pts[2]!, pts[3]!];
  const clipped = bezierClipNode(first4, box.center.x, box.center.y, nodeInsideFn(box), true);
  return [...clipped, ...pts.slice(4)];
}

/** Clip the last 4 points of a compound bezier to endBox boundary (rightInside). */
function clipCompoundHead(pts: Point[], box: NodeBox): Point[] {
  const n = pts.length;
  const last4 = [pts[n - 4]!, pts[n - 3]!, pts[n - 2]!, pts[n - 1]!];
  const clipped = bezierClipNode(last4, box.center.x, box.center.y, nodeInsideFn(box), false);
  return [...pts.slice(0, n - 4), ...clipped];
}

/** Apply arrowEndClip only to the last segment of a compound bezier. */
function arrowEndClipMulti(pts: Point[], arrowTip: Point, elen: number): Point[] {
  if (pts.length <= 4) return arrowEndClip(pts, arrowTip, elen);
  const n = pts.length;
  const last4 = [pts[n - 4]!, pts[n - 3]!, pts[n - 2]!, pts[n - 1]!];
  return [...pts.slice(0, n - 4), ...arrowEndClip(last4, arrowTip, elen)];
}

/** Apply tailArrowEndClip only to the first segment of a compound bezier. */
function tailArrowEndClipMulti(pts: Point[], tailTip: Point, elen: number): Point[] {
  if (pts.length <= 4) return tailArrowEndClip(pts, tailTip, elen);
  const first4 = [pts[0]!, pts[1]!, pts[2]!, pts[3]!];
  return [...tailArrowEndClip(first4, tailTip, elen), ...pts.slice(4)];
}

/** Apply selective arrow clips and install the edge spline for a reversed compound bezier. */
function applyBackEdgeArrows(
  e: GraphEdge, rev: Point[], arrowTip: Point, arrowDir: Point, dirAttr: string,
): void {
  const pw = edgeRenderPenwidth(e);
  const elen = normalArrowLen(edgePenwidthAttr(e));
  const wantHead = dirAttr === 'forward' || dirAttr === 'both';
  const wantTail = dirAttr === 'back' || dirAttr === 'both';
  let pts = rev;
  if (wantTail) {
    const tailTip = pts[0] as Point;
    (e.info as unknown as Record<string, unknown>)._tailArrowPts = arrowheadPolygon(tailTip, negateVec(arrowDir), pw);
    pts = tailArrowEndClipMulti(pts, tailTip, elen);
  }
  if (wantHead) {
    pts = arrowEndClipMulti(pts, arrowTip, elen);
    // Recompute arrowDir from arrowbase after clip (matches C: u = ep - list[size-1]).
    const arrowbase = pts[pts.length - 1] as Point;
    const headDir = normalizeVec({ x: arrowbase.x - arrowTip.x, y: arrowbase.y - arrowTip.y });
    (e.info as unknown as Record<string, unknown>)._arrowPts = arrowheadPolygon(arrowTip, headDir, pw);
  }
  installEdgeSpline(e, pts, arrowTip);
}

/**
 * Route a multi-rank back-edge via its virtual node chain.
 * Routes A→D (C hackflag direction), then reverses to get the D→A visual spline.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag back-edge path)
 */
function routeBackEdge(e: GraphEdge, tailBox: NodeBox, headBox: NodeBox, g: Graph): void {
  const dirAttr = e.attrs.get('dir') ?? 'forward';
  const chain = walkVirtChain(e);
  if (chain.length < 2) {
    const raw = routeEdgeRaw(tailBox, headBox, undefined, routeBezier);
    installEdgeSpline(e, raw.bezierPts, raw.arrowTip);
    return;
  }
  const { boxes, startPt, endPt } = buildBackEdgeCorridorBoxes(chain, g);
  const fwd = computeSplineMulti(boxes, startPt, endPt);
  const rev = fwd.slice().reverse();
  const clipped = clipCompoundHead(clipCompoundTail(rev, tailBox), headBox);
  const n = clipped.length;
  const arrowTip = clipped[n - 1] as Point;
  const arrowDir = normalizeVec({
    x: (clipped[n - 2] as Point).x - arrowTip.x,
    y: (clipped[n - 2] as Point).y - arrowTip.y,
  });
  applyBackEdgeArrows(e, clipped, arrowTip, arrowDir, dirAttr);
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
// edgeRenderPenwidth
// @see lib/common/gvrender.c:gvrender_set_style
// ---------------------------------------------------------------------------

/** Effective stroke width for edge arrowhead polygon sizing. */
function edgeRenderPenwidth(e: GraphEdge): number {
  const style = e.attrs.get('style') ?? '';
  if (style === 'bold') return 2.0;
  const pw = parseFloat(e.attrs.get('penwidth') ?? '');
  return isNaN(pw) ? 1.0 : pw;
}

/**
 * Penwidth used for arrow-length (elen) computation.
 *
 * C's arrow_length() reads E_penwidth (the penwidth ATTRIBUTE, default 1.0).
 * style=bold affects stroke rendering but does NOT set E_penwidth, so bold
 * edges use elen computed with penwidth=1.0.
 *
 * @see lib/common/arrows.c:arrow_length (late_double(e, E_penwidth, 1.0, 0.0))
 */
function edgePenwidthAttr(e: GraphEdge): number {
  const pw = parseFloat(e.attrs.get('penwidth') ?? '');
  return isNaN(pw) ? 1.0 : pw;
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

/** Route dir=back/both/none: raw node-clip, selective arrow clips. */
function routeEdgeNonForward(e: GraphEdge, g: Graph, dirAttr: string, pw: number): void {
  const tailBox = nodeBoxOf(e.tail, g);
  const headBox = nodeBoxOf(e.head, g);
  if (isMultiRankBackEdge(e)) {
    routeBackEdge(e, tailBox, headBox, g);
    return;
  }
  const rankInfo = rankEdgeInfoOf(g, e.tail, e.head);
  const wantHead = dirAttr === 'both';
  const wantTail = dirAttr === 'back' || dirAttr === 'both';
  const raw = routeEdgeRaw(tailBox, headBox, rankInfo, routeBezier);
  const elen = normalArrowLen(edgePenwidthAttr(e));
  let bezPts = raw.bezierPts;
  if (wantTail) {
    (e.info as unknown as Record<string, unknown>)._tailArrowPts = arrowheadPolygon(raw.tailTip, negateVec(raw.arrowDir), pw);
    bezPts = tailArrowEndClip(bezPts, raw.tailTip, elen);
  }
  if (wantHead) {
    bezPts = arrowEndClip(bezPts, raw.arrowTip, elen);
    (e.info as unknown as Record<string, unknown>)._arrowPts = arrowheadPolygon(raw.arrowTip, raw.arrowDir, pw);
  }
  installEdgeSpline(e, bezPts, raw.arrowTip);
}

/** Route and install spline + arrowhead(s) for a single edge. */
export function routeOneEdge(e: GraphEdge, g: Graph): void {
  const dirAttr = e.attrs.get('dir') ?? 'forward';
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
  const rankInfo = rankEdgeInfoOf(g, e.tail, e.head);
  const result = straightEdgeSplineWithRank(tailBox, headBox, rankInfo, edgePenwidthAttr(e));
  installEdgeSpline(e, result.bezierPts, result.arrowTip);
  (e.info as unknown as Record<string, unknown>)._arrowPts = arrowheadPolygon(result.arrowTip, result.arrowDir, pw);
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
