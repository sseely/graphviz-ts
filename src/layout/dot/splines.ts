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
import { IGNORED, EDGE_LABEL } from './rank.js';
import { markLowclusters } from './cluster.js';
import { routeDotEdges, routeLoneEdge } from './edge-route.js';
import { routeEntryRun } from './edge-route-chain.js';
import { collectOtherEdges, routeSelfEdgeGroup, buildDotSinfo } from './self-loop.js';
import { dispatchOrthoEdges } from './ortho-adapter.js';
import { routeParallelEdgeGroup } from './splines-route.js';
import { placePortLabels, placeRegularEdgeLabels, setEdgeLabelPos } from './splines-label.js';
import { makeStraightEdges } from './straight-edges.js';

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
function gatePorts(e: Edge, le: Edge): [Port, Port] {
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
 * Count how many consecutive entries in `edges` starting at `ind` join one
 * routing group — C's inner group loop verbatim: break on a different main
 * edge; flat ED_adjacent groups take everything at once; otherwise break on a
 * tail/head portcmp mismatch (gate edges viewed forward), on a FLAT label
 * change, or when the candidate carries MAINGRAPH ("Aha! -C is on"): under
 * concentrate, consecutive same-main REGULAREDGE entries are merge-bounded
 * chain runs that must each route their own make_regular_edge call, while
 * AUXGRAPH copies (parallel multi-edges from ND_other) still group.
 * @see lib/dotgen/dotsplines.c:dot_splines_ (344-376)
 */
function groupSize(edges: Edge[], ind: number): number {
  const e0 = edges[ind];
  const le0 = getMainEdge(e0);
  const [eaT, eaH] = gatePorts(e0, le0);
  const e0flat = (edgeTreeIndex(e0) & EDGETYPEMASK) === FLATEDGE;
  let cnt = 1;
  while (ind + cnt < edges.length) {
    const e1 = edges[ind + cnt];
    const le1 = getMainEdge(e1);
    if (le1 !== le0) break;
    if ((e0.info.adjacent ?? 0) !== 0) { cnt++; continue; } // all flat adjacent at once
    const [ebT, ebH] = gatePorts(e1, le1);
    if (portcmp(eaT, ebT) !== 0) break;
    if (portcmp(eaH, ebH) !== 0) break;
    if (e0flat && e0.info.label !== e1.info.label) break;
    if ((edgeTreeIndex(e1) & MAINGRAPH) !== 0) break; // Aha! -C is on
    cnt++;
  }
  return cnt;
}

/** Original-edge creation seq (resolve virtuals) — restores C's edgecmp order. */
function origSeq(e: Edge): number { return resolveOrigEdge(e).seq; }

/**
 * Collapse a main-edge group to one representative per distinct original edge.
 * The opposing `a->b`/`b->a` case collects three entries but two distinct
 * originals; dedup by `resolveOrigEdge` yields one per original (parallels
 * untouched). @see dotsplines.c:make_regular_edge (one clip_and_install per orig)
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
 * Dispatch one edgecmp group: self-loop → routeSelfEdgeGroup; cross-rank cnt>1 →
 * routeParallelEdgeGroup (Multisep offsets); cross-rank cnt==1 → routeLoneEdge
 * in-place (C order); same-rank flat → left for the routeDotEdges sweep.
 * @see lib/dotgen/dotsplines.c:367-419
 */
function dispatchEdgeGroup(g: Graph, group: Edge[], multisep: number, runOrigs: Set<Edge>): void {
  const e0 = group[0];
  if (e0.tail === e0.head) {
    routeSelfEdgeGroup(g, group, group.length, multisep, buildDotSinfo());
    return;
  }
  if (nodeRankOf(e0.tail) === nodeRankOf(e0.head)) return;
  const uniq = dedupByOrig(group);
  // Lone edge: route HERE at its edgecmp position (interleaved with groups), as C
  // does, so it reads recover_slack-moved vnodes correctly. @see root-cause.md
  if (uniq.length <= 1) {
    // Concentrate merge-bounded partial run (either end at a splineMerge node):
    // route ONLY this entry's run and append its bezier on the orig — every
    // such run is its own cnt=1 group (groupSize's MAINGRAPH break), and the
    // orig's spline accumulates one bezier per run in edgecmp order, exactly
    // C's per-entry make_regular_edge + clip_and_install. The orig is recorded
    // for the post-loop swap (C normalizes the assembled spline once, at the
    // end). @see lib/dotgen/dotsplines.c:dot_splines_ (group loop)
    const runOrig = routeEntryRun(g, e0);
    if (runOrig !== null) {
      runOrigs.add(runOrig);
      return;
    }
    const lone = resolveOrigEdge(uniq[0]);
    // Plain chains (no interior splineMerge boundary) keep the whole-chain
    // routers. @see dotsplines.c:make_regular_edge (spline_merge)
    routeLoneEdge(lone, g);
    return;
  }
  // Sort by original seq so the first original gets the leftmost offset, matching
  // C's allocation order (e1<e2<e3). @see dotsplines.c:make_regular_edge:1885-1907
  uniq.sort((a, b) => origSeq(a) - origSeq(b));
  routeParallelEdgeGroup(g, uniq, multisep);
}

/**
 * Route one curved group via makeStraightEdges. C routes the whole same-endpoint
 * group at once — parallels AND opposing edges (`a->b`/`b->a`) together (a 2-cycle
 * is one cnt=2 group, ports (0,0); the visible separation is perp-spread clipped
 * to the node). Dedup the TS virtual duplicates to distinct originals; sort by
 * creation seq so index→perp-offset matches C (first → +perp); makeStraightEdges
 * reverses the opposing edge's control points via its head==group-head check.
 * @see lib/dotgen/dotsplines.c:381-387, lib/common/routespl.c:1000-1041
 */
function routeCurvedGroup(g: Graph, group: Edge[]): void {
  const uniq = dedupByOrig(group);
  uniq.sort((a, b) => origSeq(a) - origSeq(b));
  makeStraightEdges(g, uniq, uniq.length, EDGETYPE_CURVED, buildDotSinfo());
  // Reversed back edges live in ND_other (edgeNormalize skips them); swap here.
  for (const e of uniq) {
    if (swapEndsP(e) && e.info.spl) swapSpline(e.info.spl);
  }
}

/**
 * Route one parallel-edge group from the sorted edge list.
 * Returns the number of edges consumed (cnt). For `splines=curved` the group is
 * routed via `makeStraightEdges` instead of the normal per-group router.
 * @see lib/dotgen/dotsplines.c:343-419
 */
function routeEdgeGroup(
  g: Graph, edges: Edge[], ind: number, multisep: number, et: number, runOrigs: Set<Edge>,
): number {
  const cnt = groupSize(edges, ind);
  if (et === EDGETYPE_CURVED) {
    routeCurvedGroup(g, edges.slice(ind, ind + cnt));
    return cnt;
  }
  dispatchEdgeGroup(g, edges.slice(ind, ind + cnt), multisep, runOrigs);
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
/**
 * In position, each node's rw was stored in mval and rw may have been
 * increased to reflect loops/labels; restore the original rw here.
 * @see lib/dotgen/dotsplines.c:resetRW
 */
export function resetRW(g: Graph): void {
  for (const n of g.nodes.values()) {
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
  const edges: Edge[] = [];
  collectRankEdges(g, edges);
  edges.sort(edgecmp);
  // C places line-edge labels BEFORE the routing loop (dotsplines.c:334-340) so
  // the line router reads final label positions; lone edges now route in-loop.
  if (et === EDGETYPE_LINE) placeRegularEdgeLabels(g);
  const multisep = g.info.nodesep ?? 18;
  const runOrigs = new Set<Edge>();
  for (let l = 0; l < edges.length;) l += routeEdgeGroup(g, edges, l, multisep, et, runOrigs);
  // Normalize the per-run assembled splines tail→head, once per orig — C's
  // edge_normalize covers these via the cgraph edge lists; the port's
  // edgeNormalize walks the fast graph only, and back-edge origs whose chain
  // was routed per-run live in ND_other, so swap them here.
  // @see lib/dotgen/dotsplines.c:edge_normalize
  if (normalize) {
    for (const o of runOrigs) {
      if (swapEndsP(o) && o.info.spl !== undefined) swapSpline(o.info.spl);
    }
  }
  finalizeSplines(g, et, normalize);
  return 0;
}

/**
 * Entry point called by the dot layout pipeline.
 * @see lib/dotgen/dotsplines.c:dot_splines
 */
export function dotSplines(g: Graph): number {
  return dotSplines_(g, true);
}
