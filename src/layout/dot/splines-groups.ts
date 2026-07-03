// SPDX-License-Identifier: EPL-2.0

/**
 * Edge-group formation and dispatch for the dot_splines_ routing loop —
 * C's inner group loop (groupSize) and the per-group router selection.
 *
 * @see lib/dotgen/dotsplines.c:dot_splines_ (343-419)
 */

import type { Graph } from '../../model/graph.js';
import type { Edge } from '../../model/edge.js';
import type { TextlabelT } from '../../common/types.js';
import {
  getMainEdge, resolveOrigEdge, portcmp, gatePorts, edgeTreeIndex, nodeRankOf,
  swapEndsP, swapEdgeSpline, EDGETYPE_CURVED, EDGETYPEMASK, FLATEDGE, MAINGRAPH,
} from './splines.js';
import { routeLoneEdge } from './edge-route.js';
import { routeEntryRun } from './edge-route-chain.js';
import { routeSelfEdgeGroup, buildDotSinfo } from './self-loop.js';
import { updateBB } from './splines-label.js';
import { routeParallelEdgeGroup } from './splines-route.js';
import { makeStraightEdges } from './straight-edges.js';

/** Per-loop routing context: separations, edge type, per-run orig record. */
export interface GroupRouteCtx {
  multisep: number;
  et: number;
  /** Originals that received per-run bezier appends (normalized post-loop). */
  runOrigs: Set<Edge>;
}

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
 * routeParallelEdgeGroup (Multisep offsets); cross-rank cnt==1 → per-run or
 * whole-chain lone routing in-place (C order); same-rank flat → left for the
 * routeDotEdges sweep.
 * @see lib/dotgen/dotsplines.c:367-419
 */
function dispatchEdgeGroup(g: Graph, group: Edge[], ctx: GroupRouteCtx): void {
  const e0 = group[0];
  if (e0.tail === e0.head) {
    routeSelfEdgeGroup(g, group, group.length, ctx.multisep, buildDotSinfo());
    // Grow the graph bbox to include each labeled self-loop's label. C does this
    // after makeSelfEdge; it is the ONLY canvas-growth path for left/top loops
    // (right-going loops also reserve label space at ranking time via
    // selfRightSpace, so they grow without it). @see dotsplines.c:405-409
    for (const e of group) {
      const l = e.info.label as TextlabelT | undefined;
      if (l) updateBB(g, l);
    }
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
      ctx.runOrigs.add(runOrig);
      return;
    }
    const lone = resolveOrigEdge(uniq[0]);
    // Plain chains (no interior splineMerge boundary) keep the whole-chain
    // routers. @see dotsplines.c:make_regular_edge (spline_merge)
    routeLoneEdge(lone, g);
    return;
  }
  // Lane offsets follow the edgecmp collected order — C passes the sorted list
  // slice straight into make_regular_edge with NO re-sort, so the MAINGRAPH
  // forward rep gets lane 0 (interior x -dx) and AUXGRAPH ND_other entries
  // (including an opposing 2-cycle's reversed member) follow, regardless of
  // original creation seq. @see dotsplines.c:419, make_regular_edge:1885-1907
  routeParallelEdgeGroup(g, uniq, ctx.multisep);
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
    if (swapEndsP(e)) swapEdgeSpline(e);
  }
}

/**
 * Route one parallel-edge group from the sorted edge list.
 * Returns the number of edges consumed (cnt). For `splines=curved` the group is
 * routed via `makeStraightEdges` instead of the normal per-group router.
 * @see lib/dotgen/dotsplines.c:343-419
 */
function routeEdgeGroup(g: Graph, edges: Edge[], ind: number, ctx: GroupRouteCtx): number {
  const cnt = groupSize(edges, ind);
  if (ctx.et === EDGETYPE_CURVED) {
    routeCurvedGroup(g, edges.slice(ind, ind + cnt));
    return cnt;
  }
  dispatchEdgeGroup(g, edges.slice(ind, ind + cnt), ctx);
  return cnt;
}

/**
 * Run the whole group-routing loop over the sorted edge list; returns the set
 * of originals that received per-run bezier appends, for the caller's
 * post-loop normalize pass. @see lib/dotgen/dotsplines.c:dot_splines_ (343-419)
 */
export function routeEdgeGroups(g: Graph, edges: Edge[], multisep: number, et: number): Set<Edge> {
  const ctx: GroupRouteCtx = { multisep, et, runOrigs: new Set<Edge>() };
  for (let l = 0; l < edges.length;) l += routeEdgeGroup(g, edges, l, ctx);
  return ctx.runOrigs;
}
