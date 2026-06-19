// SPDX-License-Identifier: EPL-2.0

/**
 * Compound edge support — clips splines to cluster bounding boxes.
 *
 * @see lib/dotgen/compound.c
 */

import type { Point, Box, Bezier } from '../../model/geom.js';
import type { Graph } from '../../model/graph.js';
import type { Edge } from '../../model/edge.js';
import {
  inBoxf, midPointf, splineIntersectf, boxIntersectf,
} from './compound-clip.js';

// Re-export geometry helpers so existing callers (tests) import from one place.
export {
  fcmp, inBoxf, midPointf, casteljauStep, subdivideBezier,
  countVertCross, countHorzCross, tryUpdateIntersect,
  splineIntersectf,
  tryLeftSide, tryRightSide, tryBottomSide, tryTopSide, boxIntersectf,
} from './compound-clip.js';

// ---------------------------------------------------------------------------
// Cluster map
// ---------------------------------------------------------------------------

/** Recursively populate name→cluster map. @see lib/common/utils.c:fillMap */
export function fillClustMap(g: Graph, map: Map<string, Graph>): void {
  const nc = g.info.n_cluster ?? 0;
  for (let c = 1; c <= nc; c++) {
    const cl = g.info.clust![c - 1];
    if (!map.has(cl.name)) map.set(cl.name, cl);
    fillClustMap(cl, map);
  }
}

/** Build a name→cluster map for all clusters reachable from g. @see lib/common/utils.c:mkClustMap */
export function mkClustMap(g: Graph): Map<string, Graph> {
  const map = new Map<string, Graph>();
  fillClustMap(g, map);
  return map;
}

// ---------------------------------------------------------------------------
// ClipState — shared between head/tail clip helpers
// ---------------------------------------------------------------------------

interface ClipState { bez: Bezier; size: number; endi: number; starti: number; }

// ---------------------------------------------------------------------------
// Head clip
// ---------------------------------------------------------------------------

/** Degenerate head clip: first control point already inside cluster bb. */
export function clipHeadDegenerate(state: ClipState, bb: Box, ep: Point): void {
  const { bez } = state;
  const p = boxIntersectf(bez.list[0], ep, bb);
  bez.list[3] = p;
  bez.list[1] = midPointf(p, ep);
  bez.list[0] = midPointf(bez.list[1], ep);
  bez.list[2] = midPointf(bez.list[1], p);
  state.endi = 3;
}

/** Normal head clip: scan forward for first segment exiting cluster bb. */
export function clipHeadNormal(state: ClipState, bb: Box): void {
  const { bez, size } = state;
  for (state.endi = 0; state.endi < size - 1; state.endi += 3) {
    const seg: Point[] = [0, 1, 2, 3].map(k => ({ ...bez.list[state.endi + k] }));
    if (splineIntersectf(seg, bb)) {
      for (let k = 0; k < 4; k++) bez.list[state.endi + k] = seg[k];
      break;
    }
  }
  if (state.endi === size - 1 && bez.eflag) {
    bez.ep = boxIntersectf(bez.ep, bez.list[state.endi], bb);
  } else if (state.endi < size - 1) {
    state.endi += 3;
  }
}

/** Apply head clip when head node coord is inside cluster bb. */
export function applyHeadClip(state: ClipState, bb: Box): boolean {
  if (inBoxf(state.bez.list[0], bb)) {
    if (state.bez.sflag && !inBoxf(state.bez.sp, bb)) {
      clipHeadDegenerate(state, bb, state.bez.sp);
      return true;
    }
    return false;
  }
  clipHeadNormal(state, bb);
  return true;
}

/** Clip head end of edge; returns true when clipping was applied. @see lib/dotgen/compound.c */
export function clipHead(state: ClipState, bb: Box, headInBox: boolean): boolean {
  if (!headInBox) return false;
  return applyHeadClip(state, bb);
}

// ---------------------------------------------------------------------------
// Tail clip
// ---------------------------------------------------------------------------

/** Degenerate tail clip: last selected control point is inside cluster bb. */
export function clipTailDegenerate(state: ClipState, bb: Box): void {
  const { bez } = state;
  const ep = bez.ep;
  const p = boxIntersectf(bez.list[state.endi], ep, bb);
  state.starti = state.endi - 3;
  const si = state.starti;
  bez.list[si] = p;
  bez.list[si + 2] = midPointf(p, ep);
  bez.list[si + 3] = midPointf(bez.list[si + 2], ep);
  bez.list[si + 1] = midPointf(bez.list[si + 2], p);
}

/** Normal tail clip: scan backward for last segment exiting cluster bb. */
export function clipTailNormal(state: ClipState, bb: Box): void {
  const { bez } = state;
  for (state.starti = state.endi; state.starti > 0; state.starti -= 3) {
    const pts: Point[] = [0, 1, 2, 3].map(k => ({ ...bez.list[state.starti - k] }));
    if (splineIntersectf(pts, bb)) {
      for (let k = 0; k < 4; k++) bez.list[state.starti - k] = pts[k];
      break;
    }
  }
  if (state.starti === 0 && bez.sflag) {
    bez.sp = boxIntersectf(bez.sp, bez.list[state.starti], bb);
  } else if (state.starti !== 0) {
    state.starti -= 3;
  }
}

/** Apply tail clip. */
export function applyTailClip(state: ClipState, bb: Box): boolean {
  if (inBoxf(state.bez.list[state.endi], bb)) {
    if (state.bez.eflag && !inBoxf(state.bez.ep, bb)) {
      clipTailDegenerate(state, bb);
      return true;
    }
    return false;
  }
  clipTailNormal(state, bb);
  return true;
}

/** Clip tail end of edge; returns true when clipping was applied. @see lib/dotgen/compound.c */
export function clipTail(state: ClipState, bb: Box, tailInBox: boolean): boolean {
  if (!tailInBox) return false;
  return applyTailClip(state, bb);
}

// ---------------------------------------------------------------------------
// makeCompoundEdge helpers
// ---------------------------------------------------------------------------

/** Resolve lhead/ltail names to cluster graphs. */
/** Resolve a cluster name to its subgraph, or null. */
function resolveCluster(name: string | undefined, clustMap: Map<string, Graph>): Graph | null {
  return name ? (clustMap.get(name) ?? null) : null;
}

export function resolveClusterPair(
  e: Edge, clustMap: Map<string, Graph>,
): { lh: Graph | null; lt: Graph | null } {
  // C reads lhead/ltail via agget(e,...). @see lib/dotgen/compound.c:274-275
  // The e.info fallback supports unit tests that set the field directly.
  const lhead = e.attrs.get('lhead') ?? e.info.lhead;
  const ltail = e.attrs.get('ltail') ?? e.info.ltail;
  return { lh: resolveCluster(lhead, clustMap), lt: resolveCluster(ltail, clustMap) };
}

/** Returns false when edge is not eligible for compound clipping. */
export function isCompoundEdgeEligible(e: Edge): boolean {
  if (!e.info.spl) return false;
  return e.info.spl.size <= 1;
}

/** Replace bez.list with the trimmed slice [starti..endi]. */
export function applyBezierSlice(state: ClipState): void {
  const { bez, endi, starti } = state;
  const newList: Point[] = [];
  for (let j = starti; j <= endi; j++) newList.push({ ...bez.list[j] });
  bez.list = newList;
  bez.size = newList.length;
}

/**
 * Clip the spline for edge e against its lhead/ltail cluster bounding boxes.
 *
 * NOTE: clips the spline PATH only. The arrowhead is NOT re-clipped — when an
 * lhead/ltail moves the head/tail endpoint, the cached arrow polygon
 * (e.info._arrowPts) still reflects the original node-boundary tip. Faithful
 * arrow re-clipping needs a port of C's index-form arrowEndClip (arrows.c) with
 * its bezier_clip subdivision; see plans/dot-curved-compound/quarantine/.
 * @see lib/dotgen/compound.c:makeCompoundEdge
 */
export function makeCompoundEdge(e: Edge, clustMap: Map<string, Graph>): void {
  const { lh, lt } = resolveClusterPair(e, clustMap);
  if (!lh && !lt) return;
  if (!isCompoundEdgeEligible(e)) return;
  const bez = e.info.spl!.list[0];
  const state: ClipState = { bez, size: bez.size, endi: 0, starti: 0 };
  if (lh != null) {
    if (!clipHead(state, lh.info.bb!, inBoxf(e.head.info.coord, lh.info.bb!)))
      state.endi = state.size - 1;
  } else {
    state.endi = state.size - 1;
  }
  if (lt != null) clipTail(state, lt.info.bb!, inBoxf(e.tail.info.coord, lt.info.bb!));
  applyBezierSlice(state);
}

// ---------------------------------------------------------------------------
// dotCompoundEdges — public entry point
// ---------------------------------------------------------------------------

/**
 * Clip splines at cluster boundaries for edges with lhead/ltail attributes.
 * @see lib/dotgen/compound.c:dot_compoundEdges
 */
export function dotCompoundEdges(g: Graph): void {
  // No internal gate — the caller checks mapbool(agget(g,"compound")), matching
  // C where dot_compoundEdges itself is unconditional. @see lib/dotgen/compound.c:434
  const clustMap = mkClustMap(g);
  for (const e of g.edges) makeCompoundEdge(e, clustMap);
}
