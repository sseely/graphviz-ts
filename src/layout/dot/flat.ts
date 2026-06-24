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
import { FLATORDER, virtualNode, virtualEdge } from './fastgr.js';
import { recSaveVlists } from './mincross.js';
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
// flat_limits helpers  @see lib/dotgen/flat.c:flat_limits
// ---------------------------------------------------------------------------

export function limitsLeft(rk: RankEntry, tOrd: number, hOrd: number): number {
  let left = 0;
  for (let i = 0; i < rk.n; i++) {
    const ord = getOrd(rk, i);
    if (ord < tOrd && ord < hOrd) left = i + 1;
  }
  return left;
}

export function limitsRight(rk: RankEntry, tOrd: number, hOrd: number): number {
  let right = rk.n;
  for (let i = rk.n - 1; i >= 0; i--) {
    const ord = getOrd(rk, i);
    if (ord > tOrd && ord > hOrd) right = i;
  }
  return right;
}

/**
 * Find best position for a flat-edge label virtual node in rank r-1.
 * @see lib/dotgen/flat.c:flat_limits
 */
export function flatLimits(g: Graph, e: Edge): number {
  const r = nodeRank(e.tail) - 1;
  if (r < 0 || !g.info.rank) return 0;
  const rk = g.info.rank[r];
  const tOrd = nodeOrder(e.tail);
  const hOrd = nodeOrder(e.head);
  return Math.floor((limitsLeft(rk, tOrd, hOrd) + limitsRight(rk, tOrd, hOrd)) / 2);
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
  rank[0] = {
    n: 0, v: [], an: 0, av: [],
    ht1: 1, ht2: 1, pht1: 1, pht2: 1,
    candidate: false, valid: false, cache_nc: 0, flat: undefined, vStart: 0,
  };
  for (let n: Node | undefined = g.info.nlist; n; n = n.info.next) {
    n.info.rank = (n.info.rank ?? 0) + 1;
  }
  g.info.maxrank = mx + 1;
}

// ---------------------------------------------------------------------------
// checkFlatAdjacent  @see lib/dotgen/flat.c:checkFlatAdjacent
// ---------------------------------------------------------------------------

export function hasInterveningNode(rk: RankEntry, lo: number, hi: number): boolean {
  for (let i = 0; i < rk.n; i++) {
    const ord = getOrd(rk, i);
    if (ord > lo && ord < hi) return true;
  }
  return false;
}

/**
 * Mark flat edge as adjacent if no nodes fall between its endpoints in rank.
 * @see lib/dotgen/flat.c:checkFlatAdjacent
 */
export function checkFlatAdjacent(e: Edge): void {
  const tOrd = nodeOrder(e.tail);
  const hOrd = nodeOrder(e.head);
  const lo = Math.min(tOrd, hOrd);
  const hi = Math.max(tOrd, hOrd);
  if (hi - lo <= 1) { e.info.adjacent = 1; return; }
  const rank = e.tail.root.info.rank;
  if (!rank) return;
  if (!hasInterveningNode(rank[nodeRank(e.tail)], lo, hi)) e.info.adjacent = 1;
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
    markEdgeList(n.info.other);
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

export function applyLabelDist(g: Graph, e: Edge): void {
  const lbl = e.info.label as (LabelWithDimen | undefined);
  if (!lbl || !lbl.dimen) return;
  if (g.info.flip === true) e.info.dist = lbl.dimen.y;
  else e.info.dist = lbl.dimen.x;
}

export function processLabelEdge(g: Graph, e: Edge, reset: boolean): boolean {
  if (!isLabeledFlat(e)) return reset;
  if (e.info.adjacent) { applyLabelDist(g, e); return reset; }
  flatNode(e);
  return true;
}

export function processEdgeList(g: Graph, edges: EdgeList | undefined, reset: boolean): boolean {
  if (!edges) return reset;
  for (let i = 0; i < edges.size; i++) reset = processLabelEdge(g, edges.list[i], reset);
  return reset;
}

export function processNodes(g: Graph): boolean {
  let reset = false;
  for (let n: Node | undefined = g.info.nlist; n; n = n.info.next) {
    reset = processEdgeList(g, n.info.flat_out, reset);
    reset = processEdgeList(g, n.info.other, reset);
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
  // C also calls rec_reset_vlists(g) here (flat.c:333); it is cluster-only
  // (GD_rankleader) and needs a MincrossContext not threaded to this position-
  // phase call, so it is deferred (DOT-5 AD-4). The reorder itself is wired.
  if (reset) checkLabelOrder(g);
  return reset;
}
