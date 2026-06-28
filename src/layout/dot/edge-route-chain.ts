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
import type { Node } from '../../model/node.js';
import { VIRTUAL, NORMAL } from './fastgr.js';
import type { NodeBox } from './edge-route-geom.js';
import { computeLeftBound, computeRightBound } from './edge-route-rank.js';
import type { Path, PathendT } from '../../common/types.js';
import { makePort } from '../../model/edgeInfo.js';
import { beginPath } from '../../common/splines-path-begin.js';
import { endPath } from '../../common/splines-path-end.js';
import { routeRegularByType } from './splines-route-type.js';
import { edgeType, EDGETYPE_LINE, getMainEdge, swapEndsP, swapSpline } from './splines.js';
import { clipAndInstall } from '../../common/splines-clip.js';
import { buildDotSinfo } from './self-loop.js';
import { TOP, BOTTOM, REGULAREDGE } from '../../common/splines-constants.js';
import { splineMerge, makeLineEdge, resizeVn, straightLen, straightPath } from './splines-route.js';
import { EDGE_LABEL } from './rank.js';
import type { RankEntry } from '../../model/rankEntry.js';
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
 *  the chain's virtual nodes exercise. C's GD_nodesep is an `int` (types.h:334)
 *  and the divide is INTEGER (18/4=4); a float divide here (4.5) makes
 *  maximal_bbox's round() straddle the boundary, shifting a virtual-node box
 *  wall 1px and forcing an extra bezier piece on near-straight long edges
 *  (rankdir_dot Unix/TS 3.0->TS 4.0). Truncate to mirror C. */
function chainBboxCtx(g: Graph): BboxCtx {
  return {
    g,
    sp: {
      leftBound: computeLeftBound(g),
      rightBound: computeRightBound(g),
      splinesep: Math.trunc((g.info.nodesep ?? 18) / 4),
    },
  };
}

/** Segment edges of a forward virtual chain: tail→v1, v1→v2, …, vk→head. */
function chainSegments(e: GraphEdge): GraphEdge[] {
  const segs: GraphEdge[] = [];
  let cur = e.info.to_virt;
  while (cur !== undefined) {
    // Resolve the concentrate merge redirect to the representative chain (C: for
    // rep=e; ED_to_virt(rep); rep=ED_to_virt(rep)). @see lib/dotgen/conc.c:rebuild_vlists
    while (cur.info.to_virt !== undefined) cur = cur.info.to_virt;
    segs.push(cur);
    if (cur.head === e.head) break;
    const out = cur.head.info.out;
    cur = out !== undefined && out.size > 0 ? out.list[0] : undefined;
  }
  return segs;
}

/** beginPath/endPath args for a single non-merged REGULAREDGE chain segment. */
function chainPathArgs(P: Path, e: GraphEdge, endp: PathendT, merge: boolean, ranksep: number) {
  return { P, e, et: REGULAREDGE, endp, merge, ranksep, pboxfn: null };
}

/** True when n is a non-merged virtual chain node (the C while-loop guard). */
function isChainVirtual(n: Node): boolean {
  return (n.info.node_type ?? NORMAL) === VIRTUAL && !splineMerge(n);
}

/**
 * straight_len smode threshold: a collinear run is segmented once it is ≥ 5
 * (4+1) with edge labels on the root graph, else ≥ 3 (2+1).
 * @see lib/dotgen/dotsplines.c:make_regular_edge (GD_has_labels & EDGE_LABEL)
 */
function smodeThreshold(g: Graph): number {
  return ((g.root.info.has_labels ?? 0) & EDGE_LABEL) ? 5 : 3;
}

/** Mutable state threaded through the make_regular_edge chain walk. */
interface ChainWalk {
  ctx: BboxCtx;
  ranks: RankEntry[];
  ranksep: number;
  et: number;
  P: Path;
  pts: Point[];
  boxes: Box[];
  segfirst: GraphEdge;
  tend: PathendT;
}

function newChainWalk(g: Graph, segs: GraphEdge[]): ChainWalk {
  return {
    ctx: chainBboxCtx(g), ranks: g.info.rank!, ranksep: graphRanksep(g), et: edgeType(g),
    P: { start: makePort(), end: makePort(), nbox: 0, boxes: [], data: null },
    pts: [], boxes: [], segfirst: segs[0],
    tend: freshEndp({ ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } }),
  };
}

/**
 * Open a segment: build the tail box from `chainEdge` (real chain geometry),
 * beginPath on `portEdge` (carries the real tail port for segment 0; the
 * virtual segment edge thereafter), and append the BOTTOM regular end.
 * `constrain` forces the straight-middle exit slope on post-straight segments.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (beginpath + makeregularend BOTTOM)
 */
function beginSeg(
  w: ChainWalk, portEdge: GraphEdge, chainEdge: GraphEdge, ie: GraphEdge | undefined, constrain: boolean,
): void {
  const tn = chainEdge.tail;
  w.tend = freshEndp(maximalBbox(w.ctx, tn, ie, chainEdge));
  // merge tested on the node beginPath/concSlope uses (portEdge.tail), not the
  // chain segment's tail — they differ when a concentrate-merged chain starts at
  // a merge node while portEdge carries the real (normal) tail. Symmetric to
  // endSeg. @see lib/dotgen/dotsplines.c:make_regular_edge (spline_merge(agtail(e)))
  beginPath(chainPathArgs(w.P, portEdge, w.tend, splineMerge(portEdge.tail), w.ranksep));
  appendRegularEnd(w.tend.nb, w.tend, BOTTOM, tn.info.coord.y - rankHt(w.ranks[tn.info.rank!].ht1, tn.info.ht));
  if (constrain) { w.P.start.theta = -Math.PI / 2; w.P.start.constrained = true; }
}

/**
 * Close a segment: build the head box from `chainEdge`, endPath on `portEdge`
 * (the real head port for the final segment; the virtual segment edge for an
 * smode top), append the TOP regular end, optionally constrain the entry slope
 * (smode top), then complete + route the path and append the control points.
 * Returns false when the path cannot be assembled.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (endpath + completeregularpath + routesplines)
 */
function endSeg(
  w: ChainWalk, portEdge: GraphEdge, chainEdge: GraphEdge, oe: GraphEdge | undefined, constrain: boolean,
): boolean {
  const hn = chainEdge.head;
  const hend = freshEndp(maximalBbox(w.ctx, hn, chainEdge, oe));
  // merge must be tested on the node endPath/concSlope actually uses (the path
  // edge's head = portEdge.head), as C does (spline_merge(aghead(e))) — NOT the
  // chain segment's head. They differ in the final segment when the chain ends
  // at a concentrator merge node while portEdge carries the real (normal) head;
  // testing the merge node there would call concSlope on the normal sink (0
  // in/out edges) and crash. @see lib/dotgen/dotsplines.c:make_regular_edge
  endPath(chainPathArgs(w.P, portEdge, hend, splineMerge(portEdge.head), w.ranksep));
  appendRegularEnd(hend.nb, hend, TOP, hn.info.coord.y + rankHt(w.ranks[hn.info.rank!].ht2, hn.info.ht));
  if (constrain) { w.P.end.theta = Math.PI / 2; w.P.end.constrained = true; }
  if (!completeRegularPath({ P: w.P, first: w.segfirst, last: chainEdge, tend: w.tend, hend, boxes: w.boxes })) {
    return false;
  }
  const seg = routeRegularByType(w.P, w.et);
  if (seg === null) return false;
  for (const p of seg) w.pts.push(p);
  return true;
}

/**
 * Close an smode top segment at `segs[ci]` (constrained entry slope), emit the
 * straight middle as duplicate points, recover slack, then open the next
 * segment at the post-straight edge with a constrained exit slope. Returns the
 * chain index of the next segment's first edge, or -1 when routing fails.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (smode close + straight_path)
 */
function closeSmodeSeg(w: ChainWalk, segs: GraphEdge[], ci: number, sl: number, segFirst: number): number {
  if (!endSeg(w, segs[ci], segs[ci], segs[ci + 1], true)) return -1;
  straightPath(segs[ci + 1], sl, w.pts);
  recoverSlack(segs.slice(segFirst), w.P);
  const next = ci + 1 + sl;
  w.segfirst = segs[next];
  w.boxes = [];
  beginSeg(w, segs[next], segs[next], segs[next].tail.info.in!.list[0], true);
  return next;
}

/** Route the final (post-loop) chain segment, ending at the real head node. */
function finishChain(
  w: ChainWalk, portEdge: GraphEdge, lastEdge: GraphEdge, segFirst: number, segs: GraphEdge[],
): boolean {
  w.boxes.push(rankBox(w.ctx, lastEdge.tail.info.rank!));
  if (!endSeg(w, portEdge, lastEdge, undefined, false)) return false;
  recoverSlack(segs.slice(segFirst), w.P);
  return true;
}

/**
 * Route a virtual-node chain through the faithful pipeline, accumulating the
 * make_regular_edge spline points. Below the straight_len threshold this emits a
 * single segment (byte-identical to the prior single-pass routing); a long
 * collinear vnode run is split into spline-top + straight-middle + spline-bottom
 * via successive beginpath/endpath/routesplines calls, hugging the corridor.
 * `e` carries the real end ports (first beginpath, final endpath); the chain
 * edges drive the box geometry.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (1771-1873 smode loop)
 */
function routeChainSegmented(g: Graph, e: GraphEdge, segs: GraphEdge[]): Point[] | null {
  const w = newChainWalk(g, segs);
  const thr = smodeThreshold(g);
  beginSeg(w, e, segs[0], undefined, false);
  let ei = 0, segFirst = 0, smode = false, si = false, sl = 0;
  while (isChainVirtual(segs[ei].head)) {
    w.boxes.push(rankBox(w.ctx, segs[ei].tail.info.rank!));
    if (!smode) { sl = straightLen(segs[ei].head); if (sl >= thr) { smode = true; si = true; sl -= 2; } }
    if (smode && !si) {
      ei = closeSmodeSeg(w, segs, ei, sl, segFirst);
      if (ei < 0) return null;
      segFirst = ei; smode = false;
      continue;
    }
    si = false;
    w.boxes.push(maximalBbox(w.ctx, segs[ei].head, segs[ei], segs[ei + 1]));
    ei++;
  }
  return finishChain(w, e, segs[ei], segFirst, segs) ? w.pts : null;
}

/**
 * Route a forward edge spanning ≥2 ranks via its virtual-node chain through the
 * faithful pipeline (REGULAREDGE side boxes steer the port, routeSplines over
 * the chain; adjustregularpath inter-rank widening finally fires). Returns
 * control points in graphviz-internal y-up, or null when the edge is not a
 * multi-rank chain.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag forward path)
 */
export function routeMultiRankEdgeFaithful(g: Graph, e: GraphEdge): Point[] | null {
  const r = e.tail.info.rank;
  const rh = e.head.info.rank;
  if (g.info.rank === undefined || r === undefined || rh === undefined || rh <= r + 1) return null;
  const et = edgeType(g);
  // EDGETYPE_LINE: C tries makeLineEdge first (direct tail→head segment),
  // falling back to the box corridor only when it declines (delr==1, or delr==2
  // with edge labels). @see lib/dotgen/dotsplines.c:make_regular_edge (1757)
  if (et === EDGETYPE_LINE) {
    const line = makeLineEdge(g, e);
    if (line !== null) return line;
  }
  const segs = chainSegments(e);
  // Route only a COMPLETE chain (last segment reaches e.head). segs.length===1 is
  // valid (concentrate may merge the whole chain to a direct tail->head segment);
  // a chain ending at a virtual node is broken — bail, don't crash the loop.
  // @see dotsplines.c:make_regular_edge
  if (segs.length === 0 || segs[segs.length - 1].head !== e.head) return null;
  return routeChainSegmented(g, e, segs);
}

/** One merge-bounded run: segments ending at an interior spline_merge node. */
interface ChainRun { segs: GraphEdge[]; tail: Node; head: Node; }

/** Split a chain into runs at interior spline_merge boundaries — one bezier per
 *  run. @see lib/dotgen/dotsplines.c:dot_splines_ (NORMAL || spline_merge gather) */
function splitChainRuns(segs: GraphEdge[], eHead: Node): ChainRun[] {
  const runs: ChainRun[] = [];
  let cur: GraphEdge[] = [];
  for (const s of segs) {
    cur.push(s);
    if (splineMerge(s.head) && s.head !== eHead) { runs.push({ segs: cur, tail: cur[0].tail, head: s.head }); cur = []; }
  }
  if (cur.length > 0) runs.push({ segs: cur, tail: cur[0].tail, head: cur[cur.length - 1].head });
  return runs;
}

/** Synthetic forward edge for one run; `to_orig`=orig installs on the rep. */
function runEdge(orig: GraphEdge, run: ChainRun): GraphEdge {
  const tailPort = run.tail === orig.tail ? orig.info.tail_port : makePort();
  const headPort = run.head === orig.head ? orig.info.head_port : makePort();
  return { ...orig, tail: run.tail, head: run.head,
    info: { ...orig.info, tail_port: tailPort, head_port: headPort, to_orig: orig, edge_type: VIRTUAL } } as GraphEdge;
}

/** Merge-bounded runs of e's forward chain, or null when none is interior. */
function mergedChainRuns(g: Graph, e: GraphEdge): ChainRun[] | null {
  const r = e.tail.info.rank, rh = e.head.info.rank;
  if (g.info.rank === undefined || r === undefined || rh === undefined || rh <= r) return null;
  const segs = chainSegments(e);
  if (segs.length === 0 || segs[segs.length - 1].head !== e.head) return null;
  const runs = splitChainRuns(segs, e.head);
  return runs.length > 1 ? runs : null;
}

/**
 * Route a concentrate-merged forward chain as one bezier per merge-bounded run,
 * on the representative — C's per-segment gather + clip_and_install accumulation.
 * A trunk run (starting at a merge node) is routed only by its owner (getMainEdge
 * of its first segment), so a non-rep member draws only its lead-in. False ⇒
 * plain chain; route as a single spline. @see dotsplines.c:make_regular_edge
 */
export function routeMergedChain(g: Graph, e: GraphEdge): boolean {
  const runs = mergedChainRuns(g, e);
  if (runs === null) return false;
  const sinfo = buildDotSinfo();
  for (const run of runs) {
    if (getMainEdge(run.segs[0]) !== e) continue; // trunk owned by another representative
    const fe = runEdge(e, run);
    const pts = routeChainSegmented(g, fe, run.segs);
    if (pts !== null) clipAndInstall(fe, run.head, pts, pts.length, sinfo);
  }
  return e.info.spl !== undefined;
}

/**
 * After splining, reposition each chain virtual node into the routing box that
 * contains it (boxes run high-y to low-y). Label vnodes are anchored to the
 * box's right edge (center = box.ur.x + rw); plain vnodes are centred. This is
 * what aligns a flat-adj aux label vnode onto its spline so the label lands at
 * the dot position (DOT-12). @see lib/dotgen/dotsplines.c:recover_slack
 */
function resizeVnInBox(vn: Node, box: Box): void {
  if (vn.info.label != null) resizeVn(vn, box.ll.x, box.ur.x, box.ur.x + vn.info.rw);
  else resizeVn(vn, box.ll.x, (box.ll.x + box.ur.x) / 2, box.ur.x);
}

function recoverSlack(segs: GraphEdge[], P: Path): void {
  let b = 0; // skip first rank box
  for (let i = 0; i < segs.length; i++) {
    const vn = segs[i].head;
    if ((vn.info.node_type ?? NORMAL) !== VIRTUAL || splineMerge(vn)) break;
    while (b < P.nbox && P.boxes[b].ll.y > vn.info.coord.y) b++;
    if (b >= P.nbox) break;
    if (P.boxes[b].ur.y >= vn.info.coord.y) resizeVnInBox(vn, P.boxes[b]);
  }
}

// ---------------------------------------------------------------------------
// Back-edge routing
// @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag back-edge path)
// ---------------------------------------------------------------------------

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
      // C makefwdedge SWAPS the ports (does not strip them): a back edge keeps
      // its corner ports across the forward view so make_regular_edge curls it
      // (e.g. #241_0 aux back-edge clone sw/se → size 7). Stripping to an empty
      // Center port straightened every port-bearing back edge (size 4).
      // @see lib/dotgen/dotsplines.c:makefwdedge (ED_tail_port(new)=ED_head_port(old))
      tail_port: e.info.head_port ?? makePort(),
      head_port: e.info.tail_port ?? makePort(),
      to_orig: e,
      edge_type: VIRTUAL,
    },
  } as GraphEdge;
}


/**
 * Route a multi-rank back-edge via its virtual node chain, mirroring C exactly:
 * make_regular_edge routes the makefwdedge (forward) view, clip_and_install
 * clips THAT forward spline, and the spline is reversed afterward (swapSpline).
 *
 * Clipping the forward (un-reversed) spline is load-bearing: bezier_clip bisects
 * each node end from the same direction C does. The previous reverse-then-clip
 * path clipped the head node as a tail (bisecting the degenerate spline from the
 * opposite parameter end), landing the 0.5-tolerance crossing ~0.26-0.33 off
 * (1644, dfa family). clipAndInstall resolves the spline onto `e` via the
 * fwdEdge's to_orig and gates arrows by ED_dir, so this also drops the bespoke
 * reverse/arrow code. @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag)
 */
export function routeBackEdge(e: GraphEdge, _tailBox: NodeBox, _headBox: NodeBox, g: Graph): void {
  const segs = backChainSegments(e);
  if (segs.length < 2 || segs[segs.length - 1].head !== e.tail) return;
  const fwdEdge = makeFwdEdge(e);
  const fwd = routeChainSegmented(g, fwdEdge, segs);
  if (fwd === null) return;
  clipAndInstall(fwdEdge, fwdEdge.head, fwd, fwd.length, buildDotSinfo());
  if (swapEndsP(e) && e.info.spl !== undefined) swapSpline(e.info.spl);
}
