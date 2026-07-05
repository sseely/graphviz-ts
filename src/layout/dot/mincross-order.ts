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
import { MincrossContext, CONVERGENCE, dotRoot, rankGet } from './mincross-utils.js';
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

/**
 * C operates on an int[] (VAL = MC_SCALE*ND_order + port.order), so the n==2
 * average and the equal-span case use INTEGER division (truncation toward
 * zero), not float. Using float here yields x.5 mvals that perturb the reorder
 * sort and diverge from C on tie-heavy ranks (e.g. 2371's flat mid network).
 * The unequal-span weighted median stays a true double, matching C.
 * @see lib/dotgen/mincross.c:median
 */
export function computeMedian(list: number[]): number {
  const n = list.length;
  if (n === 0) return -1;
  list.sort((a, b) => a - b);
  if (n === 1) return list[0]!;
  if (n === 2) return Math.trunc((list[0]! + list[1]!) / 2);
  const m = Math.floor(n / 2);
  if (n % 2 !== 0) return list[m]!;
  const lspan = list[m - 1]! - list[0]!;
  const rspan = list[n - 1]! - list[m]!;
  if (lspan === rspan) return Math.trunc((list[m - 1]! + list[m]!) / 2);
  return (list[m - 1]! * rspan + list[m]! * lspan) / (lspan + rspan);
}

/**
 * Loop 1 body of C `medians` (mincross.c:1627-1667) — computes a fresh mval
 * for a SINGLE node from its directional fast-edge list. An empty list
 * (including nodes with no fast edges in this direction at all — case 0 at
 * mincross.c:1643) resets mval to -1 via computeMedian. This must run for
 * EVERY node in the rank, unconditionally, before flat_mval (loop 2 in
 * `medians` below) reads any node's mval.
 * @see lib/dotgen/mincross.c:1621-1667
 */
export function mediansProcessNode(v: Node, d: number): void {
  const list: number[] = [];
  mediansCollectDir(v, d, list);
  v.info.mval = computeMedian(list);
}

/**
 * @see lib/dotgen/mincross.c:1621
 *
 * Mirrors C's exact two-loop shape. Loop 1 resets/sets mval for EVERY node
 * in the rank (mincross.c:1627-1667). Loop 2 runs flat_mval only for nodes
 * with NO fast edges in either direction (mincross.c:1669-1673), strictly
 * after loop 1 has completed for the whole rank — so flat_mval always
 * observes a freshly-reset mval, never a stale value left over from the
 * opposite pass direction. A fused single-loop version that early-returns
 * into flat_mval for edge-less nodes skips the loop-1 reset for exactly
 * those nodes, leaking stale cross-pass mval into the reorder comparator.
 * @see plans/residual-cleanup/analysis/1453-medians-reset.md
 */
export function medians(_ctx: MincrossContext, g: Graph, r: number, d: number): boolean {
  const gRank = g.info.rank;
  if (!gRank) return false;
  const rk = gRank[r];
  for (let i = 0; i < rk.n; i++) {
    // Faithful to C GD_rank(g)[r].v — the already-offset window pointer.
    // TS keeps rk.v as the full root array + a separate vStart, so we must
    // read rk.v[vStart+i] = rankGet(rk,i). transpose already does this;
    // medians/reorder were ported without it. @see mincross.c:medians
    const v = rankGet(rk, i);
    if (!v) continue;
    mediansProcessNode(v, d);
  }
  let hasfixed = false;
  for (let i = 0; i < rk.n; i++) {
    const v = rankGet(rk, i);
    if (!v) continue;
    const inSize = v.info.in !== undefined ? v.info.in.size : 0;
    const outSize = v.info.out !== undefined ? v.info.out.size : 0;
    if (inSize === 0 && outSize === 0) {
      if (flatMval(v)) hasfixed = true;
    }
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
    const vs = rank[r].vStart ?? 0;
    for (let i = 0; i < rank[r].n; i++) {
      // Read the offset window: C save_best reads GD_rank(g)[r].v[i] where the
      // pointer is already advanced by vStart. @see mincross.c:save_best
      // C's saveorder scratch holds the WINDOW-RELATIVE ND_order (install_in_rank
      // sets ND_order = i within the window); the port's order is absolute
      // (vStart + i), so subtract vStart to store C's exact scratch value. The
      // leftover scratch is load-bearing: a node dropped by merge2's n=an
      // truncation (allocate_ranks undercount, e.g. 2521's b3) keeps this value
      // as its final x-coordinate. @see mincross.c:114 saveorder
      const n = rankGet(rank[r], i);
      n.info.coord.x = (n.info.order !== undefined ? n.info.order : 0) - vs;
    }
  }
}

export function restoreRank(rk: RankEntry, rootRk: RankEntry): void {
  // Restore + re-sort the absolute window [vStart, vStart+n) — C restore_best
  // qsorts GD_rank(g)[r].v (the offset pointer) over n. @see mincross.c:restore_best
  const vs = rk.vStart ?? 0;
  // coord.x scratch holds the window-relative order (see saveBest); convert back.
  for (let i = 0; i < rk.n; i++) rk.v[vs + i].info.order = rk.v[vs + i].info.coord.x + vs;
  const sorted = rk.v.slice(vs, vs + rk.n).sort(
    (a, b) => (a.info.order !== undefined ? a.info.order : 0) - (b.info.order !== undefined ? b.info.order : 0),
  );
  for (let i = 0; i < rk.n; i++) rk.v[vs + i] = sorted[i]!;
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
  // Advance past nodes that cannot be compared, i.e. while (mval ?? -1) < 0.
  // Perf: read node.info.mval once per step (the original ternary read the
  // property chain twice). Behaviour-identical — this is the hottest loop in
  // the port (~1.6e9 iters on 2108); the read count, not the logic, changed.
  while (lp < ep) {
    const mv = vlist[lp]!.info.mval;
    if (mv !== undefined && mv >= 0) break;
    lp++;
  }
  return lp;
}

/**
 * Reused output for reorderFindRp. The result is consumed synchronously by the
 * single caller (and by tests) before the next call, so a shared scratch object
 * is safe and removes ~1.6e9 short-lived allocations on large ranks (2108).
 * @see lib/dotgen/mincross.c:reorder (C returns `rp`/`muststay` via locals)
 */
const REORDER_RP: ReorderResult = { rp: 0, muststay: false };

export function reorderFindRp(g: Graph, vlist: Node[], lp: number, ep: number): ReorderResult {
  const lpNode = vlist[lp]!; // loop-invariant across the rp scan — hoisted
  let sawclust = false;
  for (let rp = lp + 1; rp < ep; rp++) {
    const w = vlist[rp]!;
    const wInfo = w.info;
    if (sawclust && wInfo.clust) continue;
    if (left2right(g, lpNode, w) !== 0) { REORDER_RP.rp = rp; REORDER_RP.muststay = true; return REORDER_RP; }
    const wm = wInfo.mval;
    if (wm !== undefined && wm >= 0) { REORDER_RP.rp = rp; REORDER_RP.muststay = false; return REORDER_RP; }
    if (wInfo.clust) sawclust = true;
  }
  REORDER_RP.rp = ep; REORDER_RP.muststay = false;
  return REORDER_RP;
}

export function reorderInner(
  ctx: MincrossContext,
  g: Graph,
  vlist: Node[],
  win: { start: number; ep: number },
  reverse: boolean,
): boolean {
  let changed = false;
  const ep = win.ep;
  let lp = win.start;
  while (lp < ep) {
    lp = reorderFindLp(vlist, lp, ep);
    if (lp >= ep) break;
    const res = reorderFindRp(g, vlist, lp, ep);
    const rp = res.rp; // capture before any later call mutates the shared scratch
    if (rp >= ep) break;
    if (!res.muststay) {
      // Perf: read each node and its mval once (was four property-chain reads).
      const lpNode = vlist[lp]!;
      const rpNode = vlist[rp]!;
      const m1 = lpNode.info.mval;
      const m2 = rpNode.info.mval;
      const p1 = m1 !== undefined ? m1 : -1;
      const p2 = m2 !== undefined ? m2 : -1;
      if (p1 > p2 || (p1 >= p2 && reverse)) { exchange(ctx, lpNode, rpNode); changed = true; }
    }
    lp = rp;
  }
  return changed;
}

/**
 * Absolute window [start, start+n) for a rank — faithful to C reading the
 * already-offset GD_rank(g)[r].v window pointer. @see mincross.c:reorder
 */
function reorderWindow(re: RankEntry): { start: number; n: number } {
  return { start: re.vStart ?? 0, n: re.n };
}

/** @see lib/dotgen/mincross.c:reorder */
export function reorder(ctx: MincrossContext, g: Graph, r: number, reverse: boolean, hasfixed: boolean): void {
  const rootRank = ctx.root.info.rank;
  if (!rootRank) return;
  const rk = g.info.rank;
  if (!rk) return;
  const vlist = rk[r].v;
  const { start, n } = reorderWindow(rk[r]);
  let ep = start + n;
  let changed = false;
  for (let nelt = n - 1; nelt >= 0; nelt--) {
    if (reorderInner(ctx, g, vlist, { start, ep }, reverse)) changed = true;
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
