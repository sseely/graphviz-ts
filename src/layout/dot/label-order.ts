// SPDX-License-Identifier: EPL-2.0

/**
 * checkLabelOrder / fixLabelOrder — correct the rank order of flat-edge label
 * virtual nodes when it conflicts with their endpoint intervals, which would
 * otherwise make dot_position's "label between its vertices" constraint
 * infeasible. Ported from lib/dotgen/mincross.c:178-326.
 *
 * The per-rank auxiliary graph (C's Agstrictdirected `lg`/`sg`) is modelled as
 * a small array of LabelNode with in/out adjacency (AD-2) — it is tiny and
 * rebuilt per rank.
 *
 * @see lib/dotgen/mincross.c:fixLabelOrder, checkLabelOrder
 */

import type { Node } from '../../model/node.js';
import type { Graph } from '../../model/graph.js';
import type { RankEntry } from '../../model/rankEntry.js';

/** Auxiliary node, one per flat-edge label vnode on a rank (mirrors info_t). */
export interface LabelNode {
  /** Lower endpoint order. @see ND_lo */
  lo: number;
  /** Upper endpoint order. @see ND_hi */
  hi: number;
  /** The dot label virtual node. @see ND_np */
  np: Node;
  /** Original rank order of np. @see ND_idx = ND_order(ND_np) */
  idx: number;
  /** DFS visited flag. @see ND_x */
  x: number;
  out: LabelNode[];
  in: LabelNode[];
}

/** Strict directed edge add (dedup, like Agstrictdirected). */
function addEdge(from: LabelNode, to: LabelNode): void {
  if (!from.out.includes(to)) {
    from.out.push(to);
    to.in.push(from);
  }
}

/**
 * DFS the connected component containing `n` (over in+out edges), marking x=1,
 * appending np-indices into `indices`, and returning the backedge count.
 * @see lib/dotgen/mincross.c:getComp
 */
function getComp(n: LabelNode, comp: LabelNode[], indices: number[]): number {
  let backedge = 0;
  n.x = 1;
  indices.push(n.idx);
  comp.push(n);
  for (const h of n.out) {
    if (h.idx > n.idx) backedge++; // isBackedge: idx(head) > idx(tail)
    if (!h.x) backedge += getComp(h, comp, indices);
  }
  for (const t of n.in) {
    if (n.idx > t.idx) backedge++; // edge t->n is a backedge when idx(n) > idx(t)
    if (!t.x) backedge += getComp(t, comp, indices);
  }
  return backedge;
}

/**
 * Topologically order a component: repeatedly take a source (in-degree 0
 * within the component), emit its np, and drop its out-edges.
 * @see lib/dotgen/mincross.c:topsort + findSource
 */
function topsort(comp: LabelNode[]): Node[] {
  const remaining = new Set(comp);
  const indeg = new Map<LabelNode, number>();
  for (const n of comp) indeg.set(n, n.in.filter((t) => remaining.has(t)).length);
  const arr: Node[] = [];
  while (remaining.size > 0) {
    let src: LabelNode | undefined;
    for (const n of comp) {
      if (remaining.has(n) && indeg.get(n) === 0) { src = n; break; }
    }
    if (src === undefined) break; // not a DAG — leave the rest (defensive)
    arr.push(src.np);
    remaining.delete(src);
    for (const h of src.out) if (remaining.has(h)) indeg.set(h, indeg.get(h)! - 1);
  }
  return arr;
}

/** Build the interval-conflict edges; returns true if any backedge exists. */
function linkConflicts(nodes: LabelNode[]): boolean {
  let haveBackedge = false;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    for (let j = i + 1; j < nodes.length; j++) {
      const v = nodes[j]!;
      if (v.hi <= n.lo) { haveBackedge = true; addEdge(v, n); }
      else if (n.hi <= v.lo) addEdge(n, v);
    }
  }
  return haveBackedge;
}

/**
 * Reorder a rank's flat-label vnodes so their order is consistent with their
 * endpoint intervals. Builds conflict edges, and for each connected component
 * containing a backedge, reassigns np.order / rank.v[] to the topological order
 * over the component's original positions.
 * @see lib/dotgen/mincross.c:fixLabelOrder
 */
export function fixLabelOrder(nodes: LabelNode[], rank: RankEntry): void {
  if (!linkConflicts(nodes)) return;
  for (const n of nodes) {
    if (n.x !== 0 || n.out.length + n.in.length === 0) continue;
    const comp: LabelNode[] = [];
    const indices: number[] = [];
    const backedge = getComp(n, comp, indices);
    if (backedge === 0) continue;
    const arr = topsort(comp);
    indices.sort((a, b) => a - b); // ordercmpf: ascending
    for (let i = 0; i < arr.length; i++) {
      arr[i]!.info.order = indices[i]!;
      rank.v[indices[i]!] = arr[i]!;
    }
  }
}

/** Make a LabelNode from a label vnode: lo/hi from its two out-edge heads. */
function labelNode(u: Node): LabelNode {
  const list = u.info.out!.list;
  let lo = list[0]!.head.info.order ?? 0;
  let hi = list[1]!.head.info.order ?? 0;
  if (lo > hi) { const t = lo; lo = hi; hi = t; }
  return { lo, hi, np: u, idx: u.info.order ?? 0, x: 0, out: [], in: [] };
}

/** Collect the flat-edge label vnodes (info.posAlg set) on one rank. */
function rankLabelNodes(rk: RankEntry): LabelNode[] {
  const nodes: LabelNode[] = [];
  for (let j = 0; j < rk.n; j++) {
    const u = rk.v[j]!;
    if (u.info.posAlg !== undefined) nodes.push(labelNode(u));
  }
  return nodes;
}

/**
 * For each rank, collect flat-edge label vnodes and, when a rank has more than
 * one, run fixLabelOrder to repair an infeasible order.
 * @see lib/dotgen/mincross.c:checkLabelOrder
 */
export function checkLabelOrder(g: Graph): void {
  const rank = g.info.rank;
  if (rank === undefined) return;
  const minr = g.info.minrank ?? 0;
  const maxr = g.info.maxrank ?? rank.length - 1;
  for (let r = minr; r <= maxr; r++) {
    const rk = rank[r];
    if (rk === undefined) continue;
    const nodes = rankLabelNodes(rk);
    if (nodes.length > 1) fixLabelOrder(nodes, rk);
  }
}
