// SPDX-License-Identifier: EPL-2.0

/**
 * Crossing computation for the mincross algorithm: left2right constraint
 * checks, in/out crossing counts, exchange, transpose, local_cross, rcross,
 * and ncross.
 *
 * @see lib/dotgen/mincross.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { EdgeList } from '../../model/nodeInfo.js';
import type { RankEntry } from '../../model/rankEntry.js';
import { MC_SCALE, VIRTUAL } from './fastgr.js';
import { CLUSTER } from './rank.js';
import {
  MincrossContext, matrixGet, rankGet,
} from './mincross-utils.js';

/**
 * Mirror of C's file-global `ReMincross`. Set true only during the remincross
 * pass so left2right tightens the cluster constraint. @see mincross.c
 */
let reMincross = false;
export function setReMincross(b: boolean): void { reMincross = b; }

// ---------------------------------------------------------------------------
// VAL macro / xpenalty helpers
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:VAL */
export function val(node: Node, portOrder: number): number {
  const ord = node.info.order !== undefined ? node.info.order : 0;
  return MC_SCALE * ord + portOrder;
}

/** Edge xpenalty with default 1. @see lib/dotgen/mincross.c */
export function xpen(e: Edge): number {
  return e.info.xpenalty !== undefined ? e.info.xpenalty : 1;
}

/** Signed crossing contribution. @see lib/dotgen/mincross.c:in_cross/out_cross */
export function crossContrib(aVal: number, aPen: number, bVal: number, bPen: number): number {
  if (aVal > bVal) return aPen * bPen;
  if (aVal < bVal) return -(aPen * bPen);
  return 0;
}

// ---------------------------------------------------------------------------
// left2right helpers
// ---------------------------------------------------------------------------

/** Skeleton cluster vnodes may still be swapped. @see mincross.c:left2right */
function isClusterSkeletonVnode(n: Node): boolean {
  return n.info.ranktype === CLUSTER && n.info.node_type === VIRTUAL;
}

/**
 * Cluster ordering constraint, the guard portion of C's left2right.
 * Non-remincross: only pairs whose nodes are BOTH in (different) clusters are
 * forced; a cluster skeleton vnode on either side releases the pair. Remincross:
 * any cross-cluster pair is forced. Returns 1 = forced (block swap), 0 = defer
 * to the flat-adjacency matrix. @see lib/dotgen/mincross.c:left2right
 */
export function left2rightCluster(v: Node, w: Node): number {
  const vc = v.info.clust;
  const wc = w.info.clust;
  if (!reMincross) {
    if (vc !== wc && vc && wc) {
      if (isClusterSkeletonVnode(v) || isClusterSkeletonVnode(w)) return 0;
      return 1;
    }
  } else if (vc !== wc) {
    return 1;
  }
  return 0;
}

/** @see lib/dotgen/mincross.c:left2right */
export function left2right(g: Graph, v: Node, w: Node): number {
  if (left2rightCluster(v, w) !== 0) return 1;
  const r = v.info.rank !== undefined ? v.info.rank : 0;
  const gRank = g.info.rank;
  if (!gRank) return 0;
  const rk = gRank[r];
  const flat = rk.flat;
  if (!flat) return 0;
  // C indexes the flat matrix by flatindex(v) = ND_low(v) (mincross.c:115,578),
  // and the matrix is BUILT by `low` (mincross-flat.ts matrixSet hLow/vLow,
  // mirroring matrix_set(M, flatindex…) at mincross.c:1090/1097). Read must match
  // build: use `low`, not `order - vStart`. The two coincide only immediately
  // after flatBreakcycles assigns low=window-index; once a reorder pass changes
  // `order`, `order - vStart` drifts off `low` and the lookup misses (b58 pass-1).
  //
  // C reads exactly ONE matrix cell — matrix_get(flatindex(v), flatindex(w)) —
  // with v,w pre-swapped iff GD_flip(g) (mincross.c:575-578, returns bool). The
  // direction is GD_flip-gated, NOT both-directions: a flat edge in the OPPOSITE
  // direction must read as 0 (no constraint), else reorder/transpose wrongly treat
  // the pair as `muststay`. (graphs-shells: with flat edge rc->KornShell,
  // left2right(KornShell,rc) must be 0 like C — a prior both-direction read
  // returned -1, blocking a reorder swap and shifting the captured best order.)
  const vLow = v.info.low !== undefined ? v.info.low : 0;
  const wLow = w.info.low !== undefined ? w.info.low : 0;
  const flip = g.info.flip ?? false;
  return matrixGet(flat, flip ? wLow : vLow, flip ? vLow : wLow) ? 1 : 0;
}

// ---------------------------------------------------------------------------
// in_cross / out_cross
// ---------------------------------------------------------------------------

/** `ND_order` of the edge's head (out-edges) or tail (in-edges) endpoint.
 *  @see lib/dotgen/mincross.c:589,607 (ND_order(aghead/agtail)) */
function endOrder(e: Edge, head: boolean): number {
  const n = head ? e.head : e.tail;
  return n.info.order ?? 0;
}

/** Geometric port x of the edge's head (out) or tail (in) port — the C
 *  tiebreak metric. @see lib/dotgen/mincross.c:593,611 (ED_*_port.p.x) */
function endPx(e: Edge, head: boolean): number {
  return head ? e.info.head_port.p.x : e.info.tail_port.p.x;
}

/** Cross direction for an edge pair, mirroring C `in_cross`/`out_cross`: order
 *  successor `ND_order`, breaking an equal-order tie by port `p.x`. Returns +1
 *  (e crosses before f → c0), −1 (f before e → c1), or 0 (tie → no signal).
 *  @see lib/dotgen/mincross.c:592-594,610-612 */
function crossDir(eOrd: number, ePx: number, fOrd: number, fPx: number): number {
  if (eOrd > fOrd || (eOrd === fOrd && ePx > fPx)) return 1;
  if (eOrd < fOrd || (eOrd === fOrd && ePx < fPx)) return -1;
  return 0;
}

/** Accumulate crossings of v's vs w's edge lists into c=[c0,c1]: c0 counts pairs
 *  that cross with v before w, c1 with w before v. `head` selects the head
 *  (out-edges) or tail (in-edges) endpoint. Ties order by `ND_order` first, then
 *  the geometric port `p.x` (NOT the angular `port.order` — that is C's VAL macro
 *  for build_ranks, a different construct). Allocation-free — this is the
 *  mincross inner loop. @see lib/dotgen/mincross.c:in_cross, out_cross */
function accumCross(vl: EdgeList | undefined, wl: EdgeList | undefined, head: boolean, c: [number, number]): void {
  if (!vl || !wl) return;
  for (let i = 0; i < vl.size; i++) {
    const e: Edge = vl.list[i];
    const eOrd = endOrder(e, head);
    const ePx = endPx(e, head);
    const ep = xpen(e);
    for (let j = 0; j < wl.size; j++) {
      const f: Edge = wl.list[j];
      const d = crossDir(eOrd, ePx, endOrder(f, head), endPx(f, head));
      if (d > 0) c[0] += ep * xpen(f);
      else if (d < 0) c[1] += ep * xpen(f);
    }
  }
}

/**
 * Crossing counts for the pair (v, w): [c0 = crossings with v before w (the
 * current order), c1 = crossings with w before v (swapped)]. Mirrors
 * in_cross(v,w)+out_cross(v,w) and in_cross(w,v)+out_cross(w,v) in one pass.
 *
 * `useIn`/`useOut` mirror C transpose_step's gates (mincross.c:646-652):
 * in-crossings are added only when r > 0, out-crossings only when the next
 * rank has n > 0. For clusters, allocate_ranks callocs maxrank+2 rank slots
 * (mincross.c:1163), so the slot past a cluster's maxrank has n == 0 and C
 * reads that calloc'd n as a gate — it ignores out-crossings at the
 * cluster's bottom rank. Callers must reproduce both gates; this function no
 * longer accumulates unconditionally.
 * @see lib/dotgen/mincross.c:in_cross, out_cross, transpose_step:646-652
 */
export function transposeCounts(v: Node, w: Node, useIn: boolean, useOut: boolean): [number, number] {
  const c: [number, number] = [0, 0];
  if (useIn) accumCross(v.info.in, w.info.in, false, c);
  if (useOut) accumCross(v.info.out, w.info.out, true, c);
  return c;
}

// ---------------------------------------------------------------------------
// exchange
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:exchange */
export function exchange(ctx: MincrossContext, v: Node, w: Node): void {
  const r = v.info.rank !== undefined ? v.info.rank : 0;
  const rootRank = ctx.root.info.rank;
  if (!rootRank) return;
  const vOrd = v.info.order !== undefined ? v.info.order : 0;
  const wOrd = w.info.order !== undefined ? w.info.order : 0;
  rootRank[r].v[vOrd] = w;
  rootRank[r].v[wOrd] = v;
  v.info.order = wOrd;
  w.info.order = vOrd;
}

// ---------------------------------------------------------------------------
// transpose_step / transpose
// ---------------------------------------------------------------------------

/** C transpose_step swap test: strict improvement, or a reverse tie when there
 *  are crossings to redistribute. @see lib/dotgen/mincross.c:transpose_step */
export function shouldSwap(c0: number, c1: number, reverse: boolean): boolean {
  return c1 < c0 || (c0 > 0 && reverse && c1 === c0);
}

/** Invalidate the ncross cache for the root ranks r, r±1 (C invalidates
 *  GD_rank(Root), not g, on a transpose swap). @see mincross.c:657-665 */
function invalidateValid(rootRank: RankEntry[] | undefined, r: number, mn: number, mx: number): void {
  if (!rootRank) return;
  rootRank[r]!.valid = false;
  if (r > mn) rootRank[r - 1]!.valid = false;
  if (r < mx) rootRank[r + 1]!.valid = false;
}

/** [minrank, maxrank] with 0 defaults. */
function rankBounds(g: Graph): [number, number] {
  return [g.info.minrank ?? 0, g.info.maxrank ?? 0];
}

/** Mark rank r and its neighbours as candidates for re-examination. */
function markCandidates(rank: RankEntry[], r: number, mn: number, mx: number): void {
  rank[r]!.candidate = true;
  if (r > mn) rank[r - 1]!.candidate = true;
  if (r < mx) rank[r + 1]!.candidate = true;
}

/** Returns the total crossing reduction over rank r and marks r and its
 *  neighbours as candidates. @see lib/dotgen/mincross.c:transpose_step */
export function transposeStep(ctx: MincrossContext, g: Graph, r: number, reverse: boolean): number {
  const rank = g.info.rank;
  if (!rank) return 0;
  const rk = rank[r]!;
  const [mn, mx] = rankBounds(g);
  rk.candidate = false;
  let rv = 0;
  for (let i = 0; i < rk.n - 1; i++) {
    const v = rankGet(rk, i);
    const w = rankGet(rk, i + 1);
    if (!v || !w || left2right(g, v, w) !== 0) continue;
    // Gate per C transpose_step (mincross.c:646-652): in-crossings only
    // when r > 0; out-crossings only when the next rank's calloc'd n > 0
    // (the over-allocated maxrank+2 slot for clusters reads n == 0 past
    // the cluster's bottom rank, so C ignores out-crossings there).
    const useIn = r > 0;
    const useOut = (rank[r + 1]?.n ?? 0) > 0;
    const [c0, c1] = transposeCounts(v, w, useIn, useOut);
    if (shouldSwap(c0, c1, reverse)) {
      exchange(ctx, v, w);
      rv += c0 - c1;
      markCandidates(rank, r, mn, mx);
      invalidateValid(ctx.root.info.rank, r, mn, mx);
    }
  }
  return rv;
}

/** Set every rank's candidate flag (start-of-transpose). */
function initCandidates(rank: RankEntry[], mn: number, mx: number): void {
  for (let r = mn; r <= mx; r++) if (rank[r]) rank[r]!.candidate = true;
}

/**
 * Repeatedly transpose adjacent nodes within each rank to remove crossings,
 * re-examining only candidate ranks until no rank improves (delta < 1).
 * @see lib/dotgen/mincross.c:transpose
 */
export function transpose(ctx: MincrossContext, g: Graph, reverse: boolean): void {
  const rank = g.info.rank;
  if (!rank) return;
  const [mn, mx] = rankBounds(g);
  initCandidates(rank, mn, mx);
  let delta: number;
  do {
    delta = 0;
    for (let r = mn; r <= mx; r++) {
      if (rank[r]?.candidate) delta += transposeStep(ctx, g, r, reverse);
    }
  } while (delta >= 1);
}

// ---------------------------------------------------------------------------
// local_cross helpers (port-level crossing check)
// ---------------------------------------------------------------------------

/** Crossing contribution for one out/in edge pair. @see lib/dotgen/mincross.c:local_cross */
export function localCrossEdgePair(e: Edge, f: Edge, isOut: boolean): number {
  if (isOut) {
    const eOrd = e.head.info.order !== undefined ? e.head.info.order : 0;
    const fOrd = f.head.info.order !== undefined ? f.head.info.order : 0;
    if ((fOrd - eOrd) * (f.info.tail_port.p.x - e.info.tail_port.p.x) < 0)
      return xpen(e) * xpen(f);
    return 0;
  }
  const eOrd = e.tail.info.order !== undefined ? e.tail.info.order : 0;
  const fOrd = f.tail.info.order !== undefined ? f.tail.info.order : 0;
  if ((fOrd - eOrd) * (f.info.head_port.p.x - e.info.head_port.p.x) < 0)
    return xpen(e) * xpen(f);
  return 0;
}

/** Port-level crossings for one node's edge list. @see lib/dotgen/mincross.c:local_cross */
export function localCrossEdges(edges: EdgeList, dir: number): number {
  const isOut = dir > 0;
  let cross = 0;
  for (let i = 0; i < edges.size; i++) {
    const e: Edge = edges.list[i];
    for (let j = i + 1; j < edges.size; j++) {
      cross += localCrossEdgePair(e, edges.list[j] as Edge, isOut);
    }
  }
  return cross;
}

// ---------------------------------------------------------------------------
// rcross helpers
// ---------------------------------------------------------------------------

/** Count crossings for one node's out-edges vs Count array. `vs` is the head
 *  rank's window offset. ND_order is stored ABSOLUTE (vStart + index) in this
 *  port, but C indexes Count by the window-RELATIVE order, and Count is sized to
 *  the component's rank count. Subtract vs so a component c>0 indexes within the
 *  Count array; without it, Count[inv] is undefined → NaN → ncross breaks.
 *  @see lib/dotgen/mincross.c:rcross */
export function rcrossCount(out: EdgeList, Count: number[], max: number, vs: number): number {
  let cross = 0;
  for (let i = 0; i < out.size; i++) {
    const e: Edge = out.list[i];
    const headOrd = (e.head.info.order !== undefined ? e.head.info.order : 0) - vs;
    for (let k = headOrd + 1; k <= max; k++) cross += Count[k] * xpen(e);
  }
  return cross;
}

/** Register one node's out-edges in Count; return updated max. `vs`: head rank
 *  window offset (see rcrossCount). @see lib/dotgen/mincross.c:rcross */
export function rcrossRegister(out: EdgeList, Count: number[], max: number, vs: number): number {
  for (let i = 0; i < out.size; i++) {
    const e: Edge = out.list[i];
    const inv = (e.head.info.order !== undefined ? e.head.info.order : 0) - vs;
    if (inv > max) max = inv;
    Count[inv] += xpen(e);
  }
  return max;
}

/** Port crossings for nodes with ports in a single rank. @see lib/dotgen/mincross.c:rcross */
export function rcrossLocal(rk: RankEntry, dir: number): number {
  let cross = 0;
  for (let i = 0; i < rk.n; i++) {
    const v = rankGet(rk, i);
    if (!v || !v.info.has_port) continue;
    const edges = dir > 0 ? v.info.out : v.info.in;
    if (edges) cross += localCrossEdges(edges, dir);
  }
  return cross;
}

// ---------------------------------------------------------------------------
// rcross / ncross
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:rcross */
export function rcross(ctx: MincrossContext, g: Graph, r: number): number {
  const gRank = g.info.rank;
  if (!gRank) return 0;
  const rootRank = ctx.root.info.rank;
  if (!rootRank) return 0;
  const nextRk = rootRank[r + 1];
  const nextN = nextRk !== undefined ? nextRk.n : 0;
  const Count = new Array<number>(nextN + 1).fill(0);
  const rk = gRank[r];
  // Head nodes live in rank r+1's window; ND_order is absolute, so map to the
  // window-relative Count index by subtracting that window's vStart.
  const headVs = gRank[r + 1] !== undefined ? (gRank[r + 1].vStart ?? 0) : 0;
  let cross = 0;
  let max = 0;
  for (let top = 0; top < rk.n; top++) {
    const v = rankGet(rk, top);
    if (!v || !v.info.out) continue;
    if (max > 0) cross += rcrossCount(v.info.out, Count, max, headVs);
    max = rcrossRegister(v.info.out, Count, max, headVs);
  }
  cross += rcrossLocal(rk, 1);
  const nextRkG = gRank[r + 1];
  if (nextRkG) cross += rcrossLocal(nextRkG, -1);
  return cross;
}

/** @see lib/dotgen/mincross.c:ncross */
export function ncross(ctx: MincrossContext): number {
  const mn = ctx.globalMinRank;
  const mx = ctx.globalMaxRank;
  const rootRank = ctx.root.info.rank;
  if (!rootRank) return 0;
  let total = 0;
  for (let r = mn; r < mx; r++) {
    const rk = rootRank[r];
    if (rk.valid) {
      total += rk.cache_nc;
    } else {
      const nc = rcross(ctx, ctx.root, r);
      rk.cache_nc = nc;
      rk.valid = true;
      total += nc;
    }
  }
  return total;
}
