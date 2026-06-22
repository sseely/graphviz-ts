// SPDX-License-Identifier: EPL-2.0

/**
 * Flat-edge handling for the mincross algorithm: flat-edge cycle breaking
 * (flat_rev / flat_search / flat_breakcycles) and flat reorder
 * (constraining-edge counting, postorder, flat_reorder).
 * @see lib/dotgen/mincross.c flat-edge handling
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { RankEntry } from '../../model/rankEntry.js';
import {
  FLATORDER, REVERSED,
  newVirtualEdge, mergeOneway, elistAppend,
  deleteFlatEdge, flatEdge,
} from './fastgr.js';
import {
  MincrossContext, matrixSet, newMatrix,
  dotRoot, agContainsNode, insideCluster,
  rankGet, rankSet,
} from './mincross-utils.js';

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
  // Windowed access (rankGet) — for a cluster rank, C's GD_rank(g)[r].v is the
  // parent array offset by the cluster's vStart. ND_low(v)=i is the window index.
  let hasFlat = false;
  for (let i = 0; i < rk.n; i++) {
    const v = rankGet(rk, i);
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
      const v = rankGet(rk, i);
      if (!v.info.mark) flatSearch(g, v, rk.flat, hascl);
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
    const v = flip ? rankGet(rk, i) : rankGet(rk, rk.n - i - 1);
    const inCnt = v.info.flat_in !== undefined ? countConstraining(g, v.info.flat_in) : 0;
    const outCnt = v.info.flat_out !== undefined ? countConstraining(g, v.info.flat_out) : 0;
    if (inCnt === 0 && outCnt === 0) { temprank.push(v); continue; }
    if (!v.info.mark && inCnt === 0) postorder(g, v, temprank, v.info.rank !== undefined ? v.info.rank! : 0);
  }
}

export function flatReorderFixEdges(g: Graph, rk: RankEntry, flip: boolean): void {
  for (let i = 0; i < rk.n; i++) {
    const v = rankGet(rk, i);
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
  // Windowed access (rankGet/rankSet): for a cluster rank, C's GD_rank(g)[r].v
  // is the parent array offset by vStart. Raw rk.v[i] read the wrong nodes and
  // left B/A out of temprank, undercounting it and crashing on undefined.
  const baseOrder = rankGet(rk, 0).info.order !== undefined ? rankGet(rk, 0).info.order! : 0;
  for (let i = 0; i < rk.n; i++) rankGet(rk, i).info.mark = 0;
  const temprank: Node[] = [];
  flatReorderBuildTemprank(g, rk, temprank, flip);
  if (temprank.length > 0) {
    if (!flip) temprank.reverse();
    for (let i = 0; i < rk.n; i++) {
      rankSet(rk, i, temprank[i]!);
      temprank[i]!.info.order = i + baseOrder;
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
