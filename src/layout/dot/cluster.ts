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
// mergeChain lives in classify.ts (circular: classify ↔ cluster — safe for function refs)
import { mergeChain, portsEq } from './classify.js';

export { CLUSTER_EDGE } from './cluster-path.js';
export { mapInterclustNode } from './cluster-path.js';
export { mergeChain };

// ---------------------------------------------------------------------------
// interclexp helpers — @see lib/dotgen/cluster.c:interclexp
// ---------------------------------------------------------------------------

/**
 * True when edges e and f can be merged as parallel intercluster edges.
 * Must match C exactly: same tail, same head, same label identity, and equal ports.
 *
 * @see lib/dotgen/class2.c:mergeable
 */
export function interclexpMergeable(prev: Edge | undefined, e: Edge): boolean {
  if (!prev) return false;
  return prev.tail === e.tail
    && prev.head === e.head
    && prev.info.label === e.info.label
    && portsEq(prev, e);
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
    // C iterates `agfstedge(g, n)` = agfstout (out-edges sorted by head.id,seq)
    // then agfstin (in-edges sorted by tail.id,seq, self-loops counted once).
    // That order keeps parallel intercluster multi-edges adjacent, so the
    // `prev`-chain merge in interclexpOneEdge accumulates each parallel's
    // ED_xpenalty into the direct rep edge that rcross reads. Iterating
    // `g.edges` (insertion order) instead separates the parallels (e.g.
    // n488->n2 split by n488->n469 in ldbxtried), so their xpenalty is never
    // merged → rcross under-counts → ReMincross picks a different best
    // within-rank order → node-X cascade. @see lib/cgraph/edge.c:agfstedge
    for (const e of [...n.outEdges(g), ...n.inEdges(g)]) {
      if (agContainsEdge(subg, e)) continue;
      prev = interclexpOneEdge(subg, g, e, prev);
    }
  }
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
  // C aliases the cluster's vlist into the root array (merge_ranks:
  // GD_rank(subg)[r].v = GD_rank(root)[r].v + ipos) so later transpose swaps
  // (exchange writes the root array) stay visible to the cluster. A .slice copy
  // detaches the cluster view → cluster transpose never converges. Mirror C: a
  // shared array reference plus the vStart offset (rankGet adds vStart).
  subg.info.rank![r].v = root.info.rank![r].v;
  subg.info.rank![r].vStart = ipos;
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

/**
 * Mirror cgraph agdelnode(clust, n): remove the node from the cluster subgraph
 * AND delete its incident edges from the subgraph (node_induce/mark_clusters
 * induce root edges whose endpoints are transient cluster members; deleting only
 * the node leaves the edge behind, so agContainsEdge wrongly reports it internal
 * — 1332 chain orphaned, b53 foreign node re-ranked). agdelete affects the
 * subgraph only, not root/ancestors. @see lib/dotgen/cluster.c:mark_clusters
 */
export function agDeleteFromCluster(clust: Graph, n: Node): void {
  clust.nodes.delete(n.name);
  const edges = clust.edges;
  for (let i = edges.length - 1; i >= 0; i--) {
    if (edges[i].tail === n || edges[i].head === n) edges.splice(i, 1);
  }
}

/**
 * C node_induce first loop: a node is in at most one cluster at this level. A
 * node already claimed by an earlier sibling cluster (ranktype set, or contained
 * in another of par's clusters) is agdeleted from clust — node AND incident
 * edges — so this cluster's internal dot1Rank does not re-rank the foreign node
 * (b53: node_49 owned by cluster_node_43 was also ranked by cluster_node_52,
 * clobbering its rank). makeNewCluster has not yet added clust to par.clust, so
 * par.clust holds only earlier siblings. @see lib/dotgen/rank.c:node_induce
 */
export function pruneForeignClusterNodes(par: Graph, clust: Graph): void {
  const sibs = par.info.clust;
  const nc = par.info.n_cluster ?? 0;
  for (const n of [...clust.nodes.values()]) {
    let foreign = (n.info.ranktype ?? 0) !== 0;
    for (let i = 0; !foreign && sibs && i < nc - 1; i++) {
      if (sibs[i].nodes.get(n.name) === n) foreign = true;
    }
    if (foreign) agDeleteFromCluster(clust, n);
    n.info.clust = undefined;
  }
}

/**
 * mark_clusters per-node: claim `n` for `clust`, or agdelete it if already
 * claimed (first-cluster-wins). ranktype defaults to NORMAL(==0) in C (calloc);
 * TS leaves it undefined, so coerce undefined→0 — else untouched NORMAL nodes
 * are wrongly skipped and never receive ND_clust. @see lib/dotgen/cluster.c:mark_clusters
 */
export function markClusterNode(clust: Graph, n: Node): void {
  if ((n.info.ranktype ?? 0) !== 0) { agDeleteFromCluster(clust, n); return; }
  ufSetname(n, clust.info.leader!);
  n.info.clust = clust;
  n.info.ranktype = CLUSTER;
  markClustersVnodes(clust, n);
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
    // Snapshot: markClusterNode deletes from clust.nodes mid-loop.
    for (const n of [...clust.nodes.values()]) markClusterNode(clust, n);
  }
}

// ---------------------------------------------------------------------------
// build_skeleton — @see lib/dotgen/cluster.c:build_skeleton
// ---------------------------------------------------------------------------

/** @see lib/dotgen/cluster.c:build_skeleton (edge span accumulation) */
export function buildSkeletonEdgeCounts(subg: Graph, v: Node): void {
  // C fixes rl = GD_rankleader(subg)[ND_rank(v)] ONCE (the leader of v's own
  // rank) and bumps ND_out(rl).list[0] count (hi-lo) times. The port indexed
  // rankleader[r] per r, so an edge whose head rank exceeds subg.maxrank reached
  // rankleader[mx] — the last skeleton leader, which has no outgoing edge (empty
  // out.list) — and crashed. @see cluster.c:build_skeleton count loop.
  const lo = v.info.rank ?? 0;
  const rl = subg.info.rankleader![lo];
  for (const e of subg.edges) {
    if (e.tail !== v) continue;
    const hi = e.head.info.rank ?? 0;
    for (let r = lo; r < hi; r++) {
      rl.info.out!.list[0].info.count = (rl.info.out!.list[0].info.count ?? 1) + 1;
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

/**
 * Group a graph's edges by tail node, preserving edge order within each tail
 * (so the virtual-chain assignment order matches C's agfstout/agnxtout walk).
 * Built once per pass so the node×edge scans below are O(E), not O(N·E) — C
 * iterates each node's out-edges via the adjacency list, never the whole edge
 * set per node. @see lib/cgraph/edge.c:agfstout
 */
function outEdgesByTail(edges: Edge[]): Map<Node, Edge[]> {
  const m = new Map<Node, Edge[]>();
  for (const e of edges) {
    const l = m.get(e.tail);
    if (l !== undefined) l.push(e);
    else m.set(e.tail, [e]);
  }
  return m;
}

/** @see lib/dotgen/cluster.c:mark_lowclusters (clear pass) */
export function markLowclustersZap(root: Graph): void {
  const outByTail = outEdgesByTail(root.edges);
  for (const n of root.nodes.values()) {
    n.info.clust = undefined;
    const oes = outByTail.get(n);
    if (oes === undefined) continue;
    for (const orig of oes) {
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
  const outByTail = outEdgesByTail(g.edges);
  for (const n of g.nodes.values()) {
    if (n.info.clust === undefined) n.info.clust = g;
    const oes = outByTail.get(n);
    if (oes === undefined) continue;
    for (const orig of oes) markLowclusterChain(orig, g);
  }
}

/** @see lib/dotgen/cluster.c:mark_lowclusters */
export function markLowclusters(root: Graph): void {
  markLowclustersZap(root);
  markLowclusterBasic(root);
}
