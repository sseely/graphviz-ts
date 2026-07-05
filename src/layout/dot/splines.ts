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
import type { Bezier, Spline, Port } from '../../model/geom.js';
import { VIRTUAL, NORMAL, FLATORDER } from './fastgr.js';
import { gvQsort } from '../../util/bsd-qsort.js';
import { IGNORED, EDGE_LABEL } from './rank.js';
import { markLowclusters } from './cluster.js';
import { routeDotEdges } from './edge-route.js';
import { collectOtherEdges } from './self-loop.js';
import { resetSplineBounds } from './edge-route-rank.js';
import { dispatchOrthoEdges } from './ortho-adapter.js';
import { routeEdgeGroups } from './splines-groups.js';
import { placePortLabels, placeRegularEdgeLabels, setEdgeLabelPos } from './splines-label.js';
import { nodesInSeq } from './decomp.js';

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

// C encodes these as (n << 1); this port uses the compact ordinal n and stores
// it in the low nibble of GD_flags (see setEdgeType). Internally consistent.
export const EDGETYPE_NONE     = 0;
export const EDGETYPE_LINE     = 1;
export const EDGETYPE_CURVED   = 2;
export const EDGETYPE_PLINE    = 3;
export const EDGETYPE_ORTHO    = 4;
export const EDGETYPE_SPLINE   = 5;
export const EDGETYPE_COMPOUND = 6;

/** Read edge type from graph flags. @see lib/common/const.h:EDGE_TYPE */
export function edgeType(g: Graph): number {
  return g.info.flags & 0xf;
}

/** Named string → edge type, for the `splines` attribute. @see lib/common/utils.c:edgeType */
const SPLINES_TYPE_MAP: Record<string, number> = {
  curved: EDGETYPE_CURVED, compound: EDGETYPE_COMPOUND, false: EDGETYPE_LINE,
  line: EDGETYPE_LINE, none: EDGETYPE_NONE, no: EDGETYPE_LINE, ortho: EDGETYPE_ORTHO,
  polyline: EDGETYPE_PLINE, spline: EDGETYPE_SPLINE, true: EDGETYPE_SPLINE, yes: EDGETYPE_SPLINE,
};

/**
 * Map a `splines` attribute value to an edge type. `0`/`false`/`line`/`no` →
 * LINE; a leading digit 1-9 / `true`/`yes`/`spline` → SPLINE; named values per
 * the map; anything else → defaultValue. @see lib/common/utils.c:edgeType
 */
export function edgeTypeFromString(s: string, defaultValue: number): number {
  if (s === '') return defaultValue;
  if (s[0] === '0') return EDGETYPE_LINE;
  if (s[0] >= '1' && s[0] <= '9') return EDGETYPE_SPLINE;
  const mapped = SPLINES_TYPE_MAP[s.toLowerCase()];
  return mapped !== undefined ? mapped : defaultValue;
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

/**
 * portcmp: undefined sorts before defined; defined ports order by (x, y).
 * @see lib/dotgen/dotsplines.c:portcmp
 */
export function portcmp(p0: Port, p1: Port): number {
  if (!p1.defined) return p0.defined ? 1 : 0;
  if (!p0.defined) return -1;
  if (p0.p.x < p1.p.x) return -1;
  if (p0.p.x > p1.p.x) return 1;
  if (p0.p.y < p1.p.y) return -1;
  if (p0.p.y > p1.p.y) return 1;
  return 0;
}

/**
 * Gate-edge ports in forward orientation: C picks ea = e when e carries a
 * defined port, else its main edge, then views a BWDEDGE through makefwdedge
 * (which swaps tail/head ports). Only the ports matter for comparison.
 * @see lib/dotgen/dotsplines.c:edgecmp, dot_splines_ (ea/eb selection)
 */
export function gatePorts(e: Edge, le: Edge): [Port, Port] {
  const ea = e.info.tail_port.defined || e.info.head_port.defined ? e : le;
  if (edgeTreeIndex(ea) & BWDEDGE) return [ea.info.head_port, ea.info.tail_port];
  return [ea.info.tail_port, ea.info.head_port];
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
  const [eaT, eaH] = gatePorts(e0, le0);
  const [ebT, ebH] = gatePorts(e1, le1);
  const pt = portcmp(eaT, ebT);
  if (pt !== 0) return pt;
  const ph = portcmp(eaH, ebH);
  if (ph !== 0) return ph;
  const gt = numCmp(edgeTreeIndex(e0) & GRAPHTYPEMASK, edgeTreeIndex(e1) & GRAPHTYPEMASK);
  if (gt !== 0) return gt;
  // C also orders same-key FLAT edges by ED_label pointer; label identity has
  // no stable order in TS, and flat groups still break on label in groupSize.
  return numCmp(e0.seq, e1.seq);
}

// ---------------------------------------------------------------------------
// swap_bezier / swap_spline / edge_normalize
// @see lib/dotgen/dotsplines.c:swap_bezier, swap_spline, edge_normalize
// ---------------------------------------------------------------------------

/**
 * Reverse bezier control points and swap sflag/eflag, sp/ep.
 *
 * b.list may be over-allocated beyond b.size (newSpline pre-allocates pn
 * slots; clip can shrink the real point count, leaving zeroed spare slots
 * calloc'd at the tail). Only the bounded window list[0, size) holds real
 * points, so the reverse must be an index-swap loop over that window —
 * NOT a whole-array reverse, which would rotate the zeroed spares to the
 * front. @see lib/dotgen/dotsplines.c:144-148 (swap_bezier)
 */
export function swapBezier(b: Bezier): void {
  const sz = b.size;
  for (let i = 0; i < Math.floor(sz / 2); i++) {
    const tmp = b.list[i];
    b.list[i] = b.list[sz - 1 - i];
    b.list[sz - 1 - i] = tmp;
  }
  const sf = b.sflag; b.sflag = b.eflag; b.eflag = sf;
  const sp = b.sp; b.sp = b.ep; b.ep = sp;
}

/** Reverse the list of beziers in a spline and swap each bezier. */
export function swapSpline(s: Spline): void {
  s.list.reverse();
  for (const bz of s.list) swapBezier(bz);
}

/**
 * Swap an edge's spline AND its precomputed arrow-op slots. C regenerates
 * arrows at emit time from each bezier's sp/ep + s/eflag, so swap_bezier's
 * flag swap is complete there; the port precomputes arrow ops per edge END
 * (tail/head slots) at clip time, so a spline swap must swap the slots too or
 * the flag↔ops pairing breaks — on a multi-bezier reversed edge the per-bezier
 * arrow interleave then finds no matching ops and the arrow falls to the
 * group end ([path, path, arrow] vs C's [path, arrow, path]; b15
 * LandVertical/Fall/HoverStrafeToStop groups).
 * @see lib/dotgen/dotsplines.c:swap_bezier (sflag/eflag swap)
 */
export function swapEdgeSpline(e: Edge): void {
  if (e.info.spl === undefined) return;
  swapSpline(e.info.spl);
  const t = e.info.tailArrowOps;
  e.info.tailArrowOps = e.info.headArrowOps;
  e.info.headArrowOps = t;
}

/**
 * Normalize splines so they always go from tail to head.
 * @see lib/dotgen/dotsplines.c:edge_normalize
 */
export function edgeNormalize(g: Graph): void {
  for (const n of nodesInSeq(g)) {
    for (let k = 0; k < (n.info.out?.size ?? 0); k++) {
      const e = n.info.out!.list[k];
      if (swapEndsP(e)) swapEdgeSpline(e);
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

/**
 * Collect routing edges by iterating the rank array (`minrank..maxrank`,
 * `v[0..n-1]`), null-guarding empty `.v` slots exactly as C does. This visits
 * VIRTUAL `splineMerge` nodes in addition to NORMAL nodes, so the merged
 * secondary chains that a `concentrate` DOWN-sweep rewires onto a virtual merge
 * node's out-list are gathered and routed (they are absent from `g.nodes`).
 * `nodeNeedsRouting` still gates each node to NORMAL || splineMerge.
 * @see lib/dotgen/dotsplines.c:dot_splines_ (281-320)
 */
export function collectRankEdges(g: Graph, edges: Edge[]): void {
  const ranks = g.info.rank;
  // No rank table (never happens for a laid-out dot graph): fall back to the
  // node map so a degenerate graph still collects its NORMAL out-edges.
  if (ranks === undefined || g.info.minrank === undefined || g.info.maxrank === undefined) {
    for (const n of g.nodes.values()) collectNodeEdges(n, edges);
    return;
  }
  for (let i = g.info.minrank; i <= g.info.maxrank; i++) {
    const rk = ranks[i];
    if (rk === undefined) continue;
    for (let j = 0; j < rk.n; j++) {
      const n = rk.v[j];
      if (n == null) continue; // C guards GD_rank(g)[i].v[j] slots
      collectNodeEdges(n, edges);
    }
  }
}

// ---------------------------------------------------------------------------
// dot_splines_ / dot_splines — main entry points
// @see lib/dotgen/dotsplines.c:dot_splines_, dot_splines
// ---------------------------------------------------------------------------

/**
 * Main spline routing entry point (internal, with normalize flag).
 *
 * Performs straight-line edge routing via routeDotEdges, then normalizes
 * spline orientation when normalize=true. The full pathplan-based obstacle
 * routing (routesplines, boxes, clip_and_install) is deferred.
 *
 * @see lib/dotgen/dotsplines.c:dot_splines_
 */
/**
 * In position, each node's rw was stored in mval and rw may have been
 * increased to reflect loops/labels; restore the original rw here.
 * @see lib/dotgen/dotsplines.c:resetRW
 */
export function resetRW(g: Graph): void {
  for (const n of nodesInSeq(g)) {
    // C: if (ND_other(n).list) — non-NULL list iff non-flat/non-tree edges exist
    if (n.info.other && n.info.other.list.length > 0) {
      const tmp = n.info.rw;
      n.info.rw = n.info.mval ?? 0;
      n.info.mval = tmp;
    }
  }
}

/**
 * splines=ortho dispatch — mirror dotsplines.c:251-259: resetRW, run the
 * orthoEdges pipeline (before mark_lowclusters), then the finish semantics
 * (skip routesplinesterm — not ported in TS; set edgeLabelsDone; return 0).
 * Edge-label sub-case is T2.
 * @see lib/dotgen/dotsplines.c:dot_splines_ (EDGETYPE_ORTHO branch)
 */
function orthoDispatch(g: Graph): number {
  resetRW(g);
  // C: if (GD_has_labels(g->root) & EDGE_LABEL) { setEdgeLabelPos(g);
  //      orthoEdges(g,true); } else orthoEdges(g,false);
  // orthoEdges itself warns + downgrades useLbls (ortho/index.ts) — C never
  // routes edges around labels (ADR-2). We only POSITION the labels here.
  if (((g.root.info.has_labels ?? 0) & EDGE_LABEL) !== 0) {
    setEdgeLabelPos(g);
    dispatchOrthoEdges(g, true);
  } else {
    dispatchOrthoEdges(g, false);
  }
  // C's `goto finish` lands ON the port-label placement block
  // (dotsplines.c:436-458): head/tail labels with labelangle/labeldistance
  // are placed via place_portlabel for ortho too. Skipping this left the
  // labels unset, so the xlabels pass placed them instead (144_ortho).
  placePortLabels(g);
  g.info.edgeLabelsDone = true;
  return 0;
}

/**
 * splines=curved top wiring: restore node rw, and warn (but do NOT downgrade —
 * curved still routes) when edge labels are present.
 * @see lib/dotgen/dotsplines.c:241-247 (ADR-3)
 */
function curvedTop(g: Graph): void {
  resetRW(g);
  if (((g.root.info.has_labels ?? 0) & EDGE_LABEL) !== 0) {
    console.warn('edge labels with splines=curved not supported in dot - use xlabels\n');
  }
}

/**
 * Post-loop: vnode labels, normalize, routeDotEdges backstop (curved already
 * routed its groups; C skips routesplinesterm), port labels. @see c:422-471
 */
function finalizeSplines(g: Graph, et: number, normalize: boolean): void {
  placeRegularEdgeLabels(g);
  if (normalize) edgeNormalize(g);
  if (et !== EDGETYPE_CURVED) routeDotEdges(g);
  placePortLabels(g);
  g.info.edgeLabelsDone = true; // @see dotsplines.c:471 (EdgeLabelsDone = 1)
}

export function dotSplines_(g: Graph, normalize: boolean): number {
  const et = edgeType(g);
  if (et === EDGETYPE_NONE) return 0;
  if (et === EDGETYPE_ORTHO) return orthoDispatch(g);
  if (et === EDGETYPE_CURVED) curvedTop(g);
  markLowclusters(g);
  // C computes `spline_info_t sd` fresh here, once per call (dotsplines.c:248,
  // 270-282), then threads it through every routing helper for this pass.
  // Force the next getSplineBounds(g) access to recompute so this pass sees
  // a frozen snapshot immune to recoverSlack/resizeVn vnode mutations from
  // edges routed earlier in THIS SAME pass. @see edge-route-rank.ts:getSplineBounds
  resetSplineBounds(g);
  const edges: Edge[] = [];
  collectRankEdges(g, edges);
  // C sorts with libc qsort (LIST_SORT → gv_list_sort_ → qsort), which is
  // UNSTABLE: the two MAINGRAPH entries of one concentrate-merged original
  // compare equal all the way through edgecmp (same main edge, same copied
  // AGSEQ), and the Bentley-McIlroy permutation decides which run is routed
  // — and therefore which bezier clip_and_install appends — first (b69).
  // A stable Array.sort keeps collection order instead; gvQsort reproduces
  // the oracle's qsort permutation. @see util/bsd-qsort.ts (TB_balance)
  gvQsort(edges, edgecmp);
  // C places line-edge labels BEFORE the routing loop (dotsplines.c:334-340) so
  // the line router reads final label positions; lone edges now route in-loop.
  if (et === EDGETYPE_LINE) placeRegularEdgeLabels(g);
  const runOrigs = routeEdgeGroups(g, edges, g.info.nodesep ?? 18, et);
  if (normalize) normalizeRunOrigs(runOrigs);
  finalizeSplines(g, et, normalize);
  return 0;
}

/**
 * Normalize the per-run assembled splines tail→head, once per orig — C's
 * edge_normalize covers these via the cgraph edge lists; the port's
 * edgeNormalize walks the fast graph only, and back-edge origs whose chain
 * was routed per-run live in ND_other, so swap them here.
 * @see lib/dotgen/dotsplines.c:edge_normalize
 */
function normalizeRunOrigs(runOrigs: Set<Edge>): void {
  for (const o of runOrigs) {
    if (swapEndsP(o)) swapEdgeSpline(o);
  }
}

/**
 * Entry point called by the dot layout pipeline.
 * @see lib/dotgen/dotsplines.c:dot_splines
 */
export function dotSplines(g: Graph): number {
  return dotSplines_(g, true);
}
