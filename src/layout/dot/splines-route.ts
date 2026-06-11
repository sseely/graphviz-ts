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
import type { Box, Point } from '../../model/geom.js';
import { VIRTUAL, NORMAL } from './fastgr.js';
import { nodeRankOf, nodeOrderOf, nodeCoordX, splineMerge, resolveOrigEdge } from './splines.js';
import { buildRankCorridor, clipToNodes } from './edge-route-routing.js';
import { computeSpline } from './edge-route-poly.js';
import { nodeBoxOf, installEdgeSpline, edgePenwidthAttr } from './edge-route-helpers.js';
import { rankEdgeInfoOf } from './edge-route-rank.js';
import { arrowheadPolygon } from './edge-route-arrow.js';
import { edgeRenderPenwidth } from './edge-route-helpers.js';

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

// ---------------------------------------------------------------------------
// routeParallelEdgeGroup — parallel-edge offset for regular (non-self) edges
// @see lib/dotgen/dotsplines.c:make_regular_edge (cnt > 1 offset section)
// ---------------------------------------------------------------------------

/**
 * Apply x-offset to interior control points of a bezier (any length).
 * C shifts only k=1..size-2 (interior control points).
 * Endpoints (index 0 and index length-1) are fixed.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge (pointfs interior shift)
 */
export function shiftInteriorPts(pts: Point[], dx: number): Point[] {
  return pts.map((p, i) => isInterior(i, pts.length)
    ? { x: p.x + dx, y: p.y }
    : p,
  );
}

/** True when index i is an interior control point (not an endpoint). */
function isInterior(i: number, len: number): boolean {
  return i > 0 && i < len - 1;
}

/**
 * Build the unclipped base bezier for the edge group via rank-corridor,
 * falling back to a linear bezier when rank geometry is unavailable.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (spline computation)
 */
function baseSplineForGroup(g: Graph, e0: Edge): Point[] {
  const tailBox = nodeBoxOf(e0.tail, g);
  const headBox = nodeBoxOf(e0.head, g);
  const rankInfo = rankEdgeInfoOf(g, e0.tail, e0.head);
  if (rankInfo !== undefined) {
    const corridor = buildRankCorridor(tailBox, headBox, rankInfo);
    return computeSpline(corridor.boxes, corridor.startPt, corridor.endPt);
  }
  const s = e0.tail.info.coord;
  const d = e0.head.info.coord;
  return [
    { x: s.x, y: s.y },
    { x: s.x + (d.x - s.x) / 3,       y: s.y + (d.y - s.y) / 3 },
    { x: s.x + 2 * (d.x - s.x) / 3,   y: s.y + 2 * (d.y - s.y) / 3 },
    { x: d.x, y: d.y },
  ];
}

/** Clip a shifted bezier to node boundaries and install spline + arrowhead. */
function installShiftedEdge(g: Graph, e: Edge, shifted: Point[]): void {
  // Clip using the edge's own tail/head nodes (virtual edges have physical coords).
  const tBox = nodeBoxOf(e.tail, g);
  const hBox = nodeBoxOf(e.head, g);
  const pw = edgePenwidthAttr(e);
  const { clipped, arrowTip, arrowDir } = clipToNodes(shifted, tBox, hBox, pw);
  // Install spl on the original NORMAL edge (mirrors C clip_and_install's to_orig loop).
  // @see lib/common/splines.c:clip_and_install (lines 248-249)
  const orig = resolveOrigEdge(e);
  installEdgeSpline(orig, clipped, arrowTip);
  (orig.info as unknown as Record<string, unknown>)._arrowPts =
    arrowheadPolygon(arrowTip, arrowDir, edgeRenderPenwidth(orig));
}

/**
 * Route a group of cnt >= 1 parallel regular edges with C-faithful x-offsets.
 *
 * Algorithm (mirrors make_regular_edge cnt > 1 section in dotsplines.c):
 *   1. Route one base path via rank-corridor spline.
 *   2. dx = Multisep * (cnt - 1) / 2
 *   3. edge[0]: interior points shifted left by dx
 *   4. edge[j] (j=1..cnt-1): shift right by Multisep per step
 *   Each shifted path is clipped to node boundaries independently.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 */
export function routeParallelEdgeGroup(
  g: Graph, edges: Edge[], multisep: number,
): void {
  const cnt = edges.length;
  if (cnt === 0) return;
  const base = baseSplineForGroup(g, edges[0]!);
  if (cnt === 1) { installShiftedEdge(g, edges[0]!, base); return; }
  // dx = Multisep * (cnt-1) / 2 centres the fan on the base path.
  // @see lib/dotgen/dotsplines.c:make_regular_edge:1885
  const dx = multisep * (cnt - 1) / 2;
  let shifted = shiftInteriorPts(base, -dx);
  for (let j = 0; j < cnt; j++) {
    if (j > 0) shifted = shiftInteriorPts(shifted, multisep);
    installShiftedEdge(g, edges[j]!, shifted);
  }
}

export { splineMerge };
