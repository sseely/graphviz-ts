// SPDX-License-Identifier: EPL-2.0

/**
 * Y-coordinate assignment, cluster height computation, and rank adjustment
 * for the dot position phase.
 * @see lib/dotgen/position.c:set_ycoords, clust_ht, adjustRanks, adjustSimple
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import { dotRoot } from './mincross-utils.js';
import {
  CL_OFFSET, BOTTOM_IX, RIGHT_IX, TOP_IX, LEFT_IX,
  clusterMarginOf,
  graphMinrank, graphMaxrank, graphNclust,
  graphHt1, graphHt2, graphRanksep, nodeRank,
} from './position-aux.js';

// ---------------------------------------------------------------------------
// Accessor helpers
// ---------------------------------------------------------------------------

/** @internal */
export function graphMarginY(g: Graph): number {
  return g.info.clusterMargin ?? clusterMarginOf(g);
}

// ---------------------------------------------------------------------------
// clustHt helpers — @see lib/dotgen/position.c:clust_ht
// ---------------------------------------------------------------------------

/** @internal — largest self-edge label half-height for a node */
export function selfEdgeLabelHt(n: Node): number {
  const other = n.info.other;
  if (!other) return 0;
  let maxHt = 0;
  for (let j = 0; j < other.size; j++) {
    const e = other.list[j];
    if (e.tail === e.head && e.info.label) {
      const lbl = e.info.label as { dimen?: { y: number } };
      maxHt = Math.max(maxHt, (lbl.dimen?.y ?? 0) / 2);
    }
  }
  return maxHt;
}

/** @see lib/dotgen/position.c:clust_ht (single node scan, returns ht2) */
export function clustHtScanNode(g: Graph, n: Node, r: number): number {
  const ht2 = Math.max((n.info.ht ?? 0) / 2, selfEdgeLabelHt(n));
  const rk = g.info.rank![r];
  if (rk.pht2 < ht2) { rk.pht2 = ht2; rk.ht2 = ht2; }
  if (rk.pht1 < ht2) { rk.pht1 = ht2; rk.ht1 = ht2; }
  return ht2;
}

/** @see lib/dotgen/position.c:clust_ht (update nearest enclosing cluster ht) */
export function updateClustNodeHt(g: Graph, n: Node, ht2: number): void {
  const clust = n.info.clust;
  if (!clust) return;
  const margin = clust === g ? 0 : graphMarginY(clust);
  const r = nodeRank(n);
  if (r === graphMinrank(clust)) clust.info.ht2 = Math.max(clust.info.ht2 ?? 0, ht2 + margin);
  if (r === graphMaxrank(clust)) clust.info.ht1 = Math.max(clust.info.ht1 ?? 0, ht2 + margin);
}

/** @see lib/dotgen/position.c:clust_ht (per-rank node scan) */
export function clustHtRankScan(g: Graph): void {
  const rankArr = g.info.rank!;
  for (let r = graphMinrank(g); r <= graphMaxrank(g); r++) {
    const rk = rankArr[r];
    for (let i = 0; i < rk.n; i++) {
      const n = rk.v[i];
      const ht2 = clustHtScanNode(g, n, r);
      updateClustNodeHt(g, n, ht2);
    }
  }
}

/** @see lib/dotgen/position.c:clust_ht (sub-cluster ht accumulation) */
export function clustHtSubclusters(
  g: Graph,
  margin: number,
  ht1In: number,
  ht2In: number,
): [number, number, boolean] {
  let ht1 = ht1In;
  let ht2 = ht2In;
  let haveLabel = false;
  const nClust = graphNclust(g);
  for (let c = 1; c <= nClust; c++) {
    const subg = g.info.clust![c - 1];
    haveLabel = clustHt(subg) || haveLabel;
    if (graphMaxrank(subg) === graphMaxrank(g)) ht1 = Math.max(ht1, graphHt1(subg) + margin);
    if (graphMinrank(subg) === graphMinrank(g)) ht2 = Math.max(ht2, graphHt2(subg) + margin);
  }
  return [ht1, ht2, haveLabel];
}

/** @see lib/dotgen/position.c:clust_ht (label height adjustment) */
export function clustHtLabel(g: Graph, ht1In: number, ht2In: number): [number, number, boolean] {
  const root = dotRoot(g);
  if (g === root || !g.info.label) return [ht1In, ht2In, false];
  if (root.info.flip) return [ht1In, ht2In, true];
  const ht1 = ht1In + (g.info.border?.[BOTTOM_IX].y ?? 0);
  const ht2 = ht2In + (g.info.border?.[TOP_IX].y ?? 0);
  return [ht1, ht2, true];
}

/** @see lib/dotgen/position.c:clust_ht */
export function clustHt(g: Graph): boolean {
  const root = dotRoot(g);
  const isRoot = g === root;
  const margin = isRoot ? CL_OFFSET : graphMarginY(g);
  let ht1 = graphHt1(g);
  let ht2 = graphHt2(g);
  let haveLabel: boolean;
  [ht1, ht2, haveLabel] = clustHtSubclusters(g, margin, ht1, ht2);
  let lblMark: boolean;
  [ht1, ht2, lblMark] = clustHtLabel(g, ht1, ht2);
  haveLabel = haveLabel || lblMark;
  g.info.ht1 = ht1;
  g.info.ht2 = ht2;
  if (!isRoot) {
    const rankArr = root.info.rank!;
    rankArr[graphMinrank(g)].ht2 = Math.max(rankArr[graphMinrank(g)].ht2, ht2);
    rankArr[graphMaxrank(g)].ht1 = Math.max(rankArr[graphMaxrank(g)].ht1, ht1);
  }
  return haveLabel;
}

// ---------------------------------------------------------------------------
// set_ycoords — @see lib/dotgen/position.c:set_ycoords
// ---------------------------------------------------------------------------

/** @internal — recompute maxht after adjustRanks (exact_ranksep path) */
export function recomputeMaxht(g: Graph): number {
  const rankArr = g.info.rank!;
  const maxR = graphMaxrank(g);
  let maxht = 0;
  let d0 = rankArr[maxR].v[0].info.coord.y;
  for (let r = maxR - 1; r >= graphMinrank(g); r--) {
    const d1 = rankArr[r].v[0].info.coord.y;
    maxht = Math.max(maxht, d1 - d0);
    d0 = d1;
  }
  return maxht;
}

/** @internal — re-assign y if ranks are equally spaced */
export function equalSpaceRanks(g: Graph, maxht: number): void {
  const rankArr = g.info.rank!;
  for (let r = graphMaxrank(g) - 1; r >= graphMinrank(g); r--) {
    if (rankArr[r].n > 0) {
      rankArr[r].v[0].info.coord.y = rankArr[r + 1].v[0].info.coord.y + maxht;
    }
  }
}

/** @see lib/dotgen/position.c:set_ycoords (initial y assignment loop) */
export function setYcoordsInitial(g: Graph, lbl: boolean): void {
  const rankArr = g.info.rank!;
  const maxR = graphMaxrank(g);
  // g.info.ht1 (GD_ht1 of root) may exceed rank[maxR].ht1 when a cluster at
  // maxRank expands the bottom margin beyond the bare node height.  Using the
  // graph-level ht1 matches C: clust_ht propagates the expanded value back up
  // so that LL.y = y(bottom) - GD_ht1(root) = 0.
  rankArr[maxR].v[0].info.coord.y = g.info.ht1 ?? rankArr[maxR].ht1;
  let maxht = 0;
  for (let r = maxR - 1; r >= graphMinrank(g); r--) {
    const d0 = rankArr[r + 1].pht2 + rankArr[r].pht1 + graphRanksep(g);
    const d1 = rankArr[r + 1].ht2 + rankArr[r].ht1 + CL_OFFSET;
    const delta = Math.max(d0, d1);
    if (rankArr[r].n > 0) {
      rankArr[r].v[0].info.coord.y = rankArr[r + 1].v[0].info.coord.y + delta;
    }
    maxht = Math.max(maxht, delta);
  }
  if (lbl && g.info.flip) {
    adjustRanks(g, 0);
    if (g.info.exact_ranksep) maxht = recomputeMaxht(g);
  }
  if (g.info.exact_ranksep) equalSpaceRanks(g, maxht);
}

/** @see lib/dotgen/position.c:set_ycoords (copy y from rank leader to all nodes) */
export function setYcoordsCopy(g: Graph): void {
  const rankArr = g.info.rank!;
  for (let n = g.info.nlist; n !== undefined; n = n.info.next) {
    n.info.coord.y = rankArr[nodeRank(n)].v[0].info.coord.y;
  }
}

/** @see lib/dotgen/position.c:set_ycoords */
export function setYcoords(g: Graph): void {
  clustHtRankScan(g);
  const lbl = clustHt(g);
  setYcoordsInitial(g, lbl);
  setYcoordsCopy(g);
}

// ---------------------------------------------------------------------------
// adjustSimple / adjustRanks — @see lib/dotgen/position.c
// ---------------------------------------------------------------------------

/** @internal — shift ranks above minr by deltop */
export function shiftRanksAbove(root: Graph, minr: number, deltop: number): void {
  const rankArr = root.info.rank!;
  for (let r = minr - 1; r >= graphMinrank(root); r--) {
    if (rankArr[r].n > 0) rankArr[r].v[0].info.coord.y += deltop;
  }
}

/** @see lib/dotgen/position.c:adjustSimple */
export function adjustSimple(g: Graph, delta: number, marginTotal: number): void {
  const root = dotRoot(g);
  const rankArr = root.info.rank!;
  const maxr = graphMaxrank(g);
  const minr = graphMinrank(g);
  const bottom = (delta + 1) / 2;
  const delbottom = graphHt1(g) + bottom - (rankArr[maxr].ht1 - marginTotal);
  if (delbottom > 0) {
    for (let r = maxr; r >= minr; r--) {
      if (rankArr[r].n > 0) rankArr[r].v[0].info.coord.y += delbottom;
    }
    const deltop = graphHt2(g) + (delta - bottom) + delbottom - (rankArr[minr].ht2 - marginTotal);
    if (deltop > 0) shiftRanksAbove(root, minr, deltop);
  } else {
    const deltop = graphHt2(g) + (delta - bottom) - (rankArr[minr].ht2 - marginTotal);
    if (deltop > 0) shiftRanksAbove(root, minr, deltop);
  }
  g.info.ht2 = graphHt2(g) + delta - bottom;
  g.info.ht1 = graphHt1(g) + bottom;
}

/** @see lib/dotgen/position.c:adjustRanks (label height delta application) */
export function adjustRanksLabel(g: Graph, root: Graph, marginTotal: number): void {
  // C's adjustRanks does NOT gate on flip here — it reads GD_border[LEFT/RIGHT]
  // unconditionally (the outer `lbl && GD_flip` guard in set_ycoords already
  // ensures a flipped drawing). The border is set to LEFT/RIGHT by
  // applyLabelBorder using the ROOT's flip; a cluster subgraph's own info.flip
  // is not propagated (undefined), so gating on it here skipped the cluster
  // label rank-reservation entirely — 2239's cluster_dtlsdec1 (a PEM-cert label,
  // border[R].y=4507) reserved 0 room instead of ~2210, halving the LR width.
  // A non-flip cluster has border[LEFT/RIGHT]=0, so `if (!lht) return` covers it.
  // @see lib/dotgen/position.c:adjustRanks (label branch)
  const lht = Math.max(g.info.border?.[LEFT_IX].y ?? 0, g.info.border?.[RIGHT_IX].y ?? 0);
  if (!lht) return;
  const rankArr = root.info.rank!;
  const rht = rankArr[graphMinrank(g)].v[0].info.coord.y - rankArr[graphMaxrank(g)].v[0].info.coord.y;
  const delta = lht - (rht + graphHt1(g) + graphHt2(g));
  if (delta > 0) adjustSimple(g, delta, marginTotal);
}

/** @see lib/dotgen/position.c:adjustRanks */
export function adjustRanks(g: Graph, marginTotal: number): void {
  const root = dotRoot(g);
  const isRoot = g === root;
  const margin = isRoot ? 0 : graphMarginY(g);
  let ht1 = graphHt1(g);
  let ht2 = graphHt2(g);
  const nClust = graphNclust(g);
  for (let c = 1; c <= nClust; c++) {
    const subg = g.info.clust![c - 1];
    adjustRanks(subg, margin + marginTotal);
    if (graphMaxrank(subg) === graphMaxrank(g)) ht1 = Math.max(ht1, graphHt1(subg) + margin);
    if (graphMinrank(subg) === graphMinrank(g)) ht2 = Math.max(ht2, graphHt2(subg) + margin);
  }
  g.info.ht1 = ht1;
  g.info.ht2 = ht2;
  if (!isRoot && g.info.label) adjustRanksLabel(g, root, marginTotal);
  if (!isRoot) {
    const rankArr = root.info.rank!;
    rankArr[graphMinrank(g)].ht2 = Math.max(rankArr[graphMinrank(g)].ht2, ht2);
    rankArr[graphMaxrank(g)].ht1 = Math.max(rankArr[graphMaxrank(g)].ht1, ht1);
  }
}
