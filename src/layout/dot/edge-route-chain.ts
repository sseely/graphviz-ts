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
import type { Edge as GraphEdge } from '../../model/edge.js';
import type { Point, Box } from '../../model/geom.js';
import { VIRTUAL } from './fastgr.js';
import { normalizeVec, negateVec } from './edge-route-geom.js';
import type { NodeBox } from './edge-route-geom.js';
import { arrowheadPolygon } from './edge-route-arrow.js';
import { bezierClipNode, arrowEndClip, tailArrowEndClip } from './edge-route-clip.js';
import { nodeInsideFn, normalArrowLen } from './edge-route-routing.js';
import { computeLeftBound, computeRightBound } from './edge-route-rank.js';
import {
  edgeRenderPenwidth, edgePenwidthAttr,
  installEdgeSpline, defaultEdgeDir,
} from './edge-route-helpers.js';
import type { Path, PathendT } from '../../common/types.js';
import { makePort } from '../../model/edgeInfo.js';
import { beginPath } from '../../common/splines-path-begin.js';
import { endPath } from '../../common/splines-path-end.js';
import { routeRegularByType } from './splines-route-type.js';
import { edgeType } from './splines.js';
import { TOP, BOTTOM, REGULAREDGE } from '../../common/splines-constants.js';
import { splineMerge } from './splines-route.js';
import { rankHt } from './edge-route-rank.js';
import { graphRanksep } from './position-aux.js';
import {
  maximalBbox, appendRegularEnd, freshEndp, rankBox, completeRegularPath,
  type BboxCtx,
} from './edge-route-faithful.js';

// ---------------------------------------------------------------------------
// Faithful multi-rank side-port routing (make_regular_edge hackflag path)
// @see lib/dotgen/dotsplines.c:make_regular_edge (forward, abs(rankdiff) > 1)
// ---------------------------------------------------------------------------

/** Per-call spline bounds. Splinesep = nodesep/4 (C's sd.Splinesep,
 *  dotsplines.c:267) sets the gap to VIRTUAL neighbors in maximal_bbox, which
 *  the chain's virtual nodes exercise. */
function chainBboxCtx(g: Graph): BboxCtx {
  return {
    g,
    sp: {
      leftBound: computeLeftBound(g),
      rightBound: computeRightBound(g),
      splinesep: (g.info.nodesep ?? 18) / 4,
    },
  };
}

/** Segment edges of a forward virtual chain: tail→v1, v1→v2, …, vk→head. */
function chainSegments(e: GraphEdge): GraphEdge[] {
  const segs: GraphEdge[] = [];
  let cur = e.info.to_virt;
  while (cur !== undefined) {
    segs.push(cur);
    if (cur.head === e.head) break;
    const out = cur.head.info.out;
    cur = out !== undefined && out.size > 0 ? out.list[0] : undefined;
  }
  return segs;
}

/**
 * Accumulate the inter-rank box plus, for each non-final segment, the virtual
 * node's maximal bbox — the body of make_regular_edge's chain `while` loop
 * (non-straight-mode). The final segment contributes only its rank box.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (while ND_node_type==VIRTUAL)
 */
function chainBoxes(ctx: BboxCtx, segs: GraphEdge[]): Box[] {
  const boxes: Box[] = [];
  for (let i = 0; i < segs.length; i++) {
    boxes.push(rankBox(ctx, segs[i].tail.info.rank!));
    if (i < segs.length - 1) {
      boxes.push(maximalBbox(ctx, segs[i].head, segs[i], segs[i + 1]));
    }
  }
  return boxes;
}

/** beginPath/endPath args for a single non-merged REGULAREDGE chain segment. */
function chainPathArgs(P: Path, e: GraphEdge, endp: PathendT, merge: boolean, ranksep: number) {
  return { P, e, et: REGULAREDGE, endp, merge, inEdges: [], outEdges: [], ranksep, pboxfn: null };
}

/**
 * Assemble the begin → chain boxes → end path for a multi-rank chain, then run
 * completeRegularPath. Returns the populated Path, or null if it cannot close.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag forward path body)
 */
function buildChainPath(g: Graph, e: GraphEdge, segs: GraphEdge[]): Path | null {
  const ranks = g.info.rank!;
  // Begin/end derive from the chain (low→high rank), so this serves forward
  // edges (tn=e.tail) and back edges (tn=e.head, reversed downstream) alike.
  const last = segs[segs.length - 1];
  const [tn, hn] = [segs[0].tail, last.head];
  const [r, rh] = [tn.info.rank!, hn.info.rank!];
  const ctx = chainBboxCtx(g);
  const ranksep = graphRanksep(g);
  const P: Path = { start: makePort(), end: makePort(), nbox: 0, boxes: [], data: null };
  const tend = freshEndp(maximalBbox(ctx, tn, undefined, segs[0]));
  beginPath(chainPathArgs(P, e, tend, splineMerge(tn), ranksep));
  appendRegularEnd(tend.nb, tend, BOTTOM, tn.info.coord.y - rankHt(ranks[r].ht1, tn.info.ht));
  const boxes = chainBoxes(ctx, segs);
  const hend = freshEndp(maximalBbox(ctx, hn, last, undefined));
  endPath(chainPathArgs(P, e, hend, splineMerge(hn), ranksep));
  appendRegularEnd(hend.nb, hend, TOP, hn.info.coord.y + rankHt(ranks[rh].ht2, hn.info.ht));
  return completeRegularPath({ P, first: segs[0], last, tend, hend, boxes }) ? P : null;
}

/**
 * Route a forward edge spanning ≥2 ranks via its virtual-node chain through the
 * faithful pipeline (REGULAREDGE side boxes steer the port, routeSplines over
 * the full chain; adjustregularpath inter-rank widening finally fires). Returns
 * control points in graphviz-internal y-up, or null when the edge is not a
 * multi-rank chain. Straight-mode runs (straight_len ≥ threshold) are not yet
 * ported — see decision journal.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag forward path)
 */
export function routeMultiRankEdgeFaithful(g: Graph, e: GraphEdge): Point[] | null {
  const r = e.tail.info.rank;
  const rh = e.head.info.rank;
  if (g.info.rank === undefined || r === undefined || rh === undefined || rh <= r + 1) return null;
  const segs = chainSegments(e);
  if (segs.length < 2) return null;
  const P = buildChainPath(g, e, segs);
  return P === null ? null : routeRegularByType(P, edgeType(g));
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
 * Virtual-chain segments of a multi-rank back edge in low-rank → high-rank
 * order (e.head → e.tail). `chainSegments` cannot be reused: it stops at
 * e.head, which is the chain's START for a back edge.
 */
function backChainSegments(e: GraphEdge): GraphEdge[] {
  const segs: GraphEdge[] = [];
  let cur = e.info.to_virt;
  while (cur !== undefined) {
    segs.push(cur);
    if (cur.head === e.tail) break;
    cur = cur.head.info.out?.list[0];
  }
  return segs;
}

/**
 * Forward view of any edge (C `makefwdedge`): tail/head swapped when the edge
 * runs high→low rank (a back edge), fresh portless ends. `beginPath`/`endPath`
 * read `e.tail`/`e.head`, so the chain must be driven by an edge that runs
 * low→high rank. Sets `to_orig`/`edge_type=VIRTUAL` so `clipAndInstall`→
 * `newSpline` installs the spline on the ORIGINAL edge (its `to_orig` loop) and
 * the post-routing `swapSpline` pass reverses it back to tail→head. Shares
 * `attrs`/`root`/`to_virt` with `e`. Consumed by T3 for parallel back-members.
 * @see lib/dotgen/dotsplines.c:makefwdedge
 * @see lib/common/splines.c:clip_and_install (to_orig install loop)
 */
export function makeFwdEdge(e: GraphEdge): GraphEdge {
  const back = (e.head.info.rank ?? 0) < (e.tail.info.rank ?? 0);
  const [tail, head] = back ? [e.head, e.tail] : [e.tail, e.head];
  return {
    ...e,
    tail,
    head,
    info: {
      ...e.info,
      tail_port: makePort(),
      head_port: makePort(),
      to_orig: e,
      edge_type: VIRTUAL,
    },
  } as GraphEdge;
}

/**
 * Forward-geometry chain spline for a multi-rank back edge (low→high rank
 * order, i.e. e.head → e.tail), or null when it cannot be assembled. A back
 * edge is the forward edge with swapped ends (C makefwdedge); the caller
 * reverses + clips. @see lib/dotgen/dotsplines.c:make_regular_edge (BWDEDGE)
 */
function faithfulBackFwdPoints(g: Graph, e: GraphEdge): Point[] | null {
  const segs = backChainSegments(e);
  if (segs.length < 2 || segs[segs.length - 1].head !== e.tail) return null;
  const P = buildChainPath(g, makeFwdEdge(e), segs);
  return P === null ? null : routeRegularByType(P, edgeType(g));
}

/**
 * Route a multi-rank back-edge via its virtual node chain: route the forward
 * geometry faithfully (make_regular_edge over the reversed chain) then reverse
 * + clip. Leaves the edge unrouted only if the faithful path cannot assemble
 * the chain (it always can for a real multi-rank back edge).
 * @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag back-edge path)
 */
export function routeBackEdge(e: GraphEdge, tailBox: NodeBox, headBox: NodeBox, g: Graph): void {
  const dirAttr = e.attrs.get('dir') ?? defaultEdgeDir(g);
  const fwd = faithfulBackFwdPoints(g, e);
  if (fwd === null) return;
  const { clipped, arrowTip, arrowDir } = reverseClipBackChain(fwd, tailBox, headBox);
  applyBackEdgeArrows(e, clipped, arrowTip, arrowDir, dirAttr);
}
