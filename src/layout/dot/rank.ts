// SPDX-License-Identifier: EPL-2.0
/** @see lib/dotgen/rank.c — dot1_rank pipeline (dot2_rank in rank-dot2.ts) */
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Graph } from '../../model/graph.js';
import type { TextMeasurer } from '../../common/textmeasure.js';
import { doGraphLabel } from './graph-label.js';
import { ufFind, ufUnion, ufSingleton } from './decomp.js';
import { decompose } from './decomp.js';
import { acyclic } from './acyclic.js';
import { reverseEdge, virtualEdge, zapinlist } from './fastgr.js';
import { rank } from './ns.js';
import { dot2Rank } from './rank-dot2.js';
import { class1 } from './classify.js';
import { pruneForeignClusterNodes } from './cluster.js';

// ---------------------------------------------------------------------------
// Constants  @see lib/common/const.h
// ---------------------------------------------------------------------------

export const SAMERANK   = 1;
export const MINRANK    = 2;
export const SOURCERANK = 3;
export const MAXRANK    = 4;
export const SINKRANK   = 5;
export const LEAFSET    = 6;
export const CLUSTER    = 7;
export const SLACKNODE  = 2;
export const EDGE_LABEL = 1;
/** @see lib/common/const.h:HEAD_LABEL */
export const HEAD_LABEL = 1 << 1;
/** @see lib/common/const.h:TAIL_LABEL */
export const TAIL_LABEL = 1 << 2;
/** @see lib/common/const.h:NODE_XLABEL */
export const NODE_XLABEL = 1 << 4;
/** @see lib/common/const.h:EDGE_XLABEL */
export const EDGE_XLABEL = 1 << 5;
export const NEW_RANK   = 1 << 4;
export const LOCAL      = 100;
export const GLOBAL     = 101;
export const NOCLUST    = 102;

/**
 * Back-edge penalty multiplier for cluster constraints.
 * @see lib/dotgen/class1.c:CL_BACK
 */
export const CL_BACK = 10;

/**
 * Edge type: edge is ignored during layout (concentrated / back-edge suppressed).
 * @see lib/dotgen/class2.c:IGNORED
 */
export const IGNORED = 6;

/** Global cluster layout type. @see lib/common/globals.h:CL_type */
export let clType = LOCAL;
export function setClType(t: number): void { clType = t; }

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * @see lib/common/utils.c:mapBool — mapbool(p) === mapBool(p, false).
 * Only a leading-digit value is parsed numerically (`gv_isdigit(*p)` →
 * `atoi(p) != 0`); any other unrecognized string (e.g. "none") returns the
 * default `false`. The previous `parseInt(s) !== 0` returned `true` for such
 * strings because `NaN !== 0` is true — so `constraint=none` was treated as a
 * rank constraint, mis-ranking clusters joined only by constraint=none edges.
 */
export function mapbool(s: string | undefined): boolean {
  if (!s || s === '') return false;
  const l = s.toLowerCase();
  if (l === 'false' || l === 'no') return false;
  if (l === 'true' || l === 'yes') return true;
  if (s[0] >= '0' && s[0] <= '9') return parseInt(s, 10) !== 0;
  return false;
}

/** @see lib/util/gv_math.h:scale_clamp */
export function scaleClamp(nnodes: number, scale: number): number {
  if (scale < 0) return 0;
  if (scale > 1 && nnodes > Number.MAX_SAFE_INTEGER / scale) return Number.MAX_SAFE_INTEGER;
  return Math.floor(nnodes * scale);
}

/** @see lib/common/utils.c:is_a_cluster */
export function isACluster(g: Graph): boolean {
  if (g === g.root) return true;
  if (g.name.toLowerCase().startsWith('cluster')) return true;
  return mapbool(g.attrs.get('cluster'));
}

export { class1 };

// ---------------------------------------------------------------------------
// cleanup1 — clear fast graph, remove SLACKNODE nodes from comp lists
// @see lib/dotgen/rank.c:cleanup1
// ---------------------------------------------------------------------------

export function cleanup1ClearNode(n: Node): void {
  if (n.info.in) n.info.in.size = 0;
  if (n.info.out) n.info.out.size = 0;
  n.info.mark = 0;
}

export function cleanup1CompSlot(g: Graph, comp: Node[], ci: number): void {
  let prev: Node | undefined;
  let n: Node | undefined = comp[ci];
  while (n !== undefined) {
    const next: Node | undefined = n.info.next;
    cleanup1ClearNode(n);
    if ((n.info.node_type ?? 0) === SLACKNODE) {
      if (prev === undefined) { comp[ci] = next!; g.info.nlist = next; }
      else prev.info.next = next;
      if (next !== undefined) next.info.prev = prev;
    } else {
      prev = n;
    }
    n = next;
  }
}

export function cleanup1VirtA(g: Graph): void {
  for (const n of g.nodes.values()) {
    const out = n.outEdges(g);
    for (const e of out) {
      const f = e.info.to_virt;
      if (f !== undefined && e !== f.info.to_orig) e.info.to_virt = undefined;
    }
  }
}

export function cleanup1VirtB(g: Graph): void {
  for (const n of g.nodes.values()) {
    const out = n.outEdges(g);
    for (const e of out) {
      const f = e.info.to_virt;
      if (f !== undefined && f.info.to_orig === e) e.info.to_virt = undefined;
    }
  }
}

/** @see lib/dotgen/rank.c:cleanup1 */
export function cleanup1(g: Graph): void {
  const comp = g.info.comp;
  if (comp) {
    for (let c = 0; c < comp.length; c++) {
      g.info.nlist = comp[c];
      cleanup1CompSlot(g, comp, c);
    }
  }
  cleanup1VirtA(g);
  cleanup1VirtB(g);
  g.info.comp = undefined;
}

// ---------------------------------------------------------------------------
// edgelabelRanks  @see lib/dotgen/rank.c:edgelabel_ranks
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:edgelabel_ranks */
export function edgelabelRanks(g: Graph): void {
  if (!((g.info.has_labels ?? 0) & EDGE_LABEL)) return;
  for (const n of g.nodes.values()) {
    for (const e of n.outEdges(g)) {
      e.info.minlen = (e.info.minlen ?? 1) * 2;
    }
  }
  g.info.ranksep = Math.floor(((g.info.ranksep ?? 0) + 1) / 2);
}

// ---------------------------------------------------------------------------
// rankSetClass / collapseRankset  @see lib/dotgen/rank.c
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:rank_set_class */
export function rankSetClass(g: Graph): number {
  if (isACluster(g)) return CLUSTER;
  const r = g.attrs.get('rank') ?? '';
  if (r === 'min') return MINRANK;
  if (r === 'source') return SOURCERANK;
  if (r === 'max') return MAXRANK;
  if (r === 'sink') return SINKRANK;
  if (r === 'same') return SAMERANK;
  return 0;
}

export function collapseRanksetMinMax(g: Graph, kind: number, u: Node): void {
  if (kind === MINRANK || kind === SOURCERANK) {
    if (!g.info.minset) g.info.minset = u;
    g.info.minset = ufUnion(g.info.minset, u);
  } else {
    if (!g.info.maxset) g.info.maxset = u;
    g.info.maxset = ufUnion(g.info.maxset, u);
  }
}

/** @see lib/dotgen/rank.c:collapse_rankset */
export function collapseRankset(g: Graph, subg: Graph, kind: number): void {
  const first = subg.nodes.values().next().value as Node | undefined;
  if (!first) return;
  first.info.ranktype = kind;
  const isMinOrMax = kind === MINRANK || kind === SOURCERANK || kind === MAXRANK || kind === SINKRANK;
  if (isMinOrMax) collapseRanksetMinMax(g, kind, first);
  for (const v of subg.nodes.values()) {
    if (v === first) continue;
    ufUnion(first, v);
    v.info.ranktype = kind;
  }
}

// ---------------------------------------------------------------------------
// makeNewCluster / nodeInduce / dotScanRanks / clusterLeader
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:make_new_cluster */
export function makeNewCluster(g: Graph, subg: Graph): void {
  const nc = (g.info.n_cluster ?? 0) + 1;
  g.info.n_cluster = nc;
  if (!g.info.clust) g.info.clust = [];
  g.info.clust[nc - 1] = subg;
  const measurer = (g.root.info.gvc as { textMeasurer?: TextMeasurer } | undefined)?.textMeasurer;
  doGraphLabel(subg, measurer);
}

/**
 * Pull every root edge whose tail and head are both members of `clust` into the
 * cluster subgraph's edge set, so the cluster's local ranking (dot1Rank(subg))
 * sees its internal edges. Mirrors C node_induce's second loop
 * (`agsubedge(g, e, 1)`). Without this, edges declared at root scope between
 * cluster members are invisible to the cluster and it ranks as isolated nodes.
 * @see lib/dotgen/rank.c:node_induce
 */
function induceClusterEdges(clust: Graph): void {
  const owned = new Set<Edge>(clust.edges);
  for (const n of clust.nodes.values()) {
    for (const e of n.outEdges(clust.root)) {
      if (clust.nodes.get(e.head.name) === e.head && !owned.has(e)) {
        clust.edges.push(e);
        owned.add(e);
      }
    }
  }
}

/** @see lib/dotgen/rank.c:node_induce */
export function nodeInduce(par: Graph, clust: Graph): void {
  pruneForeignClusterNodes(par, clust);
  for (const n of clust.nodes.values()) {
    if (n.info.clust) continue;
    n.info.clust = clust;
    n.info.clustnode = true;
    if (n.info.in) {
      for (let i = n.info.in.size - 1; i >= 0; i--) {
        const e = n.info.in.list[i];
        if (!par.nodes.has(e.tail.name)) zapinlist(n.info.in, e);
      }
    }
    if (n.info.out) {
      for (let i = n.info.out.size - 1; i >= 0; i--) {
        const e = n.info.out.list[i];
        if (!par.nodes.has(e.head.name)) zapinlist(n.info.out, e);
      }
    }
  }
  induceClusterEdges(clust);
}

/** @see lib/dotgen/rank.c:dot_scan_ranks */
export function dotScanRanks(g: Graph): void {
  // C computes the ACTUAL min/max node rank (and the min-rank node as leader);
  // a prior port hardcoded minrank=0, which made concentrate's rebuild_vlists
  // walk ranks the cluster doesn't span → a null rank leader → crash on cluster
  // graphs. @see lib/dotgen/rank.c:dot_scan_ranks
  let leader: Node | undefined;
  let leaderRank = 0;
  let minrank = Number.MAX_SAFE_INTEGER;
  let maxrank = -1;
  for (const n of g.nodes.values()) {
    const r = n.info.rank ?? 0;
    if (r > maxrank) maxrank = r;
    if (r < minrank) minrank = r;
    if (leader === undefined || r < leaderRank) { leader = n; leaderRank = r; }
  }
  g.info.minrank = minrank;
  g.info.maxrank = maxrank;
  g.info.leader = leader;
}

export function clusterLeaderScan(g: Graph): [Node | undefined, number] {
  let leader: Node | undefined;
  let maxrank = 0;
  for (let n: Node | undefined = g.info.nlist; n; n = n.info.next) {
    const r = n.info.rank ?? 0;
    if (r === 0 && (n.info.node_type ?? 0) === 0) leader = n;
    if (maxrank < r) maxrank = r;
  }
  return [leader, maxrank];
}

/** @see lib/dotgen/rank.c:cluster_leader */
export function clusterLeader(clust: Graph): void {
  const [leader] = clusterLeaderScan(clust);
  if (!leader) return;
  clust.info.leader = leader;
  for (const n of clust.nodes.values()) {
    ufUnion(n, leader);
    n.info.ranktype = CLUSTER;
  }
}

// ---------------------------------------------------------------------------
// collapseCluster / collapseSets / findClusters
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:collapse_cluster */
export function collapseCluster(g: Graph, subg: Graph): void {
  if (subg.info.parent) return;
  subg.info.parent = g;
  nodeInduce(g, subg);
  if (subg.nodes.size === 0) return;
  makeNewCluster(g, subg);
  if (clType === LOCAL) { dot1Rank(subg); clusterLeader(subg); }
  else dotScanRanks(subg);
}

/** @see lib/dotgen/rank.c:collapse_sets */
export function collapseSets(rg: Graph, g: Graph): void {
  for (const subg of g.subgraphs.values()) {
    const c = rankSetClass(subg);
    if (c !== 0) {
      if (c === CLUSTER && clType === LOCAL) collapseCluster(rg, subg);
      else collapseRankset(rg, subg, c);
    } else {
      collapseSets(rg, subg);
    }
  }
}

/** @see lib/dotgen/rank.c:find_clusters */
export function findClusters(g: Graph): void {
  const root = g.root;
  for (const subg of root.subgraphs.values()) {
    if ((subg.info.set_type ?? 0) === CLUSTER) collapseCluster(g, subg);
  }
}

// ---------------------------------------------------------------------------
// Graph/node accessor helpers (each extracts one ?? or ?. operator so that
// the functions below stay within CCN ≤ 10)
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:set_minmax */
export function gLeaderRank(g: Graph): number { return g.info.leader?.info.rank ?? 0; }
export function gMinrankVal(g: Graph): number { return g.info.minrank ?? 0; }
export function gMaxrankVal(g: Graph): number { return g.info.maxrank ?? 0; }
export function gNCluster(g: Graph): number { return g.info.n_cluster ?? 0; }
export function gClust(g: Graph): Graph[] { return g.info.clust ?? []; }

/** Used by expandNode and setMinMax2 in rank-dot2.ts */
export function nRank(n: Node): number { return n.info.rank ?? 0; }
export function nRanktype(n: Node): number { return n.info.ranktype ?? 0; }
export function gMaxrankDef(g: Graph): number { return g.info.maxrank ?? -1; }
export function gMinrankDef(g: Graph): number { return g.info.minrank ?? Number.MAX_SAFE_INTEGER; }

// ---------------------------------------------------------------------------
// setMinmax / minmaxEdges / minmaxEdges2
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:set_minmax */
export function setMinmax(g: Graph): void {
  const lr = gLeaderRank(g);
  g.info.minrank = gMinrankVal(g) + lr;
  g.info.maxrank = gMaxrankVal(g) + lr;
  const cl = gClust(g); const nc = gNCluster(g);
  for (let c = 1; c <= nc; c++) setMinmax(cl[c - 1]);
}

export function minmaxEdgesReverse(n: Node, isOut: boolean): number {
  const rt = n.info.ranktype ?? 0;
  const flag = isOut ? rt === SINKRANK : rt === SOURCERANK;
  const list = isOut ? n.info.out : n.info.in;
  if (list) {
    while (list.size > 0) reverseEdge(list.list[0]);
  }
  return flag ? 1 : 0;
}

/** @see lib/dotgen/rank.c:minmax_edges — returns [slenX, slenY] */
export function minmaxEdges(g: Graph): [number, number] {
  if (!g.info.maxset && !g.info.minset) return [0, 0];
  if (g.info.minset) g.info.minset = ufFind(g.info.minset);
  if (g.info.maxset) g.info.maxset = ufFind(g.info.maxset);
  const slenY = g.info.maxset ? minmaxEdgesReverse(g.info.maxset, true) : 0;
  const slenX = g.info.minset ? minmaxEdgesReverse(g.info.minset, false) : 0;
  return [slenX, slenY];
}

// Helpers for minmaxEdges2: each extracts one ?. or ?? from the hot path.
export function nOutEdge0(n: Node): Edge | undefined { return n.info.out?.list[0]; }
export function nInEdge0(n: Node): Edge | undefined { return n.info.in?.list[0]; }

export function mmEdges2CheckMax(g: Graph, n: Node, slen1: number): boolean {
  const out = n.info.out;
  if ((!out || out.size === 0) && g.info.maxset && n !== g.info.maxset) {
    const ref = nOutEdge0(n) ?? nInEdge0(n)!;
    const e = virtualEdge(n, g.info.maxset, ref);
    e.info.minlen = slen1; e.info.weight = 0; return true;
  }
  return false;
}

export function mmEdges2CheckMin(g: Graph, n: Node, slen0: number): boolean {
  const inp = n.info.in;
  if ((!inp || inp.size === 0) && g.info.minset && n !== g.info.minset) {
    const ref = nInEdge0(n) ?? nOutEdge0(n)!;
    const e = virtualEdge(g.info.minset, n, ref);
    e.info.minlen = slen0; e.info.weight = 0; return true;
  }
  return false;
}

/** @see lib/dotgen/rank.c:minmax_edges2 */
export function minmaxEdges2(g: Graph, slen: [number, number]): boolean {
  if (!g.info.maxset && !g.info.minset) return false;
  let added = false;
  for (const n of g.nodes.values()) {
    if (n !== ufFind(n)) continue;
    if (mmEdges2CheckMax(g, n, slen[1])) added = true;
    if (mmEdges2CheckMin(g, n, slen[0])) added = true;
  }
  return added;
}

// ---------------------------------------------------------------------------
// rank1 / expandRanksets / dot1Rank / dotRank
// ---------------------------------------------------------------------------

/** @see lib/dotgen/rank.c:rank1 */
export function rank1(g: Graph): void {
  const nslimit1 = g.attrs.get('nslimit1');
  const maxiter = nslimit1
    ? scaleClamp(g.nodes.size, parseFloat(nslimit1))
    : Number.MAX_SAFE_INTEGER;
  const comp = g.info.comp ?? [];
  const hasClusters = (g.info.n_cluster ?? 0) > 0;
  for (let c = 0; c < comp.length; c++) {
    g.info.nlist = comp[c];
    rank(g, hasClusters ? 0 : 1, maxiter);
  }
}

/** @see lib/dotgen/rank.c:expand_ranksets (inner loop helper) */
export function expandNode(g: Graph, n: Node): void {
  const leader = ufFind(n);
  if (leader !== n) n.info.rank = nRank(n) + nRank(leader);
  if (gMaxrankDef(g) < nRank(n)) g.info.maxrank = n.info.rank;
  if (gMinrankDef(g) > nRank(n)) g.info.minrank = n.info.rank;
  if (nRanktype(n) !== 0 && nRanktype(n) !== LEAFSET) ufSingleton(n);
}

export function expandRankPostprocess(g: Graph): void {
  if (clType === LOCAL) {
    const cl = gClust(g);
    for (let c = 1; c <= gNCluster(g); c++) setMinmax(cl[c - 1]);
  } else {
    findClusters(g);
  }
}

/** @see lib/dotgen/rank.c:expand_ranksets */
export function expandRanksets(g: Graph): void {
  const first = g.nodes.values().next().value as Node | undefined;
  if (!first) { g.info.minrank = 0; g.info.maxrank = 0; return; }
  g.info.minrank = Number.MAX_SAFE_INTEGER;
  g.info.maxrank = -1;
  for (const n of g.nodes.values()) expandNode(g, n);
  if (g === g.root) expandRankPostprocess(g);
}

/** @see lib/dotgen/rank.c:dot1_rank */
export function dot1Rank(g: Graph): void {
  edgelabelRanks(g);
  collapseSets(g, g);
  class1(g);
  const slen = minmaxEdges(g);
  decompose(g, 0);
  acyclic(g);
  if (minmaxEdges2(g, slen)) decompose(g, 0);
  rank1(g);
  expandRanksets(g);
  cleanup1(g);
}

/**
 * Assign integer ranks to all nodes in g.
 * Dispatches to dot1Rank or dot2Rank based on GD_flags & NEW_RANK.
 * @see lib/dotgen/rank.c:dot_rank
 */
export function dotRank(g: Graph): void {
  if (mapbool(g.attrs.get('newrank'))) {
    g.info.flags = (g.info.flags ?? 0) | NEW_RANK;
    dot2Rank(g);
  } else {
    dot1Rank(g);
  }
}
