// SPDX-License-Identifier: EPL-2.0
/** @see lib/common/ns.c — cut values, DFS range initialization */
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { seq, isTreeEdge } from './ns-core.js';
import type { NsCtx } from './ns-core.js';

// ---------------------------------------------------------------------------
// Internal state types
// ---------------------------------------------------------------------------

interface DfsCvState { v: Node; par?: Edge; toI: number; tiI: number; }
interface DfsState { v: Node; par?: Edge; lim: number; toI: number; tiI: number; }

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

export function dfsCvStep(todo: DfsCvState[]): boolean {
  const top = todo[todo.length - 1];
  const to = top.v.info.tree_out;
  while (to && top.toI < to.size) {
    const e = to.list[top.toI++];
    if (e !== top.par) {
      todo.push({ v: e.head, par: e, toI: 0, tiI: 0 });
      return true;
    }
  }
  const ti = top.v.info.tree_in;
  while (ti && top.tiI < ti.size) {
    const e = ti.list[top.tiI++];
    if (e !== top.par) {
      todo.push({ v: e.tail, par: e, toI: 0, tiI: 0 });
      return true;
    }
  }
  if (top.par) xCutval(top.par);
  todo.pop();
  return false;
}

/** @see lib/common/ns.c:dfs_cutval */
export function dfsCutval(v: Node, par?: Edge): void {
  const todo: DfsCvState[] = [{ v, par, toI: 0, tiI: 0 }];
  while (todo.length > 0) dfsCvStep(todo);
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

function dfsRangeInitStep(todo: DfsState[], s: DfsState, n: Node, e: Edge): void {
  n.info.par = e; n.info.low = s.lim;
  todo.push({ v: n, par: e, lim: s.lim, toI: 0, tiI: 0 });
}

export function dfsRangeInitFrame(todo: DfsState[]): boolean {
  const s = todo[todo.length - 1];
  const to = s.v.info.tree_out;
  while (to && s.toI < to.size) {
    const e = to.list[s.toI++];
    if (e !== s.par) { dfsRangeInitStep(todo, s, e.head, e); return true; }
  }
  const ti = s.v.info.tree_in;
  while (ti && s.tiI < ti.size) {
    const e = ti.list[s.tiI++];
    if (e !== s.par) { dfsRangeInitStep(todo, s, e.tail, e); return true; }
  }
  s.v.info.lim = s.lim;
  const lim = s.lim; todo.pop();
  if (todo.length > 0) todo[todo.length - 1].lim = lim + 1;
  return false;
}

/** @see lib/common/ns.c:dfs_range_init */
export function dfsRangeInit(v: Node): number {
  v.info.par = undefined; v.info.low = 1;
  const todo: DfsState[] = [{ v, par: undefined, lim: 1, toI: 0, tiI: 0 }];
  while (todo.length > 0) dfsRangeInitFrame(todo);
  return (v.info.lim ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// dfsRange
// ---------------------------------------------------------------------------

function dfsRangeStep(todo: DfsState[], s: DfsState, n: Node, e: Edge): boolean {
  if (n.info.par === e && (n.info.low ?? 0) === s.lim) {
    s.lim = (n.info.lim ?? 0) + 1; return false;
  }
  n.info.par = e; n.info.low = s.lim;
  todo.push({ v: n, par: e, lim: s.lim, toI: 0, tiI: 0 });
  return true;
}

export function dfsRangeFrame(todo: DfsState[]): boolean {
  const s = todo[todo.length - 1];
  const to = s.v.info.tree_out;
  while (to && s.toI < to.size) {
    const e = to.list[s.toI++];
    if (e !== s.par && dfsRangeStep(todo, s, e.head, e)) return true;
  }
  const ti = s.v.info.tree_in;
  while (ti && s.tiI < ti.size) {
    const e = ti.list[s.tiI++];
    if (e !== s.par && dfsRangeStep(todo, s, e.tail, e)) return true;
  }
  s.v.info.lim = s.lim;
  const lim = s.lim; todo.pop();
  if (todo.length > 0) todo[todo.length - 1].lim = lim + 1;
  return false;
}

/** @see lib/common/ns.c:dfs_range */
export function dfsRange(v: Node, par: Edge | undefined, low: number): number {
  if (v.info.par === par && (v.info.low ?? 0) === low) return (v.info.lim ?? 0) + 1;
  v.info.par = par; v.info.low = low;
  const todo: DfsState[] = [{ v, par, lim: low, toI: 0, tiI: 0 }];
  while (todo.length > 0) dfsRangeFrame(todo);
  return (v.info.lim ?? 0) + 1;
}
