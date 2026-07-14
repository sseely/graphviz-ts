// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of lib/dotgen/flat.c.
 *
 * Handles labeled flat (same-rank) edges: virtual node insertion into rank
 * arrays, label-node slot allocation, and the abomination rank-array shift
 * when labeled flat edges fall at rank 0.
 *
 * Note: all functions are exported because lizard 1.22.1's TypeScript parser
 * only recognises function boundaries when the `export` keyword is present.
 * Non-exported TS functions with return-type annotations cause the parser to
 * merge them into the preceding function's body, inflating CCN counts.
 *
 * @see lib/dotgen/flat.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { RankEntry } from '../../model/rankEntry.js';
import type { EdgeList } from '../../model/nodeInfo.js';
import { FLATORDER, NORMAL, VIRTUAL, virtualNode, virtualEdge } from './fastgr.js';
import { recSaveVlists, recResetVlists, dotRoot } from './mincross.js';
import { checkLabelOrder } from './label-order.js';
import {
  nodeOrder, nodeRank, graphMaxrank, graphMinrank, getOrd,
} from './flat-utils.js';
import type { TextlabelT } from '../../common/types.js';

// ---------------------------------------------------------------------------
// make_vn_slot  @see lib/dotgen/flat.c:make_vn_slot
// ---------------------------------------------------------------------------

export function shiftSlotRight(rk: RankEntry, pos: number): void {
  for (let i = rk.n; i > pos; i--) {
    rk.v[i] = rk.v[i - 1];
    const cur = rk.v[i];
    const curOrd = cur.info.order;
    if (curOrd !== undefined) cur.info.order = curOrd + 1;
    else cur.info.order = 1;
  }
}

/**
 * Insert a virtual node slot at position `pos` in rank `r` of graph `g`.
 * @see lib/dotgen/flat.c:make_vn_slot
 */
export function makeVnSlot(g: Graph, r: number, pos: number): Node {
  const rk = g.info.rank![r];
  if (rk.v.length <= rk.n + 1) rk.v.push(null as unknown as Node);
  shiftSlotRight(rk, pos);
  const v = virtualNode(g);
  rk.v[pos] = v;
  v.info.order = pos;
  v.info.rank = r;
  rk.n++;
  return v;
}

// ---------------------------------------------------------------------------
// flat_limits  @see lib/dotgen/flat.c:flat_limits / setbounds / findlr
//
// Placement of a labeled flat edge's label virtual node on rank r-1 is
// topology-aware: it does NOT compare the r-1 vnodes' own orders against the
// flat edge's endpoint orders (those live on a different rank). Instead, for
// each node already on rank r-1, it inspects where that node's edges connect on
// rank r relative to the flat edge's endpoint-order span [lpos,rpos], and
// places the label at the midpoint of the resulting hard/soft bounds. A crude
// order-vs-order comparison mis-placed the label (graphviz #1213: the back-edge
// chain vnodes shifted +1 order, perturbing their positions and routing
// corridors and warping every constraint=false back-edge spline).
// ---------------------------------------------------------------------------

// bound indices @see lib/dotgen/flat.c HLB/HRB/SLB/SRB
const HLB = 0;
const HRB = 1;
const SLB = 2;
const SRB = 3;

/** Sorted [lo, hi] of the orders of u and v. @see lib/dotgen/flat.c:findlr */
export function findlr(u: Node, v: Node): [number, number] {
  const a = nodeOrder(u);
  const b = nodeOrder(v);
  return a > b ? [b, a] : [a, b];
}

/** A flat label vnode (no in-edges): bound by where its two endpoints sit
 *  relative to [lpos,rpos]. @see lib/dotgen/flat.c:setbounds (flat branch) */
export function setBoundsFlat(v: Node, bounds: number[], lpos: number, rpos: number): void {
  const out = v.info.out;
  if (out === undefined || out.size < 2) return; // C asserts size == 2
  const ord = nodeOrder(v);
  const [l, r] = findlr(out.list[0].head, out.list[1].head);
  if (r <= lpos) { bounds[SLB] = bounds[HLB] = ord; }
  else if (l >= rpos) { bounds[SRB] = bounds[HRB] = ord; }
  else if (l < lpos && r > rpos) { /* spanning this one — ignore */ }
  else {
    if (l < lpos || (l === lpos && r < rpos)) bounds[SLB] = ord;
    if (r > rpos || (r === rpos && l > lpos)) bounds[SRB] = ord;
  }
}

/** A forward chain vnode (has in-edges): hard-bound by whether all its
 *  downstream connections fall left or right of the span.
 *  @see lib/dotgen/flat.c:setbounds (forward branch) */
export function setBoundsForward(v: Node, bounds: number[], lpos: number, rpos: number): void {
  const out = v.info.out;
  const size = out?.size ?? 0;
  let onleft = false;
  let onright = false;
  for (let i = 0; i < size; i++) {
    const ho = nodeOrder(out!.list[i].head);
    if (ho <= lpos) { onleft = true; continue; }
    if (ho >= rpos) { onright = true; continue; }
  }
  const ord = nodeOrder(v);
  if (onleft && !onright) bounds[HLB] = ord + 1;
  if (onright && !onleft) bounds[HRB] = ord - 1;
}

/** Update label-placement bounds from one rank-(r-1) node `v`, given the flat
 *  edge's endpoint-order span [lpos,rpos] on rank r. @see lib/dotgen/flat.c:setbounds */
export function setBounds(v: Node, bounds: number[], lpos: number, rpos: number): void {
  if ((v.info.node_type ?? NORMAL) !== VIRTUAL) return;
  if ((v.info.in?.size ?? 0) === 0) setBoundsFlat(v, bounds, lpos, rpos);
  else setBoundsForward(v, bounds, lpos, rpos);
}

/**
 * Find the best order position for a flat-edge label virtual node in rank r-1.
 * Faithful port of C's bound-scan (NOT a simple order comparison).
 * @see lib/dotgen/flat.c:flat_limits
 */
export function flatLimits(g: Graph, e: Edge): number {
  const r = nodeRank(e.tail) - 1;
  if (r < 0 || !g.info.rank) return 0;
  const rk = g.info.rank[r];
  let lnode = 0;
  let rnode = rk.n - 1;
  // bounds = [HLB, HRB, SLB, SRB]
  const bounds = [lnode - 1, rnode + 1, lnode - 1, rnode + 1];
  const [lpos, rpos] = findlr(e.tail, e.head);
  while (lnode <= rnode) {
    setBounds(rk.v[lnode], bounds, lpos, rpos);
    if (lnode !== rnode) setBounds(rk.v[rnode], bounds, lpos, rpos);
    lnode++;
    rnode--;
    if (bounds[HRB] - bounds[HLB] <= 1) break;
  }
  // C integer division truncates toward zero (Math.trunc).
  if (bounds[HLB] <= bounds[HRB]) return Math.trunc((bounds[HLB] + bounds[HRB] + 1) / 2);
  return Math.trunc((bounds[SLB] + bounds[SRB] + 1) / 2);
}

// ---------------------------------------------------------------------------
// flat_node  @see lib/dotgen/flat.c:flat_node
// ---------------------------------------------------------------------------

type LabelWithDimen = { dimen?: { x: number; y: number } };

export function graphRanksep(g: Graph): number {
  return g.info.ranksep ?? 0;
}

/**
 * ypos = LL.y of the label box, grabbed before make_vn_slot so the new slot does
 * not perturb it. @see lib/dotgen/flat.c:flat_node 154-159
 */
export function flatLabelYpos(g: Graph, r: number): number {
  const rank = g.info.rank!;
  const above = rank[r - 1].v[0];
  if (above) return above.info.coord.y - rank[r - 1].ht1;
  const here = rank[r].v[0];
  return here.info.coord.y + rank[r].ht2 + graphRanksep(g);
}

/**
 * Set ht/lw/rw on the label vnode from the label dimen (flip swaps x/y); return
 * half-height. @see lib/dotgen/flat.c:flat_node 161-167
 */
export function flatNodeDims(g: Graph, vn: Node, lbl: TextlabelT): number {
  let dx = lbl.dimen.x;
  let dy = lbl.dimen.y;
  if (g.info.flip === true) { const t = dx; dx = dy; dy = t; }
  vn.info.ht = dy;
  vn.info.lw = vn.info.rw = dx / 2;
  return dy / 2;
}

/**
 * Create the two FLATORDER virtual edges (vn→tail, vn→head) with label ports.
 * @see lib/dotgen/flat.c:flat_node 170-177
 */
export function flatNodeEdges(vn: Node, e: Edge): void {
  const et = virtualEdge(vn, e.tail, e);
  et.info.tail_port.p.x = -vn.info.lw;
  et.info.head_port.p.x = e.tail.info.rw;
  et.info.edge_type = FLATORDER;
  const eh = virtualEdge(vn, e.head, e);
  eh.info.tail_port.p.x = vn.info.rw;
  eh.info.head_port.p.x = e.head.info.lw;
  eh.info.edge_type = FLATORDER;
}

/** Create a VIRTUAL label node (ND_alg → e) above a non-adjacent flat edge.
 * @see lib/dotgen/flat.c:flat_node */
export function flatNode(e: Edge): void {
  const lbl = e.info.label;
  if (lbl === undefined) return;
  const g = e.tail.root;
  const r = nodeRank(e.tail);
  const place = flatLimits(g, e);
  const ypos = flatLabelYpos(g, r);
  const vn = makeVnSlot(g, r - 1, place);
  const h2 = flatNodeDims(g, vn, lbl);
  vn.info.label = lbl;
  vn.info.coord.y = ypos + h2;
  flatNodeEdges(vn, e);
  const rk = g.info.rank![r - 1];
  if (rk.ht1 < h2) rk.ht1 = h2;
  if (rk.ht2 < h2) rk.ht2 = h2;
  vn.info.posAlg = e;
}

// abomination  @see lib/dotgen/flat.c:abomination

/** Fresh empty rank entry (the slot vacated by the +1 renumber). */
export function emptyRankEntry(): RankEntry {
  return {
    n: 0, v: [], an: 0, av: [],
    ht1: 1, ht2: 1, pht1: 1, pht2: 1,
    candidate: false, valid: false, cache_nc: 0, flat: undefined, vStart: 0,
  };
}

/**
 * Shift a cluster subtree's absolute-rank-indexed state to follow the +1
 * renumber performed by `abomination` (AD-2).
 *
 * C needs no such pass: its abomination adds the label rank at index -1
 * (`GD_rank(g) = rptr + 1`, `GD_minrank(g)--`) and never touches ND_rank, so a
 * cluster's GD_minrank/GD_maxrank, GD_rank(clust)[] and GD_rankleader(clust)[]
 * — all indexed by ABSOLUTE rank — stay correct. JS has no negative index, so
 * the port renumbers +1 instead, and every absolute-rank-indexed structure has
 * to move with it. Skipping the clusters leaves them pointing one rank too low:
 * the next step of flat_edges (rec_reset_vlists → reset_vlist) re-aliases
 * GD_rank(clust)[r].v = GD_rank(root)[r].v at the cluster's stale r, which now
 * addresses the newly inserted flat-label rank instead of the cluster's own.
 *
 * @see lib/dotgen/flat.c:abomination
 * @see lib/dotgen/mincross.c:reset_vlist
 */
export function shiftClusterRanks(g: Graph): void {
  const nClust = g.info.n_cluster ?? 0;
  for (let c = 1; c <= nClust; c++) {
    const sub = g.info.clust![c - 1];
    const mn = graphMinrank(sub);
    const mx = graphMaxrank(sub);
    const rank = sub.info.rank;
    if (rank) {
      for (let r = mx; r >= mn; r--) rank[r + 1] = rank[r];
      rank[mn] = emptyRankEntry();
    }
    // GD_rankleader(clust)[r] is absolute-rank-indexed too (save_vlist writes
    // it at r = minrank..maxrank; map_interclust_node reads it at ND_rank(n)).
    const rl = sub.info.rankleader;
    if (rl) for (let r = mx; r >= mn; r--) rl[r + 1] = rl[r];
    sub.info.minrank = mn + 1;
    sub.info.maxrank = mx + 1;
    shiftClusterRanks(sub);
  }
}

/** Make room for a flat label vnode below the lowest rank (name from C; AD-2).
 * @see lib/dotgen/flat.c:abomination */
export function abomination(g: Graph): void {
  // C shifts its base pointer so rank[-1] is valid (minrank → -1). JS has no
  // negative indices, so AD-2 renumbers: insert an empty rank at index 0, shift
  // ranks up, bump every ND_rank and maxrank by 1, minrank stays 0. The vnode C
  // places at rank -1 then lands at rank 0. position.ts re-runs setYcoords after.
  // needsAbomination only fires on rank mn == 0 (C asserts GD_minrank == 0).
  const mx = graphMaxrank(g);
  const rank = g.info.rank!;
  for (let r = mx; r >= 0; r--) rank[r + 1] = rank[r];
  rank[0] = emptyRankEntry();
  for (let n: Node | undefined = g.info.nlist; n; n = n.info.next) {
    n.info.rank = (n.info.rank ?? 0) + 1;
  }
  g.info.maxrank = mx + 1;
  // The root's nlist holds every node (merge_ranks calls fast_node(root, v) on
  // each cluster member), so the ND_rank bump above already covers the clusters'
  // nodes. What it does NOT cover is the clusters' own rank-indexed bookkeeping.
  shiftClusterRanks(g);
  // Record the +1 renumber so make_LR_constraints can recover C's rank-index
  // parity: C inserts the label rank at -1 and keeps real nodes on even ranks;
  // this 0-based shift puts them on odd ranks, inverting `sep[i & 1]`.
  g.info.abomShift = (g.info.abomShift ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// checkFlatAdjacent  @see lib/dotgen/flat.c:checkFlatAdjacent
// ---------------------------------------------------------------------------

export function hasInterveningNode(rk: RankEntry, lo: number, hi: number): boolean {
  for (let i = 0; i < rk.n; i++) {
    const ord = getOrd(rk, i);
    if (ord <= lo || ord >= hi) continue;
    // C only treats a between-node as blocking flat-edge adjacency when it is a
    // NORMAL node or a LABELED virtual node; an UNLABELED virtual node (e.g. an
    // edge merely passing through the rank) does NOT block. The port previously
    // blocked on any node. @see lib/dotgen/flat.c:checkFlatAdjacent
    const n = rk.v[i];
    const t = n.info.node_type ?? NORMAL;
    if (t === NORMAL || (t === VIRTUAL && n.info.label !== undefined)) return true;
  }
  return false;
}

/**
 * Mark flat edge as adjacent if no nodes fall between its endpoints in rank.
 * When adjacent, C marks the edge AND every edge in its `to_virt` chain (the
 * `do { ED_adjacent(e)=1; e=ED_to_virt(e); } while(e)` loop): the class rep must
 * carry the flag too, because flat_edges' `other`-loop copies adjacency from the
 * rep (`ED_adjacent(e) = ED_adjacent(le)`). Marking only the leaf left the rep
 * unmarked, so that copy clobbered the flag back to 0 and the edge mis-routed
 * through the generic fitter (a spurious y-slope on a flat edge).
 * @see lib/dotgen/flat.c:checkFlatAdjacent
 */
export function checkFlatAdjacent(e: Edge): void {
  const tOrd = nodeOrder(e.tail);
  const hOrd = nodeOrder(e.head);
  const lo = Math.min(tOrd, hOrd);
  const hi = Math.max(tOrd, hOrd);
  let adjacent = hi - lo <= 1;
  if (!adjacent) {
    const rank = e.tail.root.info.rank;
    if (!rank) return;
    adjacent = !hasInterveningNode(rank[nodeRank(e.tail)], lo, hi);
  }
  if (!adjacent) return;
  for (let le: Edge | undefined = e; le; le = le.info.to_virt) le.info.adjacent = 1;
}


// ---------------------------------------------------------------------------
// flatEdges helpers  @see lib/dotgen/flat.c:flat_edges
// ---------------------------------------------------------------------------

export function isLabeledFlat(e: Edge): boolean {
  return e.info.label !== undefined;
}

export function markEdgeList(edges: EdgeList | undefined): void {
  if (!edges) return;
  for (let i = 0; i < edges.size; i++) checkFlatAdjacent(edges.list[i]);
}

export function markAdjacent(g: Graph): void {
  for (let n: Node | undefined = g.info.nlist; n; n = n.info.next) {
    markEdgeList(n.info.flat_out);
    // ND_other entries are marked only when actually flat: a cross-rank merged
    // 2-cycle member must NOT get adjacent=1 (the chain-walk would set it on
    // its rep too, and groupSize's flat-adjacent short-circuit would then
    // swallow portcmp group breaks). @see lib/dotgen/flat.c:272-276
    if (n.info.other) {
      for (let i = 0; i < n.info.other.size; i++) {
        const e = n.info.other.list[i];
        if (nodeRank(e.tail) === nodeRank(e.head)) checkFlatAdjacent(e);
      }
    }
  }
}

export function rankHasNonAdjacentLabel(rk: RankEntry): boolean {
  for (let i = 0; i < rk.n; i++) {
    const fo = rk.v[i].info.flat_out;
    if (!fo) continue;
    for (let j = 0; j < fo.size; j++) {
      if (isLabeledFlat(fo.list[j]) && !fo.list[j].info.adjacent) return true;
    }
  }
  return false;
}

/**
 * AD-1: C gates this on `GD_rank(g)[0].flat || GD_n_cluster(g) > 0` and then
 * scans for a labeled non-adjacent flat edge on rank mn. In this port the
 * `rank[mn].flat` adjacency matrix is unreliable at position-time (mincross
 * builds it before `flat_out` is populated), so we detect the rank-mn labeled
 * non-adjacent flat edge directly via `flat_out` — which is the real gate. This
 * only fires for a graph with such an edge on the lowest rank (none of the 115
 * goldens have one), so it is byte-safe. @see lib/dotgen/flat.c:flat_edges 279
 */
export function needsAbomination(g: Graph): boolean {
  const mn = graphMinrank(g);
  const rank = g.info.rank;
  if (!rank || rank[mn] === undefined) return false;
  return rankHasNonAdjacentLabel(rank[mn]);
}

/** Label width contribution (flip-aware), or 0 if no label dimen. */
function labelWidth(g: Graph, e: Edge): number {
  const lbl = e.info.label as (LabelWithDimen | undefined);
  if (!lbl || !lbl.dimen) return 0;
  return g.info.flip === true ? lbl.dimen.y : lbl.dimen.x;
}

/** Store the representative's flat-label width directly. @see flat.c:300 */
export function applyLabelDist(g: Graph, e: Edge): void {
  e.info.dist = labelWidth(g, e);
}

/** Resolve a flat edge to its class representative via the to_virt chain.
 *  @see lib/dotgen/flat.c:flat_edges (`while (ED_to_virt(le)) le = ED_to_virt(le)`) */
function flatClassRep(e: Edge): Edge {
  let le = e;
  while (le.info.to_virt) le = le.info.to_virt;
  return le;
}

/** flat_out loop body: store label dist on e (the rep), or add a label vnode.
 *  @see lib/dotgen/flat.c:flat_edges 296-307 */
export function processFlatOutLabel(g: Graph, e: Edge, reset: boolean): boolean {
  if (!isLabeledFlat(e)) return reset;
  if (e.info.adjacent) { applyLabelDist(g, e); return reset; }
  flatNode(e);
  return true;
}

/** other loop body: inherit adjacency from the class rep, and for an adjacent
 *  labeled edge MAX its label width onto the rep's dist (not the edge itself);
 *  non-adjacent labeled edges add a label vnode. Skips cross-rank and self
 *  edges. @see lib/dotgen/flat.c:flat_edges 309-326 */
export function processOtherLabel(g: Graph, e: Edge, reset: boolean): boolean {
  if (nodeRank(e.tail) !== nodeRank(e.head)) return reset;
  if (e.tail === e.head) return reset;
  const le = flatClassRep(e);
  e.info.adjacent = le.info.adjacent;
  if (!isLabeledFlat(e)) return reset;
  if (e.info.adjacent) {
    le.info.dist = Math.max(labelWidth(g, e), le.info.dist ?? 0);
    return reset;
  }
  flatNode(e);
  return true;
}

/**
 * The flat_edges dist/label-vnode pass. C nests BOTH the flat_out and other
 * loops inside `if (ND_flat_out(n).list)`, so a node with no flat_out processes
 * neither. @see lib/dotgen/flat.c:flat_edges 288-330
 */
export function processNodes(g: Graph): boolean {
  let reset = false;
  for (let n: Node | undefined = g.info.nlist; n; n = n.info.next) {
    const fo = n.info.flat_out;
    if (!fo) continue;
    for (let i = 0; i < fo.size; i++) reset = processFlatOutLabel(g, fo.list[i], reset);
    const ot = n.info.other;
    if (ot) for (let i = 0; i < ot.size; i++) reset = processOtherLabel(g, ot.list[i], reset);
  }
  return reset;
}

// ---------------------------------------------------------------------------
// flatEdges  @see lib/dotgen/flat.c:flat_edges
// ---------------------------------------------------------------------------

/**
 * Process flat edges for label placement and abomination.
 * Returns true if rank arrays were modified (label nodes inserted).
 * @see lib/dotgen/flat.c:flat_edges
 */
export function flatEdges(g: Graph): boolean {
  markAdjacent(g);
  if (needsAbomination(g)) abomination(g);
  recSaveVlists(g);
  const reset = processNodes(g);
  if (reset) {
    checkLabelOrder(g);
    // Cluster rank windows (rankleader/vStart/n) are stale once flat_node
    // inserted label vnodes and shifted ND_order; C re-derives them here.
    // Only Root is consulted by the reset chain, so a bare {root} suffices
    // in place of the mincross-pass context. @see lib/dotgen/flat.c:333
    recResetVlists({ root: dotRoot(g) }, g);
  }
  return reset;
}
