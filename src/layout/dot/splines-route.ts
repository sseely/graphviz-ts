// SPDX-License-Identifier: EPL-2.0

/**
 * make_regular_edge and helpers — regular (non-flat) edge spline routing.
 *
 * Full pathplan routing is deferred until pathplan.ts is ported.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Box } from '../../model/geom.js';
import { VIRTUAL, NORMAL } from './fastgr.js';
import { nodeRankOf, nodeOrderOf, nodeCoordX, splineMerge } from './splines.js';

// ---------------------------------------------------------------------------
// SplineInfo
// @see lib/dotgen/dotsplines.c:spline_info_t
// ---------------------------------------------------------------------------

/**
 * Per-call spline routing state (mirrors spline_info_t in C).
 * @see lib/dotgen/dotsplines.c:spline_info_t
 */
export interface SplineInfo {
  leftBound: number;
  rightBound: number;
  splinesep: number;
  multisep: number;
  rankBox: Box[];
}

/** Create a zero-initialized SplineInfo. */
export function makeSplineInfo(): SplineInfo {
  return { leftBound: 0, rightBound: 0, splinesep: 0, multisep: 0, rankBox: [] };
}

// ---------------------------------------------------------------------------
// Node edge-count accessors (each ?? is its own CCN=2 function)
// ---------------------------------------------------------------------------

export function nodeOutSize(n: Node): number { return n.info.out?.size ?? 0; }
export function nodeInSize(n: Node): number { return n.info.in?.size ?? 0; }
export function nodeType(n: Node): number { return n.info.node_type ?? 0; }

// ---------------------------------------------------------------------------
// top_bound / bot_bound
// @see lib/dotgen/dotsplines.c:top_bound, bot_bound
// ---------------------------------------------------------------------------

/** @see lib/dotgen/dotsplines.c:top_bound */
export function topBound(e: Edge, side: number): Edge | undefined {
  const sz = nodeOutSize(e.tail);
  let ans: Edge | undefined;
  for (let i = 0; i < sz; i++) {
    const f = e.tail.info.out!.list[i];
    if (side * (nodeOrderOf(f.head) - nodeOrderOf(e.head)) <= 0) continue;
    if (f.info.spl === undefined && f.info.to_orig?.info.spl === undefined) continue;
    if (ans === undefined || side * (nodeOrderOf(ans.head) - nodeOrderOf(f.head)) > 0) ans = f;
  }
  return ans;
}

/** @see lib/dotgen/dotsplines.c:bot_bound */
export function botBound(e: Edge, side: number): Edge | undefined {
  const sz = nodeInSize(e.head);
  let ans: Edge | undefined;
  for (let i = 0; i < sz; i++) {
    const f = e.head.info.in!.list[i];
    if (side * (nodeOrderOf(f.tail) - nodeOrderOf(e.tail)) <= 0) continue;
    if (f.info.spl === undefined && f.info.to_orig?.info.spl === undefined) continue;
    if (ans === undefined || side * (nodeOrderOf(ans.tail) - nodeOrderOf(f.tail)) > 0) ans = f;
  }
  return ans;
}

// ---------------------------------------------------------------------------
// straight_len
// @see lib/dotgen/dotsplines.c:straight_len
// ---------------------------------------------------------------------------

/** True if v can continue a straight run from anchor n. */
export function isStraightContinuation(v: Node, n: Node): boolean {
  if (nodeType(v) !== VIRTUAL) return false;
  if (nodeOutSize(v) !== 1 || nodeInSize(v) !== 1) return false;
  return nodeCoordX(v) === nodeCoordX(n);
}

/** Advance one step along the straight chain; return undefined if done. */
export function straightNext(v: Node): Node | undefined {
  const e = v.info.out?.list[0];
  return e ? e.head : undefined;
}

/** @see lib/dotgen/dotsplines.c:straight_len */
export function straightLen(n: Node): number {
  let cnt = 0;
  let v: Node | undefined = n;
  for (;;) {
    v = straightNext(v);
    if (!v || !isStraightContinuation(v, n)) break;
    cnt++;
  }
  return cnt;
}

// ---------------------------------------------------------------------------
// resize_vn
// @see lib/dotgen/dotsplines.c:resize_vn
// ---------------------------------------------------------------------------

/** @see lib/dotgen/dotsplines.c:resize_vn */
export function resizeVn(vn: Node, lx: number, cx: number, rx: number): void {
  vn.info.coord.x = cx;
  vn.info.lw = cx - lx;
  vn.info.rw = rx - cx;
}

// ---------------------------------------------------------------------------
// pathscross helpers
// @see lib/dotgen/dotsplines.c:pathscross
// ---------------------------------------------------------------------------

/** True if na/nb ordering contradicts expected crossing order. */
export function orderContradicts(na: Node, nb: Node, order: boolean): boolean {
  return order !== (nodeOrderOf(na) > nodeOrderOf(nb));
}

/** Advance one step along out-edges of na and nb simultaneously. */
export function advanceOutPair(
  e0: Edge | undefined, ef: Edge | undefined,
): [Edge | undefined, Edge | undefined] {
  const na = e0?.head;
  const nb = ef?.head;
  const nextE0 = na && nodeOutSize(na) === 1 && nodeType(na) !== NORMAL
    ? na.info.out?.list[0] : undefined;
  const nextEf = nb && nodeOutSize(nb) === 1 && nodeType(nb) !== NORMAL
    ? nb.info.out?.list[0] : undefined;
  return [nextE0, nextEf];
}

/** Advance one step along in-edges of na and nb simultaneously. */
export function advanceInPair(
  e0: Edge | undefined, ef: Edge | undefined,
): [Edge | undefined, Edge | undefined] {
  const na = e0?.tail;
  const nb = ef?.tail;
  const nextE0 = na && nodeInSize(na) === 1 && nodeType(na) !== NORMAL
    ? na.info.in?.list[0] : undefined;
  const nextEf = nb && nodeInSize(nb) === 1 && nodeType(nb) !== NORMAL
    ? nb.info.in?.list[0] : undefined;
  return [nextE0, nextEf];
}

/** Check one out-step for a crossing. Returns true if crossing found. */
export function outStepCrosses(e0: Edge, ef: Edge, order: boolean): boolean {
  const na = e0.head;
  const nb = ef.head;
  if (na === nb) return false;
  return orderContradicts(na, nb, order);
}

/** Check one in-step for a crossing. Returns true if crossing found. */
export function inStepCrosses(e0: Edge, ef: Edge, order: boolean): boolean {
  const na = e0.tail;
  const nb = ef.tail;
  if (na === nb) return false;
  return orderContradicts(na, nb, order);
}

/** @see lib/dotgen/dotsplines.c:pathscross (out direction) */
export function checkOutCross(n0: Node, order: boolean, e1: Edge | undefined): boolean {
  if (nodeOutSize(n0) !== 1 || !e1) return false;
  let e0: Edge | undefined = n0.info.out!.list[0];
  let ef: Edge | undefined = e1;
  for (let cnt = 0; cnt < 2 && e0 && ef; cnt++) {
    if (outStepCrosses(e0, ef, order)) return true;
    if (e0.head === ef.head) break;
    [e0, ef] = advanceOutPair(e0, ef);
  }
  return false;
}

/** @see lib/dotgen/dotsplines.c:pathscross (in direction) */
export function checkInCross(n0: Node, order: boolean, e1: Edge | undefined): boolean {
  if (nodeInSize(n0) !== 1 || !e1) return false;
  let e0: Edge | undefined = n0.info.in!.list[0];
  let ef: Edge | undefined = e1;
  for (let cnt = 0; cnt < 2 && e0 && ef; cnt++) {
    if (inStepCrosses(e0, ef, order)) return true;
    if (e0.tail === ef.tail) break;
    [e0, ef] = advanceInPair(e0, ef);
  }
  return false;
}

/** @see lib/dotgen/dotsplines.c:pathscross */
export function pathscross(
  n0: Node, n1: Node,
  ie1: Edge | undefined, oe1: Edge | undefined,
): boolean {
  if (nodeOutSize(n0) !== 1 && nodeOutSize(n1) !== 1) return false;
  const order = nodeOrderOf(n0) > nodeOrderOf(n1);
  return checkOutCross(n0, order, oe1) || checkInCross(n0, order, ie1);
}

// ---------------------------------------------------------------------------
// neighbor — find adjacent node for bbox computation
// @see lib/dotgen/dotsplines.c:neighbor
// ---------------------------------------------------------------------------

/** True if n should be returned as a neighbor candidate. */
export function isNeighborCandidate(n: Node): boolean {
  if (nodeType(n) === VIRTUAL && n.info.label) return true;
  return nodeType(n) === NORMAL;
}

/** @see lib/dotgen/dotsplines.c:neighbor */
export function neighbor(
  g: Graph, vn: Node,
  ie: Edge | undefined, oe: Edge | undefined,
  dir: number,
): Node | undefined {
  const rank = g.info.rank?.[nodeRankOf(vn)];
  if (!rank) return undefined;
  const start = nodeOrderOf(vn) + dir;
  for (let i = start; i >= 0 && i < rank.n; i += dir) {
    const n = rank.v[i];
    if (!n) break;
    if (isNeighborCandidate(n)) return n;
    if (!pathscross(n, vn, ie, oe)) return n;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// make_regular_edge — stub (pathplan not yet ported)
// @see lib/dotgen/dotsplines.c:make_regular_edge
// ---------------------------------------------------------------------------

/**
 * Route a regular (non-flat, non-self) edge.
 * Full implementation requires pathplan.ts.
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 */
export function makeRegularEdge(
  _g: Graph, _sp: SplineInfo,
  _edges: Edge[], _cnt: number, _et: number,
): void {
  // TODO: implement when pathplan.ts is ported
}

export { splineMerge };
