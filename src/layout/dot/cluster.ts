// SPDX-License-Identifier: EPL-2.0

/**
 * Cluster expansion, rank merging, cluster marking, and skeleton building
 * for the dot layout engine.
 *
 * @see lib/dotgen/cluster.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import {
  VIRTUAL,
  virtualNode, fastNode, deleteFastNode,
  newVirtualEdge, fastEdge, deleteFastEdge,
  findFlatEdge, flatEdge, mergeOneway,
} from './fastgr.js';
import { dotRoot, agContainsEdge } from './mincross-utils.js';
import type { MincrossContext } from './mincross-utils.js';
import { ufSingleton, ufSetname } from './decomp.js';
import {
  class2, allocateRanks, buildRanks,
  installInRank, enqueueNeighbors,
} from './mincross-build.js';
import { CLUSTER } from './rank.js';
import { makeSlots, safeOtherEdge, makeInterclustChain } from './cluster-path.js';

export { CLUSTER_EDGE } from './cluster-path.js';
export { mapInterclustNode } from './cluster-path.js';

// ---------------------------------------------------------------------------
// interclexp helpers — @see lib/dotgen/cluster.c:interclexp
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:mergeable */
export function interclexpMergeable(prev: Edge | undefined, e: Edge): boolean {
  if (!prev) return false;
  return prev.tail === e.tail && prev.info.minlen === e.info.minlen
    && prev.info.weight === e.info.weight;
}

/** Rank equality helper — extracts ?? so callers stay below CCN 10. */
export function interclexpRanksEq(e: Edge): boolean {
  return (e.tail.info.rank ?? 0) === (e.head.info.rank ?? 0);
}

/** Head-rank-higher helper — extracts ?? so callers stay below CCN 10. */
export function interclexpHeadHigher(e: Edge): boolean {
  return (e.head.info.rank ?? 0) > (e.tail.info.rank ?? 0);
}

/** @see lib/dotgen/cluster.c:interclexp (flat edge case) */
export function interclexpFlat(g: Graph, e: Edge, prev: Edge | undefined): Edge | undefined {
  const fe = findFlatEdge(e.tail, e.head);
  if (fe === undefined) {
    if (!e.info.to_virt) flatEdge(g, e);
    return e;
  }
  if (e !== fe) {
    safeOtherEdge(e);
    if (!e.info.to_virt) mergeOneway(e, fe);
  }
  return prev;
}

/** @see lib/dotgen/cluster.c:interclexp (mergeable multi-edge case) */
export function interclexpMergeCase(subg: Graph, e: Edge, prev: Edge): Edge | undefined {
  if (interclexpRanksEq(e)) e.info.to_virt = prev;
  else e.info.to_virt = undefined;
  if (prev.info.to_virt === undefined) return prev;
  e.info.to_virt = undefined;
  mergeChain(subg, e, prev.info.to_virt!, false);
  safeOtherEdge(e);
  return prev;
}

/** @see lib/dotgen/cluster.c:interclexp (single edge processing) */
export function interclexpOneEdge(subg: Graph, g: Graph, e: Edge, prev: Edge | undefined): Edge | undefined {
  if (interclexpMergeable(prev, e)) return interclexpMergeCase(subg, e, prev!);
  if (interclexpRanksEq(e)) return interclexpFlat(g, e, prev);
  if (interclexpHeadHigher(e)) { makeInterclustChain(e.tail, e.head, e); return e; }
  makeInterclustChain(e.head, e.tail, e);
  return e;
}

/** @see lib/dotgen/cluster.c:interclexp */
export function interclexp(subg: Graph): void {
  const g = dotRoot(subg);
  for (const n of subg.nodes.values()) {
    let prev: Edge | undefined;
    for (const e of g.edges) {
      if (e.tail !== n && e.head !== n) continue;
      if (agContainsEdge(subg, e)) continue;
      prev = interclexpOneEdge(subg, g, e, prev);
    }
  }
}

// ---------------------------------------------------------------------------
// mergeChain stub (class2-related; T36)
// ---------------------------------------------------------------------------

/** @see lib/dotgen/class2.c:merge_chain — stubbed until T36 */
export function mergeChain(_subg: Graph, _e: Edge, _ve: Edge, _flatFlag: boolean): void {
  /* TODO T36: port lib/dotgen/class2.c:merge_chain */
}

// ---------------------------------------------------------------------------
// merge_ranks — @see lib/dotgen/cluster.c:merge_ranks
// ---------------------------------------------------------------------------

/** Return [minrank, maxrank] defaults-to-0, factoring out ?? for callers. */
export function subgraphBounds(g: Graph): [number, number] {
  return [g.info.minrank ?? 0, g.info.maxrank ?? 0];
}

/** @see lib/dotgen/cluster.c:merge_ranks (slot setup for one rank) */
export function mergeRanksSetup(subg: Graph, root: Graph, r: number, pos: number): number {
  const d = subg.info.rank![r].n;
  makeSlots(root, r, pos, d);
  return pos;
}

/** @see lib/dotgen/cluster.c:merge_ranks (node move for one rank) */
export function mergeRanksInstall(subg: Graph, root: Graph, r: number, ipos: number): void {
  let p = ipos;
  for (let i = 0; i < subg.info.rank![r].n; i++) {
    const v = root.info.rank![r].v[p] = subg.info.rank![r].v[i];
    v.info.order = p++;
    /* v.root = root skipped — Node.root is readonly in TS */
    deleteFastNode(subg, v);
    fastNode(root, v);
  }
  subg.info.rank![r].v = root.info.rank![r].v.slice(ipos);
  root.info.rank![r].valid = false;
}

/** @see lib/dotgen/cluster.c:merge_ranks (per-rank body) */
export function mergeRanksOne(subg: Graph, root: Graph, r: number): void {
  const rl = subg.info.rankleader![r];
  const ipos = mergeRanksSetup(subg, root, r, rl.info.order ?? 0);
  mergeRanksInstall(subg, root, r, ipos);
}

/** @see lib/dotgen/cluster.c:merge_ranks */
export function mergeRanks(subg: Graph): void {
  const root = dotRoot(subg);
  const [mn, mx] = subgraphBounds(subg);
  if (mn > 0) root.info.rank![mn - 1].valid = false;
  for (let r = mn; r <= mx; r++) mergeRanksOne(subg, root, r);
  if (mx + 1 < (root.info.maxrank ?? 0)) root.info.rank![mx + 1].valid = false;
  subg.info.expanded = true;
}

// ---------------------------------------------------------------------------
// remove_rankleaders — @see lib/dotgen/cluster.c:remove_rankleaders
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:remove_rankleaders */
export function removeRankleaders(g: Graph): void {
  const root = dotRoot(g);
  const [mn, mx] = subgraphBounds(g);
  for (let r = mn; r <= mx; r++) {
    const v = g.info.rankleader![r];
    let e: Edge | undefined;
    while ((e = v.info.out?.list[0]) !== undefined) deleteFastEdge(e);
    while ((e = v.info.in?.list[0]) !== undefined) deleteFastEdge(e);
    deleteFastNode(root, v);
    g.info.rankleader![r] = null as unknown as Node;
  }
}

// ---------------------------------------------------------------------------
// expand_cluster — @see lib/dotgen/cluster.c:expand_cluster
// ---------------------------------------------------------------------------

/** Minimal MincrossContext for cluster expansion (no crossing minimization). */
export function makeClusterCtx(root: Graph, mn: number, mx: number): MincrossContext {
  return {
    root,
    globalMinRank: mn,
    globalMaxRank: mx,
    teList: [],
    tiList: [],
    reMincross: false,
    minQuit: 1,
    maxIter: 0,
  };
}

/** @see lib/dotgen/cluster.c:expand_cluster */
export function expandCluster(subg: Graph): number {
  class2(subg);
  if (!subg.info.comp) subg.info.comp = [];
  subg.info.comp[0] = subg.info.nlist ?? null as unknown as Node;
  allocateRanks(subg);
  const [mn, mx] = subgraphBounds(subg);
  const ctx = makeClusterCtx(dotRoot(subg), mn, mx);
  const rc = buildRanks(ctx, subg, 0);
  if (rc !== 0) return rc;
  mergeRanks(subg);
  interclexp(subg);
  removeRankleaders(subg);
  return 0;
}

// ---------------------------------------------------------------------------
// mark_clusters — @see lib/dotgen/cluster.c:mark_clusters
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:mark_clusters (virtual node marking) */
export function markClustersVnodes(clust: Graph, n: Node): void {
  for (const orig of clust.edges) {
    if (orig.tail !== n) continue;
    let e: Edge | undefined = orig.info.to_virt;
    while (e !== undefined && e.head.info.node_type === VIRTUAL) {
      e.head.info.clust = clust;
      e = e.head.info.out?.list[0];
    }
  }
}

/** @see lib/dotgen/cluster.c:mark_clusters */
export function markClusters(g: Graph): void {
  for (const n of g.nodes.values()) {
    if (n.info.ranktype === CLUSTER) ufSingleton(n);
    n.info.clust = undefined;
  }
  const nClust = g.info.n_cluster ?? 0;
  for (let c = 1; c <= nClust; c++) {
    const clust = g.info.clust![c - 1];
    for (const n of clust.nodes.values()) {
      if (n.info.ranktype !== 0) continue;
      ufSetname(n, clust.info.leader!);
      n.info.clust = clust;
      n.info.ranktype = CLUSTER;
      markClustersVnodes(clust, n);
    }
  }
}

// ---------------------------------------------------------------------------
// build_skeleton — @see lib/dotgen/cluster.c:build_skeleton
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:build_skeleton (edge span accumulation) */
export function buildSkeletonEdgeCounts(subg: Graph, v: Node): void {
  const lo = v.info.rank ?? 0;
  for (const e of subg.edges) {
    if (e.tail !== v) continue;
    const hi = e.head.info.rank ?? 0;
    for (let r = lo; r < hi; r++) {
      const rlr = subg.info.rankleader![r];
      rlr.info.out!.list[0].info.count = (rlr.info.out!.list[0].info.count ?? 1) + 1;
    }
  }
}

/** @see lib/dotgen/cluster.c:build_skeleton (per-node count update) */
export function buildSkeletonCountsNode(subg: Graph, v: Node): void {
  const rl = subg.info.rankleader![(v.info.rank ?? 0)];
  rl.info.UF_size = (rl.info.UF_size ?? 0) + 1;
  buildSkeletonEdgeCounts(subg, v);
}

/** @see lib/dotgen/cluster.c:build_skeleton (trim UF_size) */
export function buildSkeletonTrimSize(subg: Graph, mn: number, mx: number): void {
  for (let r = mn; r <= mx; r++) {
    const rl = subg.info.rankleader![r];
    if ((rl.info.UF_size ?? 0) > 1) rl.info.UF_size = (rl.info.UF_size ?? 0) - 1;
  }
}

/** @see lib/dotgen/cluster.c:build_skeleton (edge count accumulation) */
export function buildSkeletonCounts(_g: Graph, subg: Graph, mn: number, mx: number): void {
  for (const v of subg.nodes.values()) buildSkeletonCountsNode(subg, v);
  buildSkeletonTrimSize(subg, mn, mx);
}

/** @see lib/dotgen/cluster.c:build_skeleton */
export function buildSkeleton(g: Graph, subg: Graph): void {
  const [mn, mx] = subgraphBounds(subg);
  subg.info.rankleader = new Array(mx + 2).fill(null as unknown as Node);
  let prev: Node | undefined;
  for (let r = mn; r <= mx; r++) {
    const v = virtualNode(g);
    v.info.rank = r;
    v.info.ranktype = CLUSTER;
    v.info.clust = subg;
    subg.info.rankleader![r] = v;
    if (prev !== undefined) {
      const e = newVirtualEdge(prev, v, null);
      fastEdge(e);
      e.info.xpenalty = (e.info.xpenalty ?? 1) * 1000;
    }
    prev = v;
  }
  buildSkeletonCounts(g, subg, mn, mx);
}

// ---------------------------------------------------------------------------
// install_cluster — @see lib/dotgen/cluster.c:install_cluster
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:install_cluster (rank install loop) */
export function installClusterRanks(ctx: MincrossContext, g: Graph, clust: Graph, mn: number, mx: number): number {
  for (let r = mn; r <= mx; r++) {
    const rc = installInRank(ctx, g, clust.info.rankleader![r]);
    if (rc !== 0) return rc;
  }
  return 0;
}

/** @see lib/dotgen/cluster.c:install_cluster */
export function installCluster(g: Graph, n: Node, pass: number, q: Node[]): number {
  const clust = n.info.clust!;
  if ((clust.info.installed ?? 0) === pass + 1) return 0;
  const mn = clust.info.minrank ?? 0;
  const mx = clust.info.maxrank ?? 0;
  const ctx = makeClusterCtx(g, mn, mx);
  const rc = installClusterRanks(ctx, g, clust, mn, mx);
  if (rc !== 0) return rc;
  for (let r = mn; r <= mx; r++) enqueueNeighbors(q, clust.info.rankleader![r], pass);
  clust.info.installed = pass + 1;
  return 0;
}

// ---------------------------------------------------------------------------
// mark_lowclusters — @see lib/dotgen/cluster.c:mark_lowclusters
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:mark_lowclusters (clear pass) */
export function markLowclustersZap(root: Graph): void {
  for (const n of root.nodes.values()) {
    n.info.clust = undefined;
    for (const orig of root.edges) {
      if (orig.tail !== n) continue;
      let e: Edge | undefined = orig.info.to_virt;
      while (e !== undefined && e.head.info.node_type === VIRTUAL) {
        e.head.info.clust = undefined;
        e = e.head.info.out?.list[0];
      }
    }
  }
}

/** @see lib/dotgen/cluster.c:mark_lowclusters (virtual chain assign for one edge) */
export function markLowclusterChain(orig: Edge, g: Graph): void {
  let e: Edge | undefined = orig.info.to_virt;
  while (e !== undefined && e.head.info.node_type === VIRTUAL) {
    if (e.head.info.clust === undefined) e.head.info.clust = g;
    e = e.head.info.out?.list[0];
  }
}

/** @see lib/dotgen/cluster.c:mark_lowclusters (assign pass, recursive) */
export function markLowclusterBasic(g: Graph): void {
  const nClust = g.info.n_cluster ?? 0;
  for (let c = 1; c <= nClust; c++) markLowclusterBasic(g.info.clust![c - 1]);
  for (const n of g.nodes.values()) {
    if (n.info.clust === undefined) n.info.clust = g;
    for (const orig of g.edges) {
      if (orig.tail !== n) continue;
      markLowclusterChain(orig, g);
    }
  }
}

/** @see lib/dotgen/cluster.c:mark_lowclusters */
export function markLowclusters(root: Graph): void {
  markLowclustersZap(root);
  markLowclusterBasic(root);
}
