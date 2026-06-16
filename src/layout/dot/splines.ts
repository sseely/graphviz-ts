// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of lib/dotgen/dotsplines.c — dot_splines entry point,
 * edgecmp, main routing loop.
 *
 * The full spline routing infrastructure (routesplines, pathplan, boxes)
 * is not yet ported; this module provides the entry-point scaffolding and
 * the edge-normalization pass that are testable independently.
 *
 * @see lib/dotgen/dotsplines.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Bezier, Spline } from '../../model/geom.js';
import { VIRTUAL, NORMAL, FLATORDER } from './fastgr.js';
import { IGNORED } from './rank.js';
import { markLowclusters } from './cluster.js';
import { routeDotEdges } from './edge-route.js';
import { collectOtherEdges, routeSelfEdgeGroup, buildDotSinfo } from './self-loop.js';
import { routeParallelEdgeGroup } from './splines-route.js';
import { placePortLabels, placeRegularEdgeLabels } from './splines-label.js';

// ---------------------------------------------------------------------------
// Edge-type flag constants
// @see lib/dotgen/dotsplines.c
// ---------------------------------------------------------------------------

export const REGULAREDGE    = 1;
export const FLATEDGE       = 2;
export const SELFNPEDGE     = 3;
export const SELFWPEDGE     = 4;
export const EDGETYPEMASK   = 7;

export const FWDEDGE        = 16;
export const BWDEDGE        = 32;

export const MAINGRAPH      = 64;
export const AUXGRAPH       = 128;
export const GRAPHTYPEMASK  = 192;

// ---------------------------------------------------------------------------
// EDGETYPE constants (GD_flags / setEdgeType)
// @see lib/common/const.h
// ---------------------------------------------------------------------------

export const EDGETYPE_NONE    = 0;
export const EDGETYPE_LINE    = 1;
export const EDGETYPE_CURVED  = 2;
export const EDGETYPE_PLINE   = 3;
export const EDGETYPE_ORTHO   = 4;
export const EDGETYPE_SPLINE  = 5;

/** Read edge type from graph flags. @see lib/common/const.h:EDGE_TYPE */
export function edgeType(g: Graph): number {
  return g.info.flags & 0xf;
}

// ---------------------------------------------------------------------------
// Node/edge rank & order accessors (each ?? is its own CCN=2 function)
// ---------------------------------------------------------------------------

export function nodeRankOf(n: Node): number { return n.info.rank ?? 0; }
export function nodeOrderOf(n: Node): number { return n.info.order ?? 0; }
export function nodeCoordX(n: Node): number { return n.info.coord?.x ?? 0; }
export function edgeTreeIndex(e: Edge): number { return e.info.tree_index ?? 0; }

// ---------------------------------------------------------------------------
// getmainedge — follow to_virt then to_orig to find the root edge
// @see lib/dotgen/dotsplines.c:getmainedge
// ---------------------------------------------------------------------------

/** @see lib/dotgen/dotsplines.c:getmainedge */
export function getMainEdge(e: Edge): Edge {
  let le = e;
  while (le.info.to_virt) le = le.info.to_virt;
  while (le.info.to_orig) le = le.info.to_orig;
  return le;
}

// ---------------------------------------------------------------------------
// swap_ends_p — true if spline control points should be reversed
// @see lib/dotgen/dotsplines.c:swap_ends_p
// ---------------------------------------------------------------------------

/** Resolve to the underlying normal edge. */
export function resolveOrigEdge(e: Edge): Edge {
  let cur = e;
  while (cur.info.to_orig) cur = cur.info.to_orig;
  return cur;
}

/** Compare head vs tail rank; return true if head rank < tail rank. */
export function headRankLower(e: Edge): boolean {
  return nodeRankOf(e.head) < nodeRankOf(e.tail);
}

/** Compare head vs tail rank; return true if head rank > tail rank. */
export function headRankHigher(e: Edge): boolean {
  return nodeRankOf(e.head) > nodeRankOf(e.tail);
}

/** @see lib/dotgen/dotsplines.c:swap_ends_p */
export function swapEndsP(e: Edge): boolean {
  const cur = resolveOrigEdge(e);
  if (headRankHigher(cur)) return false;
  if (headRankLower(cur)) return true;
  return nodeOrderOf(cur.head) < nodeOrderOf(cur.tail);
}

// ---------------------------------------------------------------------------
// splineMerge — true if node is a VIRTUAL merge node
// @see lib/dotgen/dotsplines.c:spline_merge
// ---------------------------------------------------------------------------

/** @see lib/dotgen/dotsplines.c:spline_merge */
export function splineMerge(n: Node): boolean {
  return (n.info.node_type ?? 0) === VIRTUAL
    && ((n.info.in?.size ?? 0) > 1 || (n.info.out?.size ?? 0) > 1);
}

// ---------------------------------------------------------------------------
// setflags — assign tree_index on edge
// @see lib/dotgen/dotsplines.c:setflags
// ---------------------------------------------------------------------------

/** Determine f1 (edge category) given hint or edge geometry. */
export function resolveF1(e: Edge, hint1: number): number {
  if (hint1 !== 0) return hint1;
  if (e.tail === e.head) {
    return (e.info.tail_port.defined || e.info.head_port.defined)
      ? SELFWPEDGE : SELFNPEDGE;
  }
  if (nodeRankOf(e.tail) === nodeRankOf(e.head)) return FLATEDGE;
  return REGULAREDGE;
}

/** Determine f2 for REGULAREDGE based on rank order. */
export function resolveF2Regular(e: Edge): number {
  return nodeRankOf(e.tail) < nodeRankOf(e.head) ? FWDEDGE : BWDEDGE;
}

/** Determine f2 for FLATEDGE based on order. */
export function resolveF2Flat(e: Edge): number {
  return nodeOrderOf(e.tail) < nodeOrderOf(e.head) ? FWDEDGE : BWDEDGE;
}

/** @see lib/dotgen/dotsplines.c:setflags — determine direction flag f2 */
export function resolveF2(e: Edge, f1: number, hint2: number): number {
  if (hint2 !== 0) return hint2;
  if (f1 === REGULAREDGE) return resolveF2Regular(e);
  if (f1 === FLATEDGE) return resolveF2Flat(e);
  return FWDEDGE;
}

/** @see lib/dotgen/dotsplines.c:setflags */
export function setflags(e: Edge, hint1: number, hint2: number, f3: number): void {
  const f1 = resolveF1(e, hint1);
  const f2 = resolveF2(e, f1, hint2);
  e.info.tree_index = f1 | f2 | f3;
}

// ---------------------------------------------------------------------------
// edgecmp helpers
// @see lib/dotgen/dotsplines.c:edgecmp
// ---------------------------------------------------------------------------

/** Compare two numbers: return -1, 0, or 1. */
export function numCmp(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Compare |rank difference| of two main edges. */
export function cmpRankDiff(le0: Edge, le1: Edge): number {
  const v0 = Math.abs(nodeRankOf(le0.tail) - nodeRankOf(le0.head));
  const v1 = Math.abs(nodeRankOf(le1.tail) - nodeRankOf(le1.head));
  return numCmp(v0, v1);
}

/** Compare |x-coord difference| of two main edges. */
export function cmpXDiff(le0: Edge, le1: Edge): number {
  const v0 = Math.abs(nodeCoordX(le0.tail) - nodeCoordX(le0.head));
  const v1 = Math.abs(nodeCoordX(le1.tail) - nodeCoordX(le1.head));
  return numCmp(v0, v1);
}

/** @see lib/dotgen/dotsplines.c:edgecmp */
export function edgecmp(e0: Edge, e1: Edge): number {
  const r = numCmp(edgeTreeIndex(e1) & EDGETYPEMASK, edgeTreeIndex(e0) & EDGETYPEMASK);
  if (r !== 0) return r;
  const le0 = getMainEdge(e0);
  const le1 = getMainEdge(e1);
  const rd = cmpRankDiff(le0, le1);
  if (rd !== 0) return rd;
  const xd = cmpXDiff(le0, le1);
  if (xd !== 0) return xd;
  const sq = numCmp(le0.seq, le1.seq);
  if (sq !== 0) return sq;
  return numCmp(e0.seq, e1.seq);
}

// ---------------------------------------------------------------------------
// swap_bezier / swap_spline / edge_normalize
// @see lib/dotgen/dotsplines.c:swap_bezier, swap_spline, edge_normalize
// ---------------------------------------------------------------------------

/** Reverse bezier control points and swap sflag/eflag, sp/ep. */
export function swapBezier(b: Bezier): void {
  b.list.reverse();
  const sf = b.sflag; b.sflag = b.eflag; b.eflag = sf;
  const sp = b.sp; b.sp = b.ep; b.ep = sp;
}

/** Reverse the list of beziers in a spline and swap each bezier. */
export function swapSpline(s: Spline): void {
  s.list.reverse();
  for (const bz of s.list) swapBezier(bz);
}

/**
 * Normalize splines so they always go from tail to head.
 * @see lib/dotgen/dotsplines.c:edge_normalize
 */
export function edgeNormalize(g: Graph): void {
  for (const n of g.nodes.values()) {
    for (let k = 0; k < (n.info.out?.size ?? 0); k++) {
      const e = n.info.out!.list[k];
      if (swapEndsP(e) && e.info.spl) swapSpline(e.info.spl);
    }
  }
}

// ---------------------------------------------------------------------------
// collectEdges — build the edge list for routing
// @see lib/dotgen/dotsplines.c:dot_splines_
// ---------------------------------------------------------------------------

/** True if edge e should be skipped during regular-edge collection. */
export function isSkippedOutEdge(e: Edge): boolean {
  const et = e.info.edge_type ?? 0;
  return et === FLATORDER || et === IGNORED;
}

/** Collect regular out-edges of n into edges. */
export function collectOutEdges(n: Node, edges: Edge[]): void {
  const sz = n.info.out?.size ?? 0;
  for (let k = 0; k < sz; k++) {
    const e = n.info.out!.list[k];
    if (isSkippedOutEdge(e)) continue;
    setflags(e, REGULAREDGE, FWDEDGE, MAINGRAPH);
    edges.push(e);
  }
}

/** Collect flat out-edges of n into edges. */
export function collectFlatEdges(n: Node, edges: Edge[]): void {
  const sz = n.info.flat_out?.size ?? 0;
  for (let k = 0; k < sz; k++) {
    const e = n.info.flat_out!.list[k];
    setflags(e, FLATEDGE, 0, AUXGRAPH);
    edges.push(e);
  }
}

/** True if n participates in edge routing. */
export function nodeNeedsRouting(n: Node): boolean {
  return (n.info.node_type ?? NORMAL) === NORMAL || splineMerge(n);
}

/** Collect all edges for a node that need routing. */
export function collectNodeEdges(n: Node, edges: Edge[]): void {
  if (!nodeNeedsRouting(n)) return;
  collectOutEdges(n, edges);
  collectFlatEdges(n, edges);
  collectOtherEdges(n, edges);
}

// ---------------------------------------------------------------------------
// dot_splines_ / dot_splines — main entry points
// @see lib/dotgen/dotsplines.c:dot_splines_, dot_splines
// ---------------------------------------------------------------------------

/**
 * Count how many consecutive entries in `edges` starting at `ind` share the
 * same main edge (i.e. belong to the same parallel group).
 * @see lib/dotgen/dotsplines.c:355-366
 */
function groupSize(edges: Edge[], ind: number): number {
  const le0 = getMainEdge(edges[ind]);
  let cnt = 1;
  while (ind + cnt < edges.length && getMainEdge(edges[ind + cnt]) === le0) cnt++;
  return cnt;
}

/**
 * Return the original-edge creation seq for parallel-edge ordering.
 * Virtual edges resolve through to_orig; original edges use their own seq.
 * This mirrors C's edgecmp ordering by LE_seq then edge seq — but in TS the
 * virtual edge that represents e1 gets a higher seq than e2/e3 because seq
 * allocation is global; resolving back to the original seq restores C order.
 * @see lib/dotgen/dotsplines.c:edgecmp
 */
function origSeq(e: Edge): number { return resolveOrigEdge(e).seq; }

/**
 * Collapse a contiguous main-edge group to one representative per distinct
 * original edge. A node can carry both the user edge AND a virtual reverse-chain
 * edge to the same neighbour (the opposing `a->b`/`b->a` case: `a` has two
 * out-edges, both resolving to main edge `a->b`, while `b->a` sits in `ND_other`
 * — three collected entries, two distinct originals). C routes one spline per
 * distinct edge; deduping by `resolveOrigEdge` yields cnt=2 for the opposing
 * pair while leaving genuine parallels (3 distinct originals) untouched.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (one clip_and_install per orig)
 */
function dedupByOrig(group: Edge[]): Edge[] {
  const seen = new Set<Edge>();
  const out: Edge[] = [];
  for (const e of group) {
    const o = resolveOrigEdge(e);
    if (seen.has(o)) continue;
    seen.add(o);
    out.push(e);
  }
  return out;
}

/**
 * Dispatch one parallel-edge group to the appropriate router.
 * - self-loops  → routeSelfEdgeGroup
 * - cross-rank, distinct-orig cnt > 1 → routeParallelEdgeGroup (Multisep offsets)
 * - other (cnt=1, same-rank) → left for routeDotEdges
 * @see lib/dotgen/dotsplines.c:367-419
 */
function dispatchEdgeGroup(g: Graph, group: Edge[], multisep: number): void {
  const e0 = group[0];
  if (e0.tail === e0.head) {
    routeSelfEdgeGroup(g, group, group.length, multisep, buildDotSinfo());
    return;
  }
  if (nodeRankOf(e0.tail) === nodeRankOf(e0.head)) return;
  const uniq = dedupByOrig(group);
  if (uniq.length <= 1) return;
  // Sort by original seq so the first original edge gets the leftmost offset,
  // matching C's allocation order (e1 < e2 < e3).
  // @see lib/dotgen/dotsplines.c:make_regular_edge (lines 1885-1907)
  uniq.sort((a, b) => origSeq(a) - origSeq(b));
  routeParallelEdgeGroup(g, uniq, multisep);
}

/**
 * Route one group of parallel edges from the sorted edge list.
 * Returns the number of edges consumed (cnt).
 * @see lib/dotgen/dotsplines.c:343-419
 */
function routeEdgeGroup(g: Graph, edges: Edge[], ind: number, multisep: number): number {
  const cnt = groupSize(edges, ind);
  dispatchEdgeGroup(g, edges.slice(ind, ind + cnt), multisep);
  return cnt;
}

/**
 * Main spline routing entry point (internal, with normalize flag).
 *
 * Performs straight-line edge routing via routeDotEdges, then normalizes
 * spline orientation when normalize=true. The full pathplan-based obstacle
 * routing (routesplines, boxes, clip_and_install) is deferred.
 *
 * @see lib/dotgen/dotsplines.c:dot_splines_
 */
export function dotSplines_(g: Graph, normalize: boolean): number {
  if (edgeType(g) === EDGETYPE_NONE) return 0;
  markLowclusters(g);
  const edges: Edge[] = [];
  for (const n of g.nodes.values()) collectNodeEdges(n, edges);
  edges.sort(edgecmp);
  const multisep = g.info.nodesep ?? 18;
  for (let l = 0; l < edges.length;) {
    l += routeEdgeGroup(g, edges, l, multisep);
  }
  // Place regular edge labels from virtual nodes; expand bb per label.
  // @see lib/dotgen/dotsplines.c:422-430
  placeRegularEdgeLabels(g);
  if (normalize) edgeNormalize(g);
  routeDotEdges(g);
  placePortLabels(g);
  // Mirror lib/dotgen/dotsplines.c:471 — State = GVSPLINES; EdgeLabelsDone = 1
  g.info.edgeLabelsDone = true;
  return 0;
}

/**
 * Entry point called by the dot layout pipeline.
 * @see lib/dotgen/dotsplines.c:dot_splines
 */
export function dotSplines(g: Graph): number {
  return dotSplines_(g, true);
}
