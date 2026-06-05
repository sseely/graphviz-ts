// SPDX-License-Identifier: EPL-2.0

/**
 * Build-phase helpers for the mincross algorithm: flat-edge cycle breaking,
 * flat reorder, rank allocation and filling, BFS rank installation, and
 * edge-ordering setup.
 * @see lib/dotgen/mincross.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { RankEntry } from '../../model/rankEntry.js';
import {
  FLATORDER, REVERSED,
  newVirtualEdge, mergeOneway, elistAppend,
  deleteFlatEdge, flatEdge, findFlatEdge,
} from './fastgr.js';
import {
  MincrossContext, matrixSet, newMatrix,
  dotRoot, agContainsNode, insideCluster,
} from './mincross-utils.js';
import { transpose, ncross } from './mincross-cross.js';
import { CLUSTER, isACluster } from './rank.js';
import { installCluster, expandCluster, markLowclusters } from './cluster.js';

// betweenclust — @see lib/dotgen/mincross.c:betweenclust
export function betweenclust(e: Edge): boolean {
  let cur: Edge = e;
  while (cur.info.to_orig !== undefined) cur = cur.info.to_orig;
  return cur.tail.info.clust !== cur.head.info.clust;
}

// flat_rev — @see lib/dotgen/mincross.c:flat_rev
export function flatRevFindRev(head: Node, tail: Node): Edge | undefined {
  const fo = head.info.flat_out;
  if (!fo) return undefined;
  for (let j = 0; j < fo.size; j++) {
    if (fo.list[j].head === tail) return fo.list[j];
  }
  return undefined;
}

export function flatRev(g: Graph, e: Edge): void {
  const rev = flatRevFindRev(e.head, e.tail);
  if (rev !== undefined) {
    mergeOneway(e, rev);
    if (rev.info.edge_type === FLATORDER && rev.info.to_orig === undefined) rev.info.to_orig = e;
    if (!e.tail.info.other) e.tail.info.other = { list: [], size: 0 };
    elistAppend(e.tail.info.other, e);
  } else {
    const r = newVirtualEdge(e.head, e.tail, e);
    r.info.edge_type = e.info.edge_type === FLATORDER ? FLATORDER : REVERSED;
    r.info.label = e.info.label;
    flatEdge(g, r);
  }
}

// flat_search — @see lib/dotgen/mincross.c:flat_search
export function flatSearchOstack(g: Graph, v: Node, e: Edge, M: RankEntry['flat']): boolean {
  const vLow = v.info.low !== undefined ? v.info.low : 0;
  const hLow = e.head.info.low !== undefined ? e.head.info.low : 0;
  matrixSet(M!, hLow, vLow);
  deleteFlatEdge(e);
  if (e.info.edge_type !== FLATORDER) flatRev(g, e);
  return true;
}

export function flatSearchNormal(g: Graph, v: Node, e: Edge, M: RankEntry['flat'], hascl: boolean): void {
  const vLow = v.info.low !== undefined ? v.info.low : 0;
  const hLow = e.head.info.low !== undefined ? e.head.info.low : 0;
  matrixSet(M!, vLow, hLow);
  if (!e.head.info.mark) flatSearch(g, e.head, M, hascl);
}

export function flatSearchEdge(g: Graph, v: Node, e: Edge, M: RankEntry['flat'], hascl: boolean): boolean {
  if (!M) return false;
  if (hascl && !(agContainsNode(g, e.tail) && agContainsNode(g, e.head))) return false;
  if ((e.info.weight !== undefined ? e.info.weight : 0) === 0) return false;
  if (e.head.info.onstack) return flatSearchOstack(g, v, e, M);
  flatSearchNormal(g, v, e, M, hascl);
  return false;
}

export function flatSearch(g: Graph, v: Node, M: RankEntry['flat'], hascl: boolean): void {
  v.info.mark = 1;
  v.info.onstack = 1;
  const fo = v.info.flat_out;
  if (fo) {
    let i = 0;
    while (i < fo.size) {
      const deleted = flatSearchEdge(g, v, fo.list[i], M, hascl);
      if (!deleted) i++;
    }
  }
  v.info.onstack = 0;
}

// flat_breakcycles — @see lib/dotgen/mincross.c:flat_breakcycles
export function flatBreakcyclesRank(g: Graph, rk: RankEntry, hascl: boolean): void {
  let hasFlat = false;
  for (let i = 0; i < rk.n; i++) {
    const v = rk.v[i];
    v.info.mark = 0;
    v.info.onstack = 0;
    v.info.low = i;
    if ((v.info.flat_out !== undefined ? v.info.flat_out.size : 0) > 0 && !hasFlat) {
      rk.flat = newMatrix(rk.n, rk.n);
      hasFlat = true;
    }
  }
  if (hasFlat && rk.flat) {
    for (let i = 0; i < rk.n; i++) {
      if (!rk.v[i].info.mark) flatSearch(g, rk.v[i], rk.flat, hascl);
    }
  }
}

export function flatBreakcycles(_ctx: MincrossContext, g: Graph): void {
  const rank = g.info.rank;
  if (!rank) return;
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  const root = dotRoot(g);
  const nc = root.info.n_cluster !== undefined ? root.info.n_cluster : 0;
  const hascl = nc > 0;
  for (let r = mn; r <= mx; r++) flatBreakcyclesRank(g, rank[r], hascl);
}

// constrainingFlatEdge / postorder — @see lib/dotgen/mincross.c
export function constrainingFlatEdge(g: Graph, e: Edge): boolean {
  if ((e.info.weight !== undefined ? e.info.weight : 0) === 0) return false;
  if (!insideCluster(g, e.tail)) return false;
  if (!insideCluster(g, e.head)) return false;
  return true;
}

export function countConstraining(g: Graph, edges: import('../../model/nodeInfo.js').EdgeList): number {
  let cnt = 0;
  for (let j = 0; j < edges.size; j++) {
    if (constrainingFlatEdge(g, edges.list[j])) cnt++;
  }
  return cnt;
}

export function postorder(g: Graph, v: Node, list: Node[], r: number): void {
  v.info.mark = 1;
  const fo = v.info.flat_out;
  if (fo !== undefined && fo.size > 0) {
    for (let i = 0; i < fo.size; i++) {
      const e = fo.list[i];
      if (!constrainingFlatEdge(g, e)) continue;
      if (!e.head.info.mark) postorder(g, e.head, list, r);
    }
  }
  list.push(v);
}

// flat_reorder — @see lib/dotgen/mincross.c:flat_reorder
export function flatReorderBuildTemprank(g: Graph, rk: RankEntry, temprank: Node[], flip: boolean): void {
  for (let i = 0; i < rk.n; i++) {
    const v = flip ? rk.v[i] : rk.v[rk.n - i - 1];
    const inCnt = v.info.flat_in !== undefined ? countConstraining(g, v.info.flat_in) : 0;
    const outCnt = v.info.flat_out !== undefined ? countConstraining(g, v.info.flat_out) : 0;
    if (inCnt === 0 && outCnt === 0) { temprank.push(v); continue; }
    if (!v.info.mark && inCnt === 0) postorder(g, v, temprank, rk.v[i].info.rank !== undefined ? rk.v[i].info.rank! : 0);
  }
}

export function flatReorderFixEdges(g: Graph, rk: RankEntry, flip: boolean): void {
  for (let i = 0; i < rk.n; i++) {
    const v = rk.v[i];
    const fo = v.info.flat_out;
    if (!fo) continue;
    let j = 0;
    while (j < fo.size) {
      const e = fo.list[j];
      const hOrd = e.head.info.order !== undefined ? e.head.info.order : 0;
      const tOrd = e.tail.info.order !== undefined ? e.tail.info.order : 0;
      const shouldRev = (!flip && hOrd < tOrd) || (flip && hOrd > tOrd);
      if (shouldRev) {
        deleteFlatEdge(e);
        flatRev(g, e);
      } else { j++; }
    }
  }
}

export function flatReorderRank(g: Graph, rk: RankEntry, rootRank: RankEntry[], r: number, flip: boolean): void {
  if (rk.n === 0) return;
  const baseOrder = rk.v[0].info.order !== undefined ? rk.v[0].info.order : 0;
  for (let i = 0; i < rk.n; i++) rk.v[i].info.mark = 0;
  const temprank: Node[] = [];
  flatReorderBuildTemprank(g, rk, temprank, flip);
  if (temprank.length > 0) {
    if (!flip) temprank.reverse();
    for (let i = 0; i < rk.n; i++) {
      rk.v[i] = temprank[i];
      rk.v[i].info.order = i + baseOrder;
    }
    flatReorderFixEdges(g, rk, flip);
  }
  rootRank[r].valid = false;
}

export function flatReorder(_ctx: MincrossContext, g: Graph): void {
  if (!g.info.has_flat_edges) return;
  const rank = g.info.rank;
  if (!rank) return;
  const rootRank = dotRoot(g).info.rank;
  if (!rootRank) return;
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  const flip = g.info.flip === true;
  for (let r = mn; r <= mx; r++) flatReorderRank(g, rank[r], rootRank, r, flip);
}

// allocate_ranks — @see lib/dotgen/mincross.c:allocate_ranks
export function makeEmptyRank(): RankEntry {
  return { n: 0, v: [], an: 0, av: [], ht1: 0, ht2: 0, pht1: 0, pht2: 0, candidate: false, valid: false, cache_nc: 0 };
}

export function allocateRanksCount(g: Graph, cn: number[]): void {
  for (const n of g.nodes.values()) {
    const r = n.info.rank !== undefined ? n.info.rank : 0;
    cn[r]++;
    const out = n.info.out;
    if (!out) continue;
    for (let ei = 0; ei < out.size; ei++) {
      const e = out.list[ei];
      let lo = e.tail.info.rank !== undefined ? e.tail.info.rank : 0;
      let hi = e.head.info.rank !== undefined ? e.head.info.rank : 0;
      if (lo > hi) { const tmp = lo; lo = hi; hi = tmp; }
      for (let r2 = lo + 1; r2 < hi; r2++) cn[r2]++;
    }
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

// fillRanks — stub, T35
export function fillRanks(_g: Graph): void {
  /* TODO T35: port lib/dotgen/mincross.c:fillRanks + realFillRanks */
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
    const last = rk.n - 1;
    for (let j = 0; j <= last >> 1; j++) {
      const tmp = rk.v[j]; rk.v[j] = rk.v[last - j]; rk.v[last - j] = tmp;
      rk.v[j].info.order = j; rk.v[last - j].info.order = last - j;
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
