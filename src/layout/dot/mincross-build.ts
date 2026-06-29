// SPDX-License-Identifier: EPL-2.0

/**
 * Build-phase helpers for the mincross algorithm: rank allocation and filling,
 * BFS rank installation, and edge-ordering setup. Flat-edge cycle breaking and
 * flat reorder live in ./mincross-flat.js and are re-exported here.
 * @see lib/dotgen/mincross.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { RankEntry } from '../../model/rankEntry.js';
import {
  FLATORDER,
  newVirtualEdge, flatEdge, findFlatEdge,
} from './fastgr.js';
import {
  MincrossContext, dotRoot, rankGet,
} from './mincross-utils.js';
import { transpose, ncross, exchange } from './mincross-cross.js';
import { CLUSTER, isACluster } from './rank.js';
import { installCluster, expandCluster, markLowclusters } from './cluster.js';
import { agnode, agsubg, agsubnode } from '../../model/cgraph-ops.js';

// betweenclust — @see lib/dotgen/mincross.c:betweenclust
export function betweenclust(e: Edge): boolean {
  let cur: Edge = e;
  while (cur.info.to_orig !== undefined) cur = cur.info.to_orig;
  return cur.tail.info.clust !== cur.head.info.clust;
}

// Flat-edge cycle breaking and flat reorder live in ./mincross-flat.js.
// Re-exported here so existing importers of './mincross-build.js' resolve.
export {
  flatRevFindRev, flatRev,
  flatSearchOstack, flatSearchNormal, flatSearchEdge, flatSearch,
  flatBreakcyclesRank, flatBreakcycles,
  constrainingFlatEdge, countConstraining, postorder,
  flatReorderBuildTemprank, flatReorderFixEdges, flatReorderRank, flatReorder,
} from './mincross-flat.js';

// allocate_ranks — @see lib/dotgen/mincross.c:allocate_ranks
export function makeEmptyRank(): RankEntry {
  const rt: RankEntry = { n: 0, v: [], an: 0, av: [], ht1: 0, ht2: 0, pht1: 0, pht2: 0, candidate: false, valid: false, cache_nc: 0, flat: undefined, vStart: 0 };
  return rt;
}

export function allocateRanksCount(g: Graph, cn: number[]): void {
  // Must iterate REAL graph edges (agfstout/agnxtout in C), not fast-graph
  // virtual edges (n.info.out). Virtual edges are 1-rank-spanning by
  // construction, so they contribute nothing to intermediate-rank counts.
  // Real edges carry the original tail→head rank span (e.g. minlen=2 makes
  // A.rank=0, B.rank=2 → intermediate rank 1 needs a slot).
  // Per-node rank tally, then per-edge intermediate-rank spans. The edge pass
  // is a pure count, independent of per-node edge order, so iterate g.edges once
  // (O(N+E)) rather than n.outEdges(g) per node (O(N·E)). Self-loops have
  // lo==hi and contribute nothing — matching the original outEdges walk.
  for (const n of g.nodes.values()) {
    const r = n.info.rank !== undefined ? n.info.rank : 0;
    cn[r]++;
  }
  for (const e of g.edges) {
    let lo = e.tail.info.rank !== undefined ? e.tail.info.rank : 0;
    let hi = e.head.info.rank !== undefined ? e.head.info.rank : 0;
    if (lo > hi) { const tmp = lo; lo = hi; hi = tmp; }
    for (let r2 = lo + 1; r2 < hi; r2++) cn[r2]++;
  }
}

export function allocateRanks(g: Graph): void {
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const cn = new Array<number>(mx + 2).fill(0);
  allocateRanksCount(g, cn);
  const rt: RankEntry[] = [];
  for (let r = 0; r <= mx + 1; r++) rt.push(makeEmptyRank());
  for (let r = mn; r <= mx; r++) {
    const sz = cn[r] + 1;
    rt[r].an = sz;
    rt[r].n = sz;
    rt[r].v = new Array<Node>(sz).fill(null as unknown as Node);
    rt[r].av = rt[r].v;
  }
  g.info.rank = rt;
}

// fillRanks — @see lib/dotgen/mincross.c:fillRanks (1013), realFillRanks (976)
//
// Inserts placeholder ("fill") nodes into ranks left empty by clustered
// layout, so cross-cluster ranks reconcile. NEW_RANK-gated; never runs on
// default graphs. AD-3: synthetic node names `__fill_<rank>_<seq>`.

/**
 * Monotonic fill-node sequence counter, reset at the top of every
 * `fillRanks` invocation so each `__fill_<rank>_<seq>` name is globally
 * unique within a single fill pass (two clusters needing the same rank get
 * distinct names rather than colliding/deduping by name).
 */
let fillSeq = 0;

/**
 * Create a placeholder fill node in the `_new_rank` subgraph at `rank`.
 * Mirrors the body of the C `agnode(sg, NULL, 1)` block (mincross.c:999-1006):
 * synthesize the node, make it a member of `sg`, and initialize the layout
 * fields. AD-3 mandates the synthetic name `__fill_<rank>_<seq>`; `seq`
 * guarantees global uniqueness.
 *
 * @see lib/dotgen/mincross.c:999
 */
function makeFillNode(sg: Graph, rank: number, seq: number): Node {
  // create=true => non-null; AD-3 synthetic (named, not anonymous) node.
  const n = agnode(sg, `__fill_${rank}_${seq}`, true)!;
  // T1's agnode registers in root.nodes only; explicitly add to _new_rank so
  // removeFill (T4) — which iterates the _new_rank subgraph — can find it.
  agsubnode(sg, n, true);
  n.info.rank = rank;
  n.info.lw = 0.5;
  n.info.rw = 0.5;
  n.info.ht = 1;
  n.info.UF_size = 1;
  n.info.in = { list: [], size: 0 };
  n.info.out = { list: [], size: 0 };
  return n;
}

/** Mark ranks occupied by a node of `g` or spanned by its out-edges.
 * @see lib/dotgen/mincross.c:986 (bitarray_clear + node/edge marking loop) */
function markOccupiedRanks(g: Graph, ranks: boolean[]): void {
  ranks.fill(false); // bitarray_clear
  for (const n of g.nodes.values()) {
    const nr = n.info.rank ?? 0;
    ranks[nr] = true;
    for (const e of n.outEdges(g)) {
      const hr = e.head.info.rank ?? 0;
      for (let i = nr + 1; i <= hr; i++) ranks[i] = true;
    }
  }
}

/** For each empty rank of `g`, create a placeholder, lazily creating the
 * `_new_rank` subgraph on the first gap. @see lib/dotgen/mincross.c:994 */
function fillEmptyRanks(g: Graph, ranks: boolean[], sg: Graph | null): Graph | null {
  const mn = g.info.minrank ?? 0;
  const mx = g.info.maxrank ?? 0;
  for (let i = mn; i <= mx; i++) {
    if (ranks[i]) continue;
    if (!sg) sg = agsubg(g.root, '_new_rank', true)!;
    const n = makeFillNode(sg, i, fillSeq++);
    agsubnode(g, n, true); // add to cluster g (and ancestors up to root)
  }
  return sg;
}

/**
 * Recursive cluster walk: fill empty ranks in `g` and its sub-clusters with
 * placeholder nodes; returns the `_new_rank` subgraph (lazily created).
 *
 * DEVIATION (clust indexing): the C loop is `c=1..n_cluster` over the 1-based
 * `GD_clust(g)[c]`. This port's `g.info.clust` is 0-indexed (populated at
 * `clust[nc-1]` in rank.ts), so we read `clust[c-1]` for the same cluster.
 *
 * @see lib/dotgen/mincross.c:976
 */
export function realFillRanks(
  g: Graph,
  ranks: boolean[],
  sg: Graph | null,
): Graph | null {
  const nClust = g.info.n_cluster ?? 0;
  const clust = g.info.clust;
  for (let c = 1; c <= nClust; c++) {
    sg = realFillRanks(clust![c - 1], ranks, sg);
  }
  if (dotRoot(g) === g) return sg;
  markOccupiedRanks(g, ranks);
  return fillEmptyRanks(g, ranks, sg);
}
/** @see lib/dotgen/mincross.c:fillRanks (1013) */
export function fillRanks(g: Graph): void {
  fillSeq = 0;
  const rnksSz = (g.info.maxrank ?? 0) + 2;
  const rnks = new Array<boolean>(rnksSz).fill(false);
  realFillRanks(g, rnks, null);
}

// install_in_rank / enqueue_neighbors — @see lib/dotgen/mincross.c

/** Check that rank r is within the graph's rank range. */
export function rankInRange(g: Graph, r: number): boolean {
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  return r >= mn && r <= mx;
}

/** Check that node's order doesn't exceed root rank allocation. */
export function orderWithinAlloc(ctx: MincrossContext, r: number, order: number): boolean {
  const rootRank = ctx.root.info.rank;
  return !rootRank || order <= rootRank[r].an;
}

/** Place node n into its rank slot, honouring vStart for multi-component graphs. */
export function placeInRankSlot(g: Graph, n: Node, r: number): number {
  const rank = g.info.rank;
  if (!rank) return -1;
  const rk = rank[r];
  if (rk.an <= 0) return -1;
  // vStart simulates C's rank[r].v pointer arithmetic across components.
  const i = (rk.vStart ?? 0) + rk.n;
  rk.v[i] = n;
  n.info.order = i;
  rk.n++;
  return i;
}

export function installInRank(ctx: MincrossContext, g: Graph, n: Node): number {
  const r = n.info.rank !== undefined ? n.info.rank : 0;
  if (placeInRankSlot(g, n, r) < 0) return -1;
  if (!rankInRange(g, r)) return -1;
  if (!orderWithinAlloc(ctx, r, n.info.order ?? 0)) return -1;
  return 0;
}

export function enqueueNeighbors(q: Node[], n0: Node, pass: number): void {
  const edges = pass === 0 ? n0.info.out : n0.info.in;
  if (!edges) return;
  for (let i = 0; i < edges.size; i++) {
    const e = edges.list[i];
    const nb = pass === 0 ? e.head : e.tail;
    if (!nb.info.mark) { nb.info.mark = 1; q.push(nb); }
  }
}

export { installCluster };

// build_ranks — @see lib/dotgen/mincross.c:build_ranks
export function buildRanksFlip(ctx: MincrossContext, g: Graph, mn: number, mx: number): void {
  const rank = g.info.rank;
  const rootRank = ctx.root.info.rank;
  if (!rank || !rootRank) return;
  for (let i = mn; i <= mx; i++) {
    rootRank[i].valid = false;
    const rk = rank[i];
    if (!g.info.flip || rk.n <= 0) continue;
    // C reverses each rank via exchange() (mincross.c:1293-1300), which indexes
    // by absolute ND_order and is multiset-preserving. A manual 0-based reverse
    // assigning order=j corrupts (duplicates) orders in windowed passes
    // (vStart>0: RL/flip + multi-component), so mirror C's exchange() exactly.
    const last = rk.n - 1;
    for (let j = 0; j <= last >> 1; j++) {
      exchange(ctx, rankGet(rk, j), rankGet(rk, last - j));
    }
  }
}

export function buildRanksBfs(ctx: MincrossContext, g: Graph, pass: number, startNode: Node): number {
  const q: Node[] = [startNode];
  startNode.info.mark = 1;
  while (q.length > 0) {
    const n0 = q.shift()!;
    if ((n0.info.ranktype !== undefined ? n0.info.ranktype : 0) !== CLUSTER) {
      if (installInRank(ctx, g, n0) !== 0) return -1;
      enqueueNeighbors(q, n0, pass);
    } else {
      const rc = installCluster(g, n0, pass, q);
      if (rc !== 0) return rc;
    }
  }
  return 0;
}

export function buildRanksFindStart(g: Graph): Node | undefined {
  if (g === g.root) return g.info.nlist;
  let ns: Node | undefined = g.info.nlist;
  while (ns !== undefined && ns.info.next !== undefined) ns = ns.info.next;
  return ns;
}

export function buildRanksSources(ctx: MincrossContext, g: Graph, pass: number, ns: Node | undefined): number {
  const walkBackwards = g !== g.root;
  for (let n = ns; n !== undefined; n = walkBackwards ? n.info.prev : n.info.next) {
    const edges = pass === 0 ? n.info.in : n.info.out;
    if (edges !== undefined && edges.size > 0) continue;
    if (!n.info.mark) {
      const rc = buildRanksBfs(ctx, g, pass, n);
      if (rc !== 0) return rc;
    }
  }
  return 0;
}

export function buildRanks(ctx: MincrossContext, g: Graph, pass: number): number {
  const rank = g.info.rank;
  if (!rank) return -1;
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  for (let n: Node | undefined = g.info.nlist; n !== undefined; n = n.info.next) n.info.mark = 0;
  for (let i = mn; i <= mx; i++) rank[i].n = 0;
  const rc = buildRanksSources(ctx, g, pass, buildRanksFindStart(g));
  if (rc !== 0) return rc;
  buildRanksFlip(ctx, g, mn, mx);
  if (g === dotRoot(g) && ncross(ctx) > 0) transpose(ctx, g, false);
  return 0;
}

// do_ordering — @see lib/dotgen/mincross.c:do_ordering_node
export function doOrderingAddFlatEdges(g: Graph, sortlist: Edge[], outflag: boolean): void {
  for (let i = 1; i < sortlist.length; i++) {
    const e = sortlist[i - 1];
    const f = sortlist[i];
    const u = outflag ? e.head : e.tail;
    const v = outflag ? f.head : f.tail;
    if (findFlatEdge(u, v)) return;
    const fe = newVirtualEdge(u, v, null);
    fe.info.edge_type = FLATORDER;
    flatEdge(g, fe);
  }
}

export function doOrderingNode(ctx: MincrossContext, g: Graph, n: Node, outflag: boolean): void {
  if (n.info.clust) return;
  const edges = outflag ? n.info.out : n.info.in;
  if (!edges) return;
  const sortlist: Edge[] = [];
  for (let i = 0; i < edges.size; i++) {
    const e = edges.list[i];
    if (!betweenclust(e)) sortlist.push(e);
  }
  if (sortlist.length <= 1) return;
  ctx.teList = sortlist;
  // @see lib/dotgen/mincross.c:do_ordering_node — qsort by edgeidcmpf (AGSEQ).
  // Virtual edges carry AGSEQ(orig) (set in newVirtualEdge, mirroring C's
  // new_virtual_edge), so this orders by the original DOT-declaration order.
  sortlist.sort((a, b) => a.seq - b.seq);
  doOrderingAddFlatEdges(g, sortlist, outflag);
}

export function doOrderingForNodes(ctx: MincrossContext, g: Graph): void {
  for (const n of g.nodes.values()) {
    const ordering = n.attrs.get('ordering');
    if (ordering === 'out') doOrderingNode(ctx, g, n, true);
    else if (ordering === 'in') doOrderingNode(ctx, g, n, false);
  }
}

export function doOrdering(ctx: MincrossContext, g: Graph, outflag: boolean): void {
  for (const n of g.nodes.values()) doOrderingNode(ctx, g, n, outflag);
}

export function orderedEdges(ctx: MincrossContext, g: Graph): void {
  const ordering = g.attrs.get('ordering');
  if (ordering !== undefined) {
    if (ordering === 'out') doOrdering(ctx, g, true);
    else if (ordering === 'in') doOrdering(ctx, g, false);
    return;
  }
  for (const subg of g.subgraphs.values()) {
    if (!isACluster(subg)) orderedEdges(ctx, subg);
  }
  doOrderingForNodes(ctx, g);
}

export { class2 } from './classify.js';
export { expandCluster, markLowclusters };
