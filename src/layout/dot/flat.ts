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
import {
  nodeOrder, nodeRank, graphNodesep, graphMaxrank, graphMinrank, graphNCluster, getOrd,
} from './flat-utils.js';

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

export function applyDimensions(g: Graph, vn: Node, dimen: { x: number; y: number }): void {
  if (g.info.flip === true) {
    vn.info.ht = dimen.x;
    vn.info.rw = dimen.y;
  } else {
    vn.info.ht = dimen.y;
    vn.info.rw = dimen.x;
  }
}

export function flatNodeSetDims(g: Graph, vn: Node, e: Edge): void {
  vn.info.lw = graphNodesep(g);
  const lbl = e.info.label as (LabelWithDimen | undefined);
  if (!lbl || !lbl.dimen) return;
  applyDimensions(g, vn, lbl.dimen);
}

/**
 * Create a virtual label node for a non-adjacent labeled flat edge.
 * @see lib/dotgen/flat.c:flat_node
 */
export function flatNode(e: Edge): void {
  const g = e.tail.root;
  const pos = flatLimits(g, e);
  const vn = makeVnSlot(g, nodeRank(e.tail) - 1, pos);
  vn.info.label = e.info.label;
  flatNodeSetDims(g, vn, e);
  const et = virtualEdge(vn, e.tail, e);
  et.info.edge_type = FLATORDER;
  const eh = virtualEdge(vn, e.head, e);
  eh.info.edge_type = FLATORDER;
}

// ---------------------------------------------------------------------------
// abomination  @see lib/dotgen/flat.c:abomination
// ---------------------------------------------------------------------------

/**
 * When labeled non-adjacent flat edges exist at rank 0, shift the entire
 * rank array forward by one to create a new rank at index -1.
 *
 * The name `abomination` is from the C source and must appear in the
 * TypeScript port.
 *
 * @see lib/dotgen/flat.c:abomination
 */
export function abomination(g: Graph): void {
  const mx = graphMaxrank(g);
  const rank = g.info.rank!;
  for (let r = mx; r >= 0; r--) rank[r + 1] = rank[r];
  (g.info.minrank as number)--;
  const newMin = g.info.minrank!;
  rank[newMin] = {
    n: 0, an: 0, v: [], av: [],
    ht1: 1, ht2: 1, pht1: 1, pht2: 1,
    candidate: false, valid: false, cache_nc: 0,
  };
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
// checkLabelOrder stub  @see lib/dotgen/mincross.c:checkLabelOrder
// ---------------------------------------------------------------------------

/**
 * Stub — full implementation requires auxiliary graph construction.
 * @see lib/dotgen/mincross.c:checkLabelOrder
 */
export function checkLabelOrder(_g: Graph): void {
  // TODO T39: port lib/dotgen/mincross.c:checkLabelOrder
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

export function needsAbomination(g: Graph): boolean {
  const mn = graphMinrank(g);
  const rank = g.info.rank;
  if (!rank) return false;
  const hasFlat = (rank[mn] !== undefined && rank[mn].flat !== undefined) || graphNCluster(g) > 0;
  if (!hasFlat) return false;
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
  // TODO T39: when dotPosition passes a real ctx, call recResetVlists(ctx, g)
  if (reset) checkLabelOrder(g);
  return reset;
}
