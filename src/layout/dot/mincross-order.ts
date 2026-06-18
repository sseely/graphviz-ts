// SPDX-License-Identifier: EPL-2.0

/**
 * Ordering/median pass and mincross main loop for the mincross algorithm.
 * Build-phase helpers live in mincross-build.ts.
 *
 * @see lib/dotgen/mincross.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { RankEntry } from '../../model/rankEntry.js';
import type { EdgeList } from '../../model/nodeInfo.js';
import { MincrossContext, CONVERGENCE, dotRoot } from './mincross-utils.js';
import { exchange, left2right, transpose, ncross, val, xpen } from './mincross-cross.js';
import { buildRanks, flatBreakcycles, flatReorder } from './mincross-build.js';

type StepBounds = { first: number; last: number; dir: number };
type CrossState = { cur: number; best: number };
type ReorderResult = { rp: number; muststay: boolean };

/**
 * Diagnostic trace hook mirroring C's `if (Verbose) fprintf(...)` in
 * `mincross()`. Default null = no output, no behavior change (the only cost is
 * one null check per iter, matching C's Verbose guard). Set by trajectory-diff
 * harnesses to dump the per-iter crossing trajectory. @see mincross.c:723-727
 */
let mincrossTrace: ((line: string) => void) | null = null;
export function setMincrossTrace(fn: ((line: string) => void) | null): void {
  mincrossTrace = fn;
}

// ---------------------------------------------------------------------------
// flat_mval — @see lib/dotgen/mincross.c:flat_mval
// ---------------------------------------------------------------------------

export function flatMvalIn(n: Node, fi: EdgeList): boolean {
  let nn = fi.list[0]!.tail;
  for (let i = 1; i < fi.size; i++) {
    const edge = fi.list[i]!;
    const ord = edge.tail.info.order !== undefined ? edge.tail.info.order : 0;
    const nnOrd = nn.info.order !== undefined ? nn.info.order : 0;
    if (ord > nnOrd) nn = edge.tail;
  }
  const nnMval = nn.info.mval !== undefined ? nn.info.mval : -1;
  if (nnMval >= 0) { n.info.mval = nnMval + 1; return false; }
  return true;
}

export function flatMvalOut(n: Node, fo: EdgeList): boolean {
  let nn = fo.list[0]!.head;
  for (let i = 1; i < fo.size; i++) {
    const edge = fo.list[i]!;
    const ord = edge.head.info.order !== undefined ? edge.head.info.order : 0;
    const nnOrd = nn.info.order !== undefined ? nn.info.order : 0;
    if (ord < nnOrd) nn = edge.head;
  }
  const nnMval = nn.info.mval !== undefined ? nn.info.mval : -1;
  if (nnMval > 0) { n.info.mval = nnMval - 1; return false; }
  return true;
}

/** @see lib/dotgen/mincross.c:flat_mval */
export function flatMval(n: Node): boolean {
  const fi = n.info.flat_in;
  if (fi !== undefined && fi.size > 0) return flatMvalIn(n, fi);
  const fo = n.info.flat_out;
  if (fo !== undefined && fo.size > 0) return flatMvalOut(n, fo);
  return true;
}

// ---------------------------------------------------------------------------
// medians — @see lib/dotgen/mincross.c:mval / median / medians
// ---------------------------------------------------------------------------

/** Collect val() samples for one node's adjacent edges. @see lib/dotgen/mincross.c:mval */
export function mediansCollectDir(v: Node, d: number, list: number[]): void {
  const vRank = v.info.rank !== undefined ? v.info.rank : 0;
  const edges = d < vRank ? v.info.in : v.info.out;
  if (!edges) return;
  for (let i = edges.size - 1; i >= 0; i--) {
    const e = edges.list[i]!;
    if (xpen(e) <= 0) continue;
    if (d < vRank) {
      list.push(val(e.tail, e.info.tail_port.order));
    } else {
      list.push(val(e.head, e.info.head_port.order));
    }
  }
}

/** @see lib/dotgen/mincross.c:median */
export function computeMedian(list: number[]): number {
  const n = list.length;
  if (n === 0) return -1;
  list.sort((a, b) => a - b);
  if (n === 1) return list[0]!;
  if (n === 2) return (list[0]! + list[1]!) / 2;
  const m = Math.floor(n / 2);
  if (n % 2 !== 0) return list[m]!;
  const left = list[m - 1]! - list[0]!;
  const right = list[n - 1]! - list[m]!;
  return (list[m - 1]! * right + list[m]! * left) / (left + right);
}

export function mediansProcessNode(v: Node, d: number): boolean {
  if (v.info.clust) return true;
  const inSize = v.info.in !== undefined ? v.info.in.size : 0;
  const outSize = v.info.out !== undefined ? v.info.out.size : 0;
  if (inSize === 0 && outSize === 0) return flatMval(v);
  const list: number[] = [];
  mediansCollectDir(v, d, list);
  v.info.mval = computeMedian(list);
  return false;
}

/** @see lib/dotgen/mincross.c:medians */
export function medians(_ctx: MincrossContext, g: Graph, r: number, d: number): boolean {
  const gRank = g.info.rank;
  if (!gRank) return false;
  const rk = gRank[r];
  let hasfixed = false;
  for (let i = 0; i < rk.n; i++) {
    const v = rk.v[i];
    if (!v) continue;
    if (mediansProcessNode(v, d)) hasfixed = true;
  }
  return hasfixed;
}

// ---------------------------------------------------------------------------
// save_best / restore_best — @see lib/dotgen/mincross.c:save_best/restore_best
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:save_best */
export function saveBest(g: Graph): void {
  const rank = g.info.rank;
  if (!rank) return;
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  for (let r = mn; r <= mx; r++) {
    for (let i = 0; i < rank[r].n; i++) {
      const n = rank[r].v[i];
      n.info.coord.x = n.info.order !== undefined ? n.info.order : 0;
    }
  }
}

export function restoreRank(rk: RankEntry, rootRk: RankEntry): void {
  for (let i = 0; i < rk.n; i++) rk.v[i].info.order = rk.v[i].info.coord.x;
  const sorted = rk.v.slice(0, rk.n).sort(
    (a, b) => (a.info.order !== undefined ? a.info.order : 0) - (b.info.order !== undefined ? b.info.order : 0),
  );
  for (let i = 0; i < rk.n; i++) rk.v[i] = sorted[i]!;
  rootRk.valid = false;
}

/** @see lib/dotgen/mincross.c:restore_best */
export function restoreBest(ctx: MincrossContext, g: Graph): void {
  const rank = g.info.rank;
  const rootRank = ctx.root.info.rank;
  if (!rank || !rootRank) return;
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  for (let r = mn; r <= mx; r++) restoreRank(rank[r], rootRank[r]);
}

// ---------------------------------------------------------------------------
// reorder — @see lib/dotgen/mincross.c:reorder
// ---------------------------------------------------------------------------

export function reorderFindLp(vlist: Node[], lp: number, ep: number): number {
  while (lp < ep && (vlist[lp]!.info.mval !== undefined ? vlist[lp]!.info.mval! : -1) < 0) lp++;
  return lp;
}

export function reorderFindRp(g: Graph, vlist: Node[], lp: number, ep: number): ReorderResult {
  let sawclust = false;
  for (let rp = lp + 1; rp < ep; rp++) {
    const w = vlist[rp]!;
    if (sawclust && w.info.clust) continue;
    if (left2right(g, vlist[lp]!, w) !== 0) return { rp, muststay: true };
    if ((w.info.mval !== undefined ? w.info.mval : -1) >= 0) return { rp, muststay: false };
    if (w.info.clust) sawclust = true;
  }
  return { rp: ep, muststay: false };
}

export function reorderInner(ctx: MincrossContext, g: Graph, vlist: Node[], ep: number, reverse: boolean): boolean {
  let changed = false;
  let lp = 0;
  while (lp < ep) {
    lp = reorderFindLp(vlist, lp, ep);
    if (lp >= ep) break;
    const res = reorderFindRp(g, vlist, lp, ep);
    if (res.rp >= ep) break;
    if (!res.muststay) {
      const p1 = vlist[lp]!.info.mval !== undefined ? vlist[lp]!.info.mval! : -1;
      const p2 = vlist[res.rp]!.info.mval !== undefined ? vlist[res.rp]!.info.mval! : -1;
      if (p1 > p2 || (p1 >= p2 && reverse)) { exchange(ctx, vlist[lp]!, vlist[res.rp]!); changed = true; }
    }
    lp = res.rp;
  }
  return changed;
}

/** @see lib/dotgen/mincross.c:reorder */
export function reorder(ctx: MincrossContext, g: Graph, r: number, reverse: boolean, hasfixed: boolean): void {
  const rootRank = ctx.root.info.rank;
  if (!rootRank) return;
  const rk = g.info.rank;
  if (!rk) return;
  const vlist = rk[r].v;
  let ep = rk[r].n;
  let changed = false;
  for (let nelt = ep - 1; nelt >= 0; nelt--) {
    if (reorderInner(ctx, g, vlist, ep, reverse)) changed = true;
    if (!hasfixed && !reverse) ep--;
  }
  if (changed) {
    rootRank[r].valid = false;
    if (r > 0) rootRank[r - 1].valid = false;
  }
}

// ---------------------------------------------------------------------------
// mincross_step — @see lib/dotgen/mincross.c:mincross_step
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:mincross_step (bounds computation) */
export function mincrossStepBounds(ctx: MincrossContext, g: Graph, pass: number): StepBounds {
  const mn = g.info.minrank !== undefined ? g.info.minrank : 0;
  const mx = g.info.maxrank !== undefined ? g.info.maxrank : 0;
  const rootMn = ctx.root.info.minrank !== undefined ? ctx.root.info.minrank : 0;
  const rootMx = ctx.root.info.maxrank !== undefined ? ctx.root.info.maxrank : 0;
  if (pass % 2 === 0) {
    const first = mn > rootMn ? mn : mn + 1;
    return { first, last: mx, dir: 1 };
  }
  const first = mx < rootMx ? mx : mx - 1;
  return { first, last: mn, dir: -1 };
}

/** @see lib/dotgen/mincross.c:mincross_step */
export function mincrossStep(ctx: MincrossContext, g: Graph, pass: number): void {
  const reverse = pass % 4 < 2;
  const bounds = mincrossStepBounds(ctx, g, pass);
  for (let r = bounds.first; r !== bounds.last + bounds.dir; r += bounds.dir) {
    const hasfixed = medians(ctx, g, r, r - bounds.dir);
    reorder(ctx, g, r, reverse, hasfixed);
  }
  transpose(ctx, g, !reverse);
}

// ---------------------------------------------------------------------------
// mincross main loop — @see lib/dotgen/mincross.c:mincross
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:mincross (iteration loop) */
export function mincrossIter(ctx: MincrossContext, g: Graph, maxthispass: number, state: CrossState, pass: number): void {
  let trying = 0;
  for (let iter = 0; iter < maxthispass; iter++) {
    if (mincrossTrace) {
      mincrossTrace(`mincross: pass ${pass} iter ${iter} trying ${trying} cur_cross ${state.cur} best_cross ${state.best}`);
    }
    if (trying++ >= ctx.minQuit) break;
    if (state.cur === 0) break;
    mincrossStep(ctx, g, iter);
    state.cur = ncross(ctx);
    if (state.cur <= state.best) {
      saveBest(g);
      if (state.cur < CONVERGENCE * state.best) trying = 0;
      state.best = state.cur;
    }
  }
}

/** @see lib/dotgen/mincross.c:mincross (pass setup) */
export function mincrossPassSetup(ctx: MincrossContext, g: Graph, pass: number, state: CrossState): number {
  if (pass <= 1) {
    const maxthispass = Math.min(4, ctx.maxIter);
    if (g === dotRoot(g) && buildRanks(ctx, g, pass) !== 0) return -1;
    if (pass === 0) flatBreakcycles(ctx, g);
    flatReorder(ctx, g);
    state.cur = ncross(ctx);
    if (state.cur <= state.best) { saveBest(g); state.best = state.cur; }
    return maxthispass;
  }
  const maxthispass = ctx.maxIter;
  if (state.cur > state.best) restoreBest(ctx, g);
  state.cur = state.best;
  return maxthispass;
}

/** @see lib/dotgen/mincross.c:mincross */
export function mincrossMain(ctx: MincrossContext, g: Graph, startpass: number): number {
  const initCross = startpass > 1 ? ncross(ctx) : Number.MAX_SAFE_INTEGER;
  const state: CrossState = { cur: initCross, best: initCross };
  if (startpass > 1) saveBest(g);
  for (let pass = startpass; pass <= 2; pass++) {
    const maxthispass = mincrossPassSetup(ctx, g, pass, state);
    if (maxthispass < 0) return -1;
    mincrossIter(ctx, g, maxthispass, state, pass);
    if (state.cur === 0) break;
  }
  if (state.cur > state.best) restoreBest(ctx, g);
  if (state.best > 0) { transpose(ctx, g, false); state.best = ncross(ctx); }
  return state.best;
}
