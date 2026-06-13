// SPDX-License-Identifier: EPL-2.0

/**
 * Multi-rank edge routing via virtual-node chains.
 *
 * Both back-edges (tail.rank > head.rank) and forward edges spanning
 * more than one rank (head.rank > tail.rank + 1) are routed by
 * walking the virtual-node chain that class2/makeChain created and
 * building a corridor-box path through every intermediate rank.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag path)
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge as GraphEdge } from '../../model/edge.js';
import type { Point, Box } from '../../model/geom.js';
import { normalizeVec, negateVec } from './edge-route-geom.js';
import type { NodeBox } from './edge-route-geom.js';
import { arrowheadPolygon } from './edge-route-arrow.js';
import { computeSplineMulti } from './edge-route-poly.js';
import { bezierClipNode, arrowEndClip, tailArrowEndClip } from './edge-route-clip.js';
import { nodeInsideFn, routeEdgeRaw, normalArrowLen } from './edge-route-routing.js';
import { rankEdgeInfoOf, computeLeftBound, computeRightBound } from './edge-route-rank.js';
import { makeTailBox, makeHeadBox, makeRankBox, makeMaximalBbox } from './edge-route-boxes.js';
import type { RankBoxParams } from './edge-route-boxes.js';
import {
  nodeBoxOf, edgeRenderPenwidth, edgePenwidthAttr,
  installEdgeSpline, straightEdgeSplineWithRank, routeBezier, defaultEdgeDir,
} from './edge-route-helpers.js';

// ---------------------------------------------------------------------------
// Chain-walking helpers
// ---------------------------------------------------------------------------

/** Walk virtual chain from e.head to e.tail (back-edge direction). */
export function walkVirtChain(e: GraphEdge): Node[] {
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

/** Walk virtual chain from e.tail to e.head (forward-edge direction). */
export function walkFwdVirtChain(e: GraphEdge): Node[] {
  const nodes: Node[] = [e.tail];
  let cur = e.info.to_virt;
  while (cur !== undefined && cur.head !== e.head) {
    nodes.push(cur.head);
    const out = cur.head.info.out;
    cur = (out !== undefined && out.size > 0) ? out.list[0] : undefined;
  }
  nodes.push(e.head);
  return nodes;
}

// ---------------------------------------------------------------------------
// Virtual-node corridor helpers
// ---------------------------------------------------------------------------

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

/** Rank box for one intermediate virtual node. */
export function buildBackEdgeVirtBox(v: Node, g: Graph, lb: number, rb: number): Box {
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
export function buildBackEdgeGapBox(from: Node, to: Node, g: Graph, lb: number, rb: number): Box {
  const rArr = g.info.rank!;
  const fromRk = rArr[from.info.rank!]!;
  const toRk = rArr[to.info.rank!]!;
  const fromLLX = leftNeighborLLX(from, g);
  const toLLX = leftNeighborLLX(to, g);
  const llx = (fromLLX > -Infinity && toLLX > -Infinity)
    ? Math.min(fromLLX, toLLX) : lb;
  const rp: RankBoxParams = {
    llx, urx: rb,
    tailCy: from.info.coord.y, tailHt1: fromRk.ht1,
    headCy: to.info.coord.y, headHt2: toRk.ht2,
  };
  return makeRankBox(rp);
}

/** Build corridor boxes for a chain [first, ...intermediates, last]. */
function buildChainBoxes(chain: Node[], g: Graph): Box[] {
  const lb = computeLeftBound(g);
  const rb = computeRightBound(g);
  const first = chain[0]!;
  const last = chain[chain.length - 1]!;
  const firstBox = nodeBoxOf(first, g);
  const lastBox = nodeBoxOf(last, g);
  const rArr = g.info.rank!;
  const firstRk = rArr[first.info.rank!]!;
  const lastRk = rArr[last.info.rank!]!;
  const boxes: Box[] = [makeTailBox(makeMaximalBbox(firstBox, firstRk.ht1, firstRk.ht2), first.info.coord.y)];
  for (let i = 0; i < chain.length - 1; i++) {
    boxes.push(buildBackEdgeGapBox(chain[i]!, chain[i + 1]!, g, lb, rb));
    if (i + 1 < chain.length - 1) {
      boxes.push(buildBackEdgeVirtBox(chain[i + 1]!, g, lb, rb));
    }
  }
  boxes.push(makeHeadBox(makeMaximalBbox(lastBox, lastRk.ht1, lastRk.ht2), last.info.coord.y));
  return boxes;
}

// ---------------------------------------------------------------------------
// Compound bezier clipping
// ---------------------------------------------------------------------------

/** Clip first 4 pts of a compound bezier to tailBox. */
export function clipCompoundTail(pts: Point[], box: NodeBox): Point[] {
  const first4 = [pts[0]!, pts[1]!, pts[2]!, pts[3]!];
  const clipped = bezierClipNode(first4, box.center.x, box.center.y, nodeInsideFn(box), true);
  return [...clipped, ...pts.slice(4)];
}

/** Clip last 4 pts of a compound bezier to headBox. */
export function clipCompoundHead(pts: Point[], box: NodeBox): Point[] {
  const n = pts.length;
  const last4 = [pts[n - 4]!, pts[n - 3]!, pts[n - 2]!, pts[n - 1]!];
  const clipped = bezierClipNode(last4, box.center.x, box.center.y, nodeInsideFn(box), false);
  return [...pts.slice(0, n - 4), ...clipped];
}

function arrowEndClipMulti(pts: Point[], arrowTip: Point, elen: number): Point[] {
  if (pts.length <= 4) return arrowEndClip(pts, arrowTip, elen);
  const n = pts.length;
  const last4 = [pts[n - 4]!, pts[n - 3]!, pts[n - 2]!, pts[n - 1]!];
  return [...pts.slice(0, n - 4), ...arrowEndClip(last4, arrowTip, elen)];
}

function tailArrowEndClipMulti(pts: Point[], tailTip: Point, elen: number): Point[] {
  if (pts.length <= 4) return tailArrowEndClip(pts, tailTip, elen);
  const first4 = [pts[0]!, pts[1]!, pts[2]!, pts[3]!];
  return [...tailArrowEndClip(first4, tailTip, elen), ...pts.slice(4)];
}

// ---------------------------------------------------------------------------
// Back-edge routing
// @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag back-edge path)
// ---------------------------------------------------------------------------

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
    const arrowbase = pts[pts.length - 1] as Point;
    const headDir = normalizeVec({ x: arrowbase.x - arrowTip.x, y: arrowbase.y - arrowTip.y });
    (e.info as unknown as Record<string, unknown>)._arrowPts = arrowheadPolygon(arrowTip, headDir, pw);
  }
  installEdgeSpline(e, pts, arrowTip);
}

/** Reverse and clip chain spline for a back-edge, return [clipped, arrowTip, arrowDir]. */
function reverseClipBackChain(
  fwd: Point[], tailBox: NodeBox, headBox: NodeBox,
): { clipped: Point[]; arrowTip: Point; arrowDir: Point } {
  const rev = fwd.slice().reverse();
  const clipped = clipCompoundHead(clipCompoundTail(rev, tailBox), headBox);
  const n = clipped.length;
  const arrowTip = clipped[n - 1] as Point;
  const arrowDir = normalizeVec({
    x: (clipped[n - 2] as Point).x - arrowTip.x,
    y: (clipped[n - 2] as Point).y - arrowTip.y,
  });
  return { clipped, arrowTip, arrowDir };
}

/**
 * Route a multi-rank back-edge via its virtual node chain.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag back-edge path)
 */
export function routeBackEdge(e: GraphEdge, tailBox: NodeBox, headBox: NodeBox, g: Graph): void {
  const dirAttr = e.attrs.get('dir') ?? defaultEdgeDir(g);
  const chain = walkVirtChain(e);
  if (chain.length < 2) {
    const raw = routeEdgeRaw(tailBox, headBox, undefined, routeBezier);
    installEdgeSpline(e, raw.bezierPts, raw.arrowTip);
    return;
  }
  const aNode = chain[0]!;
  const dNode = chain[chain.length - 1]!;
  const fwd = computeSplineMulti(buildChainBoxes(chain, g),
    { x: aNode.info.coord.x, y: aNode.info.coord.y - 1 },
    { x: dNode.info.coord.x, y: dNode.info.coord.y + 1 });
  const { clipped, arrowTip, arrowDir } = reverseClipBackChain(fwd, tailBox, headBox);
  applyBackEdgeArrows(e, clipped, arrowTip, arrowDir, dirAttr);
}

// ---------------------------------------------------------------------------
// Forward multi-rank edge routing
// @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag forward path)
// ---------------------------------------------------------------------------

/**
 * Clip compound-bezier arrowhead for a forward multi-rank edge and install.
 * arrowTip = node-boundary clip point (C's spl.ep); pts end at arrowhead base.
 */
function applyFwdEdgeArrow(e: GraphEdge, clipped: Point[], dirAttr: string): void {
  const arrowTip = clipped[clipped.length - 1] as Point;
  // dir=none/back draws no head arrow: install the full node-clipped spline.
  if (dirAttr !== 'forward' && dirAttr !== 'both') {
    installEdgeSpline(e, clipped, arrowTip);
    return;
  }
  const elen = normalArrowLen(edgePenwidthAttr(e));
  // arrowEndClipMulti: only last 4 pts are the final segment — using
  // arrowEndClip on the full array would read the wrong segment.
  const withBase = arrowEndClipMulti(clipped, arrowTip, elen);
  // C: arrow_gen(ep, list[size-1]) — direction is last stored pt → ep (tip).
  // list[size-1] is the arrowBase = withBase[length-1], NOT length-2.
  const arrowBase = withBase[withBase.length - 1] as Point;
  const dir = normalizeVec({ x: arrowBase.x - arrowTip.x, y: arrowBase.y - arrowTip.y });
  (e.info as unknown as Record<string, unknown>)._arrowPts =
    arrowheadPolygon(arrowTip, dir, edgeRenderPenwidth(e));
  installEdgeSpline(e, withBase, arrowTip);
}

/**
 * Route a forward edge spanning more than one rank via its virtual node chain.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag path, forward case)
 */
export function routeFwdMultiRankEdge(
  e: GraphEdge, tailBox: NodeBox, headBox: NodeBox, g: Graph, dirAttr: string,
): void {
  const wantHead = dirAttr === 'forward' || dirAttr === 'both';
  const chain = walkFwdVirtChain(e);
  if (chain.length < 3) {
    const rankInfo = rankEdgeInfoOf(g, e.tail, e.head);
    const result = straightEdgeSplineWithRank(tailBox, headBox, rankInfo, edgePenwidthAttr(e));
    installEdgeSpline(e, result.bezierPts, result.arrowTip);
    if (wantHead) {
      (e.info as unknown as Record<string, unknown>)._arrowPts =
        arrowheadPolygon(result.arrowTip, result.arrowDir, edgeRenderPenwidth(e));
    }
    return;
  }
  const tailNode = chain[0]!;
  const headNode = chain[chain.length - 1]!;
  const boxes = buildChainBoxes(chain, g);
  const pts = computeSplineMulti(boxes,
    { x: tailNode.info.coord.x, y: tailNode.info.coord.y - 1 },
    { x: headNode.info.coord.x, y: headNode.info.coord.y + 1 });
  applyFwdEdgeArrow(e, clipCompoundHead(clipCompoundTail(pts, tailBox), headBox), dirAttr);
}
