// SPDX-License-Identifier: EPL-2.0

/**
 * Cluster containment and separation constraints for the dot position phase.
 * @see lib/dotgen/position.c:contain_nodes, contain_clustnodes,
 *      keepout_othernodes, contain_subclust, separate_subclust, pos_clusters
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import { VIRTUAL, NORMAL, virtualNode, findFastEdge } from './fastgr.js';
import { agContainsNode } from './mincross-utils.js';
import { dotRoot, rankGet } from './mincross-utils.js';
import { SLACKNODE } from './rank.js';
import {
  BOTTOM_IX, RIGHT_IX, TOP_IX, LEFT_IX,
  makeAuxEdge, clusterMarginOf,
  nodeRw, nodeLw, nodeOrder,
} from './position-aux.js';

// ---------------------------------------------------------------------------
// Accessor helpers
// ---------------------------------------------------------------------------

/** @internal */
export function graphMargin(g: Graph): number {
  return g.info.clusterMargin ?? clusterMarginOf(g);
}

/** @internal */
export function graphMinrank(g: Graph): number { return g.info.minrank ?? 0; }

/** @internal */
export function graphMaxrank(g: Graph): number { return g.info.maxrank ?? 0; }

/** @internal */
export function borderLeft(g: Graph): number {
  return g.info.border?.[LEFT_IX].x ?? 0;
}

/** @internal */
export function borderRight(g: Graph): number {
  return g.info.border?.[RIGHT_IX].x ?? 0;
}

/** @internal */
export function borderBottom(g: Graph): number {
  return g.info.border?.[BOTTOM_IX].x ?? 0;
}

/** @internal */
export function borderTop(g: Graph): number {
  return g.info.border?.[TOP_IX].x ?? 0;
}

// ---------------------------------------------------------------------------
// make_lrvn — @see lib/dotgen/position.c:make_lrvn
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:make_lrvn */
export function makeLrvn(g: Graph): void {
  if (g.info.ln) return;
  const root = dotRoot(g);
  const ln = virtualNode(root);
  ln.info.node_type = SLACKNODE;
  const rn = virtualNode(root);
  rn.info.node_type = SLACKNODE;
  if (g.info.label && g !== root && !(root.info.flip)) {
    const w = Math.max(borderBottom(g), borderTop(g));
    makeAuxEdge(ln, rn, w, 0);
  }
  g.info.ln = ln;
  g.info.rn = rn;
}

// ---------------------------------------------------------------------------
// contain_nodes — @see lib/dotgen/position.c:contain_nodes
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:contain_nodes (per-rank) */
export function containNodesRank(g: Graph, r: number, ln: Node, rn: Node): void {
  const rk = g.info.rank![r];
  if (rk.n === 0) return;
  // C's GD_rank(clust)[i].v is the offset window pointer (merge_ranks aliases
  // it to GD_rank(root)[i].v + ipos), so v[0]/v[n-1] are cluster-local. TS keeps
  // .v as the full root array plus a separate vStart, so cluster members must be
  // read via rankGet (= rk.v[vStart+i]); a raw rk.v[0] reads the root's leftmost
  // node, not the cluster's. Same vStart-window bug class as mincross Layers 1-2.
  const first = rankGet(rk, 0);
  if (!first) return;
  const margin = graphMargin(g);
  makeAuxEdge(ln, first, nodeLw(first) + margin + borderLeft(g), 0);
  const last = rankGet(rk, rk.n - 1);
  makeAuxEdge(last, rn, nodeRw(last) + margin + borderRight(g), 0);
}

/** @see lib/dotgen/position.c:contain_nodes */
export function containNodes(g: Graph): void {
  makeLrvn(g);
  const ln = g.info.ln!;
  const rn = g.info.rn!;
  for (let r = graphMinrank(g); r <= graphMaxrank(g); r++) {
    containNodesRank(g, r, ln, rn);
  }
}

// ---------------------------------------------------------------------------
// contain_clustnodes — @see lib/dotgen/position.c:contain_clustnodes
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:contain_clustnodes */
export function containClustnodes(g: Graph): void {
  if (g !== dotRoot(g)) {
    containNodes(g);
    const ln = g.info.ln!;
    const rn = g.info.rn!;
    const ex = findFastEdge(ln, rn);
    if (ex !== undefined) {
      ex.info.weight = (ex.info.weight ?? 0) + 128;
    } else {
      makeAuxEdge(ln, rn, 1, 128);
    }
  }
  const nClust = g.info.n_cluster ?? 0;
  for (let c = 1; c <= nClust; c++) containClustnodes(g.info.clust![c - 1]);
}

// ---------------------------------------------------------------------------
// vnode_not_related_to — @see lib/dotgen/position.c:vnode_not_related_to
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:vnode_not_related_to */
export function vnodeNotRelatedTo(g: Graph, v: Node): boolean {
  if (v.info.node_type !== VIRTUAL) return false;
  let e = v.info.save_out?.list[0];
  while (e?.info.to_orig) e = e.info.to_orig;
  if (!e) return false;
  if (agContainsNode(g, e.tail)) return false;
  if (agContainsNode(g, e.head)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// keepout_othernodes — @see lib/dotgen/position.c:keepout_othernodes
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:keepout_othernodes (left-side scan for one rank) */
export function keepoutLeft(root: Graph, g: Graph, r: number, margin: number): void {
  // v = GD_rank(g)[r].v[0] is the cluster's leftmost node. g.info.rank[r].v is
  // the shared root array offset by vStart, so read v0 via rankGet — a raw .v[0]
  // returns the root's leftmost node (order≈0), collapsing the order-1..0 scan to
  // nothing and dropping every left-keepout edge (same vStart-window class as
  // containNodesRank). @see lib/dotgen/position.c:keepout_othernodes
  const v0 = rankGet(g.info.rank![r], 0);
  if (!v0) return;
  for (let i = nodeOrder(v0) - 1; i >= 0; i--) {
    const u = root.info.rank![r].v[i];
    if (u.info.node_type === NORMAL || vnodeNotRelatedTo(g, u)) {
      makeAuxEdge(u, g.info.ln!, margin + nodeRw(u), 0);
      break;
    }
  }
}

/** @see lib/dotgen/position.c:keepout_othernodes (right-side scan for one rank) */
export function keepoutRight(root: Graph, g: Graph, r: number, margin: number): void {
  const rk = g.info.rank![r];
  if (rk.n === 0) return;
  // Cluster-local leftmost via rankGet, not raw rk.v[0] (the root's leftmost) —
  // see keepoutLeft. @see lib/dotgen/position.c:keepout_othernodes
  const v0 = rankGet(rk, 0);
  if (!v0) return;
  const rootRk = root.info.rank![r];
  for (let i = nodeOrder(v0) + rk.n; i < rootRk.n; i++) {
    const u = rootRk.v[i];
    if (u.info.node_type === NORMAL || vnodeNotRelatedTo(g, u)) {
      makeAuxEdge(g.info.rn!, u, margin + nodeLw(u), 0);
      break;
    }
  }
}

/** @see lib/dotgen/position.c:keepout_othernodes */
export function keepoutOthernodes(g: Graph): void {
  const root = dotRoot(g);
  const margin = graphMargin(g);
  for (let r = graphMinrank(g); r <= graphMaxrank(g); r++) {
    if ((g.info.rank![r].n ?? 0) === 0) continue;
    keepoutLeft(root, g, r, margin);
    keepoutRight(root, g, r, margin);
  }
  const nClust = g.info.n_cluster ?? 0;
  for (let c = 1; c <= nClust; c++) keepoutOthernodes(g.info.clust![c - 1]);
}

// ---------------------------------------------------------------------------
// contain_subclust — @see lib/dotgen/position.c:contain_subclust
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:contain_subclust */
export function containSubclust(g: Graph): void {
  const margin = graphMargin(g);
  makeLrvn(g);
  const nClust = g.info.n_cluster ?? 0;
  for (let c = 1; c <= nClust; c++) {
    const subg = g.info.clust![c - 1];
    makeLrvn(subg);
    makeAuxEdge(g.info.ln!, subg.info.ln!, margin + borderLeft(g), 0);
    makeAuxEdge(subg.info.rn!, g.info.rn!, margin + borderRight(g), 0);
    containSubclust(subg);
  }
}

// ---------------------------------------------------------------------------
// separate_subclust — @see lib/dotgen/position.c:separate_subclust
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:separate_subclust (check overlap and assign left/right) */
export function separateClustPair(low: Graph, high: Graph, margin: number): void {
  if (graphMaxrank(low) < graphMinrank(high)) return;
  const pivotRank = graphMinrank(high);
  // C reads GD_rank(low/high)[minrank(high)].v[0] — each cluster's OWN rank
  // array, i.e. its leftmost node. The port shares the root rank array with a
  // vStart window, so a raw .v[0] returns the root's leftmost node (order 0) for
  // BOTH clusters → orders compare equal → left/right is assigned arbitrarily.
  // That happens to match the layout for rankdir=TB but contradicts it under
  // flip (LR/RL), so the separation edge points the wrong way and the clusters
  // collapse together. Read the cluster-local leftmost via rankGet (same
  // vStart-window class as containNodesRank/keepoutLeft).
  const lowV0 = rankGet(low.info.rank![pivotRank], 0);
  const highV0 = rankGet(high.info.rank![pivotRank], 0);
  if (!lowV0 || !highV0) return;
  const left = nodeOrder(lowV0) < nodeOrder(highV0) ? low : high;
  const right = left === low ? high : low;
  // C: make_aux_edge(GD_rn(left), GD_ln(right), margin, 0) — left's RIGHT border
  // sits `margin` to the left of right's LEFT border. The port had these args
  // swapped (right.rn, left.ln); with the old raw-.v[0] bug left/right were
  // arbitrary, so the two errors cancelled for rankdir=TB but compounded under
  // flip. @see lib/dotgen/position.c:480
  makeAuxEdge(left.info.rn!, right.info.ln!, margin, 0);
}

/** @see lib/dotgen/position.c:separate_subclust */
export function separateSubclust(g: Graph): void {
  const nClust = g.info.n_cluster ?? 0;
  const margin = graphMargin(g);
  for (let i = 1; i <= nClust; i++) makeLrvn(g.info.clust![i - 1]);
  for (let i = 1; i <= nClust; i++) {
    for (let j = i + 1; j <= nClust; j++) {
      let low = g.info.clust![i - 1];
      let high = g.info.clust![j - 1];
      if (graphMinrank(low) > graphMinrank(high)) {
        const tmp = low; low = high; high = tmp;
      }
      separateClustPair(low, high, margin);
    }
    separateSubclust(g.info.clust![i - 1]);
  }
}

// ---------------------------------------------------------------------------
// pos_clusters — @see lib/dotgen/position.c:pos_clusters
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:pos_clusters */
export function posClusters(g: Graph): void {
  if ((g.info.n_cluster ?? 0) === 0) return;
  containClustnodes(g);
  keepoutOthernodes(g);
  containSubclust(g);
  separateSubclust(g);
}

// ---------------------------------------------------------------------------
// compress_graph — @see lib/dotgen/position.c:compress_graph
// ---------------------------------------------------------------------------

/** @see lib/dotgen/position.c:compress_graph */
export function compressGraph(g: Graph): void {
  if (g.info.drawing?.ratioKind !== 'compress') return;
  const p = g.info.drawing.size;
  if (!p || p.x * p.y <= 1) return;
  containNodes(g);
  const x = Math.min(g.info.flip ? p.y : p.x, 65535);
  makeAuxEdge(g.info.ln!, g.info.rn!, x, 1000);
}
