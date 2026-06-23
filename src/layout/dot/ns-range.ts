// SPDX-License-Identifier: EPL-2.0
/** @see lib/common/ns.c — cut values, DFS range initialization */
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { EdgeList } from '../../model/nodeInfo.js';
import { seq, isTreeEdge } from './ns-core.js';
import type { NsCtx } from './ns-core.js';

// ---------------------------------------------------------------------------
// Shared flat DFS frame stack (structure-of-arrays).  @see AD-1
//
// C's dfs_range / dfs_range_init / dfs_cutval each use `LIST(dfs_state_t)` — a
// flat array of value structs with zero per-frame heap allocation
// (lib/common/ns.c:1161 `dfs_state_t`). The object-stack port allocated one
// `{v,par,lim,toI,tiI}` object per node visit (~384M on tests/2471), the 40%
// hotspot. These module-private parallel arrays mirror C's value-struct list:
// indexed by a stack pointer `sp`, reused across calls, grown in place.
//
// Multi-diagram safety (see memory multi-diagram-global-state-safety): these are
// `const`-bound buffers, never reassigned, so they cannot be confused with the
// reset-per-render `let` globals the fitness check guards. Every public entry
// starts at sp=0 and writes each slot before reading it, and every pushed frame
// is popped before the call returns, with `popFrame` nulling the `Node`/`Edge`
// reference slots — so no graph reference survives one render into the next.
// The three functions never run re-entrantly (single-threaded, synchronous, and
// none calls another), so one shared buffer set is safe.
// ---------------------------------------------------------------------------

const frameV: (Node | undefined)[] = [];
const framePar: (Edge | undefined)[] = [];
const frameLim: number[] = [];
const frameToI: number[] = [];
const frameTiI: number[] = [];

/** Push a frame at `sp`; returns the new stack pointer. */
function pushFrame(n: Node | undefined, par: Edge | undefined, lim: number, sp: number): number {
  frameV[sp] = n;
  framePar[sp] = par;
  frameLim[sp] = lim;
  frameToI[sp] = 0;
  frameTiI[sp] = 0;
  return sp + 1;
}

/** Pop the top frame; nulls reference slots so no graph leaks across renders. */
function popFrame(sp: number): number {
  const t = sp - 1;
  frameV[t] = undefined;
  framePar[t] = undefined;
  return t;
}

// ---------------------------------------------------------------------------
// xVal / xCutval
// ---------------------------------------------------------------------------

/** Returns [f, rv] sub-components. @see lib/common/ns.c:x_val */
function xValRv(e: Edge, inSub: boolean): [number, number] {
  if (!inSub) return [1, e.info.weight ?? 1];
  const cv = isTreeEdge(e) ? (e.info.cutvalue ?? 0) : 0;
  return [0, cv - (e.info.weight ?? 1)];
}

/** Returns direction multiplier d. @see lib/common/ns.c:x_val */
function xValDir(e: Edge, v: Node, dir: number): number {
  if (dir > 0) return e.head === v ? 1 : -1;
  return e.tail === v ? 1 : -1;
}

/** @see lib/common/ns.c:x_val */
export function xVal(e: Edge, v: Node, dir: number): number {
  const other = e.tail === v ? e.head : e.tail;
  const inSub = seq(v.info.low ?? 0, other.info.lim ?? 0, v.info.lim ?? 0);
  let [f, rv] = xValRv(e, inSub);
  let d = xValDir(e, v, dir);
  if (f) d = -d;
  return d < 0 ? -rv : rv;
}

/** @see lib/common/ns.c:x_cutval */
export function xCutval(f: Edge): void {
  const v = f.tail.info.par === f ? f.tail : f.head;
  const dir = f.tail.info.par === f ? 1 : -1;
  let sum = 0;
  const out = v.info.out;
  if (out) for (let i = 0; i < out.size; i++) sum += xVal(out.list[i], v, dir);
  const inp = v.info.in;
  if (inp) for (let i = 0; i < inp.size; i++) sum += xVal(inp.list[i], v, dir);
  f.info.cutvalue = sum;
}

// ---------------------------------------------------------------------------
// dfsCutval
// ---------------------------------------------------------------------------

/** Scan one tree-edge list for an unvisited child; push it. @see dfs_cutval */
function cutvalDescend(list: EdgeList | undefined, iArr: number[], top: number, sp: number, head: boolean): number {
  if (!list) return sp;
  const par = framePar[top];
  while (iArr[top] < list.size) {
    const e = list.list[iArr[top]++];
    if (e !== par) return pushFrame(head ? e.head : e.tail, e, 0, sp);
  }
  return sp;
}

/** @see lib/common/ns.c:dfs_cutval */
export function dfsCutval(v: Node, par?: Edge): void {
  let sp = pushFrame(v, par, 0, 0);
  while (sp > 0) {
    const top = sp - 1;
    const sv = frameV[top]!;
    let nsp = cutvalDescend(sv.info.tree_out, frameToI, top, sp, true);
    if (nsp !== sp) { sp = nsp; continue; }
    nsp = cutvalDescend(sv.info.tree_in, frameTiI, top, sp, false);
    if (nsp !== sp) { sp = nsp; continue; }
    const fpar = framePar[top];
    if (fpar) xCutval(fpar);
    sp = popFrame(sp);
  }
}

// ---------------------------------------------------------------------------
// initCutvalues
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c:init_cutvalues */
export function initCutvalues(ctx: NsCtx): void {
  dfsRangeInit(ctx.g.info.nlist!);
  dfsCutval(ctx.g.info.nlist!);
}

// ---------------------------------------------------------------------------
// dfsRangeInit
// ---------------------------------------------------------------------------

/** Scan one tree-edge list; set par/low and push the first unvisited child. */
function rangeInitDescend(list: EdgeList | undefined, iArr: number[], top: number, sp: number, head: boolean): number {
  if (!list) return sp;
  const par = framePar[top];
  const lim = frameLim[top];
  while (iArr[top] < list.size) {
    const e = list.list[iArr[top]++];
    if (e !== par) {
      const n = head ? e.head : e.tail;
      n.info.par = e;
      n.info.low = lim;
      return pushFrame(n, e, lim, sp);
    }
  }
  return sp;
}

/** @see lib/common/ns.c:dfs_range_init */
export function dfsRangeInit(v: Node): number {
  v.info.par = undefined;
  v.info.low = 1;
  let sp = pushFrame(v, undefined, 1, 0);
  let lim = 0;
  while (sp > 0) {
    const top = sp - 1;
    const sv = frameV[top]!;
    let nsp = rangeInitDescend(sv.info.tree_out, frameToI, top, sp, true);
    if (nsp !== sp) { sp = nsp; continue; }
    nsp = rangeInitDescend(sv.info.tree_in, frameTiI, top, sp, false);
    if (nsp !== sp) { sp = nsp; continue; }
    sv.info.lim = frameLim[top];
    lim = frameLim[top];
    sp = popFrame(sp);
    if (sp > 0) frameLim[sp - 1] = lim + 1;
  }
  return lim + 1;
}

// ---------------------------------------------------------------------------
// dfsRange
// ---------------------------------------------------------------------------

/**
 * Scan one tree-edge list. On an already-ranged child (`par===e && low===lim`)
 * absorb its range into `lim` and keep scanning (== C's break+continue, which
 * re-runs the same list from the advanced index). Otherwise set par/low and
 * push it. Returns the new sp (> sp only when a frame was pushed).
 */
function rangeDescend(list: EdgeList | undefined, iArr: number[], top: number, sp: number, head: boolean): number {
  if (!list) return sp;
  const par = framePar[top];
  while (iArr[top] < list.size) {
    const e = list.list[iArr[top]++];
    if (e === par) continue;
    const n = head ? e.head : e.tail;
    const lim = frameLim[top];
    if (n.info.par === e && n.info.low === lim) {
      frameLim[top] = n.info.lim! + 1;
      continue;
    }
    n.info.par = e;
    n.info.low = lim;
    return pushFrame(n, e, lim, sp);
  }
  return sp;
}

/** One settle step of the dfsRange stack: descend, or finalize+pop the top. */
function rangeFrameStep(sp: number): number {
  const top = sp - 1;
  const sv = frameV[top]!;
  let nsp = rangeDescend(sv.info.tree_out, frameToI, top, sp, true);
  if (nsp !== sp) return nsp;
  nsp = rangeDescend(sv.info.tree_in, frameTiI, top, sp, false);
  if (nsp !== sp) return nsp;
  sv.info.lim = frameLim[top];
  const lim = frameLim[top];
  sp = popFrame(sp);
  if (sp > 0) frameLim[sp - 1] = lim + 1;
  return sp;
}

/** @see lib/common/ns.c:dfs_range */
export function dfsRange(v: Node, par: Edge | undefined, low: number): number {
  if (v.info.par === par && (v.info.low ?? 0) === low) return (v.info.lim ?? 0) + 1;
  v.info.par = par;
  v.info.low = low;
  let sp = pushFrame(v, par, low, 0);
  while (sp > 0) sp = rangeFrameStep(sp);
  return (v.info.lim ?? 0) + 1;
}
