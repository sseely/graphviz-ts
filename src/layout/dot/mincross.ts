// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of lib/dotgen/mincross.c — entry point, init, merge,
 * cleanup, vlist helpers, virtualWeight, and mincrossOptions.
 * Shared utilities live in mincross-utils.ts; crossing computations in
 * mincross-cross.ts; ordering in mincross-order.ts; rank building in
 * mincross-build.ts.
 *
 * @see lib/dotgen/mincross.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { VIRTUAL, FLATORDER, deleteFlatEdge } from './fastgr.js';
import { scaleClamp, NEW_RANK } from './rank.js';
import { decompose } from './decomp.js';
import {
  MincrossContext, dotRoot, furthestNode, rankGet,
  agContainsNode, agContainsEdge,
} from './mincross-utils.js';
import { mincrossMain } from './mincross-order.js';
import { setReMincross } from './mincross-cross.js';
import {
  allocateRanks, fillRanks, orderedEdges, class2,
  flatBreakcycles, flatReorder, expandCluster, markLowclusters,
} from './mincross-build.js';

export type { MincrossContext };
export { dotRoot, agContainsNode, agContainsEdge, rankGet };
export {
  CONVERGENCE, matrixGet, matrixSet, newMatrix, matrixCopyBits,
  insideCluster, isNormalNodeOf, isVnodeOfEdgeOf, neighborNode,
  furthestNode, rankSet,
} from './mincross-utils.js';

// ---------------------------------------------------------------------------
// virtualWeight
// ---------------------------------------------------------------------------

const WNODE_ORDINARY = 0;
const WNODE_SINGLETON = 1;
const WNODE_VIRTUAL = 2;

const WEIGHT_TABLE = [
  [1, 1, 1],
  [1, 2, 2],
  [1, 2, 4],
];

export function endpointClass(n: Node): number {
  if (n.info.node_type === VIRTUAL) return WNODE_VIRTUAL;
  if ((n.info.weight_class !== undefined ? n.info.weight_class : 2) <= 1) return WNODE_SINGLETON;
  return WNODE_ORDINARY;
}

/** @see lib/dotgen/mincross.c:virtual_weight */
export function virtualWeight(e: Edge): void {
  const t = WEIGHT_TABLE[endpointClass(e.tail)][endpointClass(e.head)];
  e.info.weight = (e.info.weight !== undefined ? e.info.weight : 1) * t;
}

// ---------------------------------------------------------------------------
// mincrossOptions
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:mincross_options */
export function mincrossOptions(ctx: MincrossContext, g: Graph): void {
  ctx.minQuit = 8;
  ctx.maxIter = 24;
  const p = g.attrs.get('mclimit');
  if (p) {
    const f = parseFloat(p);
    if (f > 0) {
      ctx.minQuit = Math.max(1, scaleClamp(ctx.minQuit, f));
      ctx.maxIter = Math.max(1, scaleClamp(ctx.maxIter, f));
    }
  }
}

// ---------------------------------------------------------------------------
// Vlist helpers
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:save_vlist */
export function saveVlist(g: Graph): void {
  const rl = g.info.rankleader;
  if (!rl) return;
  const rank = g.info.rank;
  if (!rank) return;
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  // C reads GD_rank(g)[r].v[0], where .v is the offset window pointer
  // (= root array + vStart). TS keeps .v as the full root array plus a
  // separate vStart, so the faithful read is rankGet(rk, 0) = rk.v[vStart].
  // Reading rk.v[0] grabbed the root's leftmost node for windowed clusters,
  // corrupting the rankleader → wrong vStart in rec_reset_vlists. Same
  // vStart-window bug class as mincross Layers 1 & 2. @see mincross.c:save_vlist
  for (let r = mn; r <= mx; r++) rl[r] = rankGet(rank[r], 0);
}

/** @see lib/dotgen/mincross.c:rec_save_vlists */
export function recSaveVlists(g: Graph): void {
  saveVlist(g);
  const nc = g.info.n_cluster !== undefined ? g.info.n_cluster : 0;
  const clust = g.info.clust;
  if (!clust) return;
  for (let c = 1; c <= nc; c++) recSaveVlists(clust[c - 1]);
}

/** @see lib/dotgen/mincross.c:rec_reset_vlists */
export function recResetVlists(ctx: MincrossContext, g: Graph): void {
  const nc = g.info.n_cluster !== undefined ? g.info.n_cluster : 0;
  const clust = g.info.clust;
  if (clust) for (let c = 1; c <= nc; c++) recResetVlists(ctx, clust[c - 1]);
  resetVlistRanks(ctx, g);
}

/** @see lib/dotgen/mincross.c:reset_vlists */
export function resetVlistRanks(ctx: MincrossContext, g: Graph): void {
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  for (let r = mn; r <= mx; r++) applyVlistReset(ctx, g, r);
}

/** @see lib/dotgen/mincross.c:reset_vlist */
export function applyVlistReset(ctx: MincrossContext, g: Graph, r: number): void {
  const rl = g.info.rankleader;
  if (!rl) return;
  const rank = g.info.rank;
  if (!rank) return;
  const rootRank = dotRoot(g).info.rank;
  if (!rootRank) return;
  const v = rl[r];
  if (!v) return;
  const u = furthestNode(ctx, g, v, -1);
  const w = furthestNode(ctx, g, v, 1);
  rl[r] = u;
  rank[r].vStart = u.info.order !== undefined ? u.info.order : 0;
  rank[r].v = rootRank[r].v;
  const wOrd = w.info.order !== undefined ? w.info.order : 0;
  const uOrd = u.info.order !== undefined ? u.info.order : 0;
  rank[r].n = wOrd - uOrd + 1;
}

// ---------------------------------------------------------------------------
// init_mincross / init_mccomp
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:init_mincross */
export function initMincross(ctx: MincrossContext, g: Graph): void {
  ctx.reMincross = false;
  setReMincross(false);
  ctx.root = g;
  const edgeCount = dotRoot(g).edges.length + 1;
  ctx.teList = new Array<Edge>(edgeCount).fill(null as unknown as Edge);
  ctx.tiList = new Array<number>(edgeCount).fill(0);
  mincrossOptions(ctx, g);
  if (g.info.flags & NEW_RANK) fillRanks(g);
  class2(g);
  decompose(g, 1);
  allocateRanks(g);
  orderedEdges(ctx, g);
  ctx.globalMinRank = g.info.minrank !== undefined ? g.info.minrank : 0;
  ctx.globalMaxRank = g.info.maxrank !== undefined ? g.info.maxrank : 0;
}

/** @see lib/dotgen/mincross.c:init_mccomp */
export function initMccomp(g: Graph, c: number): void {
  const comp = g.info.comp;
  if (!comp) return;
  g.info.nlist = comp[c];
  if (c === 0) return;
  const rank = g.info.rank;
  if (!rank) return;
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  for (let r = mn; r <= mx; r++) {
    const entry = rank[r];
    const vs = entry.vStart !== undefined ? entry.vStart : 0;
    entry.vStart = vs + entry.n;
    entry.n = 0;
  }
}

// ---------------------------------------------------------------------------
// merge_components / merge2
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:merge_components */
export function mergeComponents(ctx: MincrossContext, g: Graph): void {
  const comp = g.info.comp;
  if (!comp || comp.length <= 1) return;
  let u: Node | undefined;
  for (let c = 0; c < comp.length; c++) {
    let v: Node = comp[c];
    if (u) u.info.next = v;
    v.info.prev = u;
    while (v.info.next) v = v.info.next;
    u = v;
  }
  g.info.nlist = comp[0];
  g.info.minrank = ctx.globalMinRank;
  g.info.maxrank = ctx.globalMaxRank;
}

/** @see lib/dotgen/mincross.c:merge2 */
export function merge2(ctx: MincrossContext, g: Graph): void {
  mergeComponents(ctx, g);
  const rank = g.info.rank;
  if (!rank) return;
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  for (let r = mn; r <= mx; r++) {
    rank[r].n = rank[r].an;
    rank[r].vStart = 0;
    for (let i = 0; i < rank[r].n; i++) {
      const v = rank[r].v[i];
      if (!v) { rank[r].n = i; break; }
      v.info.order = i;
    }
  }
}

// ---------------------------------------------------------------------------
// cleanup2
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:cleanup2 */
export function cleanup2(ctx: MincrossContext, g: Graph): void {
  ctx.tiList = [];
  ctx.teList = [];
  const nc = g.info.n_cluster !== undefined ? g.info.n_cluster : 0;
  const clust = g.info.clust;
  if (clust) for (let c = 1; c <= nc; c++) recResetVlists(ctx, clust[c - 1]);
  cleanup2Ranks(g);
}

/** @see lib/dotgen/mincross.c:cleanup2 (rank loop) */
export function cleanup2Ranks(g: Graph): void {
  const rank = g.info.rank;
  if (!rank) return;
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  for (let r = mn; r <= mx; r++) {
    for (let i = 0; i < rank[r].n; i++) {
      rank[r].v[i].info.order = i;
      removeFlatorderEdges(rank[r].v[i]);
    }
    rank[r].flat = undefined;
  }
}

/** @see lib/dotgen/mincross.c:cleanup2 (flatorder removal) */
export function removeFlatorderEdges(v: Node): void {
  const fo = v.info.flat_out;
  if (!fo) return;
  let j = 0;
  while (j < fo.size) {
    const e = fo.list[j];
    if (e.info.edge_type === FLATORDER) { deleteFlatEdge(e); j--; }
    j++;
  }
}

// ---------------------------------------------------------------------------
// mincrossClust
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:mincross_clust */
export function mincrossClust(ctx: MincrossContext, g: Graph): number {
  if (expandCluster(g) !== 0) return -1;
  orderedEdges(ctx, g);
  flatBreakcycles(ctx, g);
  flatReorder(ctx, g);
  let nc = mincrossMain(ctx, g, 2);
  if (nc < 0) return nc;
  const nClust = g.info.n_cluster !== undefined ? g.info.n_cluster : 0;
  const clust = g.info.clust;
  if (clust) {
    for (let c = 1; c <= nClust; c++) {
      const mc = mincrossClust(ctx, clust[c - 1]);
      if (mc < 0) return mc;
      nc += mc;
    }
  }
  saveVlist(g);
  return nc;
}

// ---------------------------------------------------------------------------
// dot_mincross — main entry point
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:dot_mincross */
/**
 * Drop clusters with no member nodes before crossing/expansion.
 *
 * C `dot_mincross` removes empty clusters up front (only parse-time-empty
 * "malformed input" clusters reach that point). The port must run it *after*
 * `initMincross` because a node referenced in several clusters is pruned to its
 * first cluster by `mark_clusters` agdelete (defect A) during init — emptying
 * the later clusters. The port then *must* drop them: `merge_ranks` aliases each
 * cluster's `rank[r].v` into the shared root rank array (vStart), so expanding an
 * empty cluster clobbers the slot a sibling cluster just filled (e.g. 1221/2721:
 * one node in two clusters → node lost, `rank.v[0]` null → position crash). C is
 * immune because it installs from the root node list, not cluster membership.
 * An empty cluster has no bbox and is not drawn, so dropping it matches C output.
 *
 * @see lib/dotgen/mincross.c:dot_mincross (empty-cluster removal loop)
 */
export function removeEmptyClusters(g: Graph): void {
  const clust = g.info.clust;
  if (!clust) return;
  const kept = clust.filter((c) => c.nodes.size > 0);
  if (kept.length === clust.length) return;
  g.info.clust = kept;
  g.info.n_cluster = kept.length;
}

export function dotMincross(g: Graph): number {
  const ctx = makeMincrossCtx(g);
  initMincross(ctx, g);
  removeEmptyClusters(g);
  const comp = g.info.comp;
  if (!comp) return 0;
  let nc = runComponents(ctx, g, comp);
  if (nc < 0) return -1;
  merge2(ctx, g);
  const clusterNc = runClusters(ctx, g);
  if (clusterNc < 0) return -1;
  nc += clusterNc;
  const reNc = runRemincross(ctx, g, nc);
  if (reNc < 0) return -1;
  cleanup2(ctx, g);
  return 0;
}

/** @see lib/dotgen/mincross.c:dot_mincross (component loop) */
export function runComponents(ctx: MincrossContext, g: Graph, comp: Node[]): number {
  let nc = 0;
  for (let c = 0; c < comp.length; c++) {
    initMccomp(g, c);
    const mc = mincrossMain(ctx, g, 0);
    if (mc < 0) return -1;
    nc += mc;
  }
  return nc;
}

/** @see lib/dotgen/mincross.c:dot_mincross (cluster loop) */
export function runClusters(ctx: MincrossContext, g: Graph): number {
  const nClust = g.info.n_cluster !== undefined ? g.info.n_cluster : 0;
  const clust = g.info.clust;
  if (!clust) return 0;
  let nc = 0;
  for (let c = 1; c <= nClust; c++) {
    const mc = mincrossClust(ctx, clust[c - 1]);
    if (mc < 0) return -1;
    nc += mc;
  }
  return nc;
}

/** @see lib/dotgen/mincross.c:dot_mincross (remincross) */
export function runRemincross(ctx: MincrossContext, g: Graph, nc: number): number {
  const nClust = g.info.n_cluster !== undefined ? g.info.n_cluster : 0;
  if (nClust === 0) return nc;
  const s = g.attrs.get('remincross');
  const doRe = !s || (s !== '0' && s.toLowerCase() !== 'false');
  if (!doRe) return nc;
  markLowclusters(g);
  ctx.reMincross = true;
  setReMincross(true);
  const mc = mincrossMain(ctx, g, 2);
  return mc < 0 ? -1 : mc;
}

/** @see lib/dotgen/mincross.c:dot_mincross (context init) */
export function makeMincrossCtx(g: Graph): MincrossContext {
  return {
    root: g, globalMinRank: 0, globalMaxRank: 0,
    teList: [], tiList: [], reMincross: false, minQuit: 8, maxIter: 24,
  };
}
