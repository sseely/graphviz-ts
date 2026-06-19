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
import { arrowEndClip, tailArrowEndClip } from './edge-route-clip.js';
import { arrowheadPolygon } from './edge-route-arrow.js';
import { normalArrowLen } from './edge-route-routing.js';
import { edgePenwidthAttr, edgeRenderPenwidth } from './edge-route-helpers.js';
import { dist } from '../../common/arrows-geometry.js';

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

interface ClipState { e: Edge; bez: Bezier; size: number; endi: number; starti: number; }

// ---------------------------------------------------------------------------
// Arrowhead clip (index form) — back the spline off to the arrowhead base and
// record the tip in bez.ep/sp. @see lib/common/arrows.c:arrowEndClip,arrowStartClip
// ---------------------------------------------------------------------------

/**
 * Clip the head segment ps[endp..endp+3] to the arrowhead base; set bez.ep/eflag.
 * Backs up one segment when the last is shorter than the arrow. Returns the new
 * endp. @see lib/common/arrows.c:arrowEndClip
 */
function arrowEndClipIdx(state: ClipState, endp: number): number {
  const { e, bez } = state;
  const elen = normalArrowLen(edgePenwidthAttr(e));
  bez.eflag = bez.eflag || 1;
  bez.ep = { ...bez.list[endp + 3] };
  if (endp > state.starti && dist(bez.list[endp], bez.list[endp + 3]) < elen) endp -= 3;
  const seg = [bez.list[endp], bez.list[endp + 1], bez.list[endp + 2], bez.list[endp + 3]];
  const clipped = arrowEndClip(seg, bez.ep, elen);
  for (let k = 0; k < 4; k++) bez.list[endp + k] = clipped[k];
  return endp;
}

/**
 * Clip the tail segment ps[startp..startp+3] to the tail arrowhead base; set
 * bez.sp/sflag. Symmetric to arrowEndClipIdx. @see lib/common/arrows.c:arrowStartClip
 */
function arrowStartClipIdx(state: ClipState, startp: number, endp: number): number {
  const { e, bez } = state;
  const slen = normalArrowLen(edgePenwidthAttr(e));
  bez.sflag = bez.sflag || 1;
  bez.sp = { ...bez.list[startp] };
  if (endp > startp && dist(bez.list[startp], bez.list[startp + 3]) < slen) startp += 3;
  const seg = [bez.list[startp], bez.list[startp + 1], bez.list[startp + 2], bez.list[startp + 3]];
  const clipped = tailArrowEndClip(seg, bez.sp, slen);
  for (let k = 0; k < 4; k++) bez.list[startp + k] = clipped[k];
  return startp;
}

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
  // C: if (bez->eflag) endi = arrowEndClip(e, list, starti, 0, &nbez, eflag); endi += 3;
  const endp = bez.eflag ? arrowEndClipIdx(state, 0) : 0;
  state.endi = endp + 3;
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
    // C: if (bez->eflag) endi = arrowEndClip(...); endi += 3;
    if (bez.eflag) state.endi = arrowEndClipIdx(state, state.endi);
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
  // C: if (bez->sflag) starti = arrowStartClip(e, list, starti, endi-3, &nbez, sflag);
  if (bez.sflag) state.starti = arrowStartClipIdx(state, state.starti, state.endi - 3);
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
    // C: if (bez->sflag) starti = arrowStartClip(e, list, starti, endi-3, &nbez, sflag);
    if (bez.sflag) state.starti = arrowStartClipIdx(state, state.starti, state.endi - 3);
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

/** Re-stash the cached arrow polygon for the renderer from a clipped tip/base. */
function restashArrow(e: Edge, tip: Point, base: Point, isTail: boolean): void {
  const dir: Point = { x: base.x - tip.x, y: base.y - tip.y };
  const pts = arrowheadPolygon(tip, dir, edgeRenderPenwidth(e));
  (e.info as unknown as Record<string, unknown>)[isTail ? '_tailArrowPts' : '_arrowPts'] = pts;
}

/**
 * Clip head (if lh) then tail (if lt) — in that order, matching C so the head
 * arrow clip sees the full spline before the tail is trimmed. Returns which
 * ends clipped. @see lib/dotgen/compound.c:makeCompoundEdge:301-417
 */
function clipEnds(
  e: Edge, state: ClipState, lh: Graph | null, lt: Graph | null,
): { headClipped: boolean; tailClipped: boolean } {
  let headClipped = false;
  if (lh != null) headClipped = clipHead(state, lh.info.bb!, inBoxf(e.head.info.coord, lh.info.bb!));
  if (!headClipped) state.endi = state.size - 1;
  const tailClipped = lt != null
    && clipTail(state, lt.info.bb!, inBoxf(e.tail.info.coord, lt.info.bb!));
  return { headClipped, tailClipped };
}

/**
 * Clip the spline for edge e against its lhead/ltail cluster bounding boxes,
 * re-clipping the arrowhead(s) to the new cluster-boundary tips.
 * @see lib/dotgen/compound.c:makeCompoundEdge
 */
export function makeCompoundEdge(e: Edge, clustMap: Map<string, Graph>): void {
  const { lh, lt } = resolveClusterPair(e, clustMap);
  if (!lh && !lt) return;
  if (!isCompoundEdgeEligible(e)) return;
  const bez = e.info.spl!.list[0];
  const state: ClipState = { e, bez, size: bez.size, endi: 0, starti: 0 };
  const { headClipped, tailClipped } = clipEnds(e, state, lh, lt);
  applyBezierSlice(state);
  if (headClipped && bez.eflag) restashArrow(e, bez.ep, bez.list[bez.list.length - 1], false);
  if (tailClipped && bez.sflag) restashArrow(e, bez.sp, bez.list[0], true);
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
