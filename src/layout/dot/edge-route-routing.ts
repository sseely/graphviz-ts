// SPDX-License-Identifier: EPL-2.0

/**
 * Spline routing helpers: rank-corridor construction, Bezier clipping,
 * and the two routing strategies (rank-aware and simple fallback).
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 * @see lib/common/routespl.c:routesplines_
 * @see lib/common/splines.c:clip_and_install
 */

import type { Point } from '../../model/geom.js';
import {
  normalizeVec, negateVec, offsetPoint, clipToNodeBox,
} from './edge-route-geom.js';
import type { NodeBox } from './edge-route-geom.js';
import { bezierClipNode, makeBoxInsideFn, makeEllipseInsideFn, arrowEndClip, DEFAULT_NODEPENWIDTH } from './edge-route-clip.js';
import { computeSpline } from './edge-route-poly.js';
import {
  makeTailBox, makeHeadBox, makeRankBox, makeMaximalBbox,
} from './edge-route-boxes.js';
import type { RankBoxParams } from './edge-route-boxes.js';

/** Arrow length constant — duplicated here to avoid a circular import. */
const ARROW_LENGTH = 10;

/** Result of computing a straight-line edge spline. */
export interface EdgeSplineResult {
  bezierPts: Point[];
  arrowTip: Point;
  arrowDir: Point;
}

/** Rank geometry needed to route an edge between two adjacent ranks. */
export interface RankEdgeInfo {
  leftBound: number;
  rightBound: number;
  tailHt1: number;
  tailHt2: number;
  headHt1: number;
  headHt2: number;
}

// ---------------------------------------------------------------------------
// buildRankCorridor
// @see lib/common/splines.c:beginpath, endpath
// @see lib/dotgen/dotsplines.c:rank_box
// ---------------------------------------------------------------------------

/**
 * Build the three-box corridor (tail, rank-gap, head) and start/end points.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (box assembly section)
 */
/**
 * Resolved edge-port routing data, attached to the active router when an edge
 * declares a tail/head port. A `null` end falls back to the node-center clip;
 * a present point pins the spline to `node.coord + port.p`. `clip{Tail,Head}`
 * mirror `port.clip` — false means the port point is exact and the node-boundary
 * clip is skipped. @see lib/common/splines.c:beginpath (port offset + clip flag)
 */
export interface PortRoute {
  tailP: Point | null;
  headP: Point | null;
  clipTail: boolean;
  clipHead: boolean;
}

/** Whether to clip the spline to the tail/head node boundary. */
export interface ClipFlags {
  tail: boolean;
  head: boolean;
}

const CLIP_BOTH: ClipFlags = { tail: true, head: true };

export function buildRankCorridor(
  tailBox: NodeBox,
  headBox: NodeBox,
  rank: RankEdgeInfo,
  ports?: { tailP: Point | null; headP: Point | null },
): { startPt: Point; endPt: Point; boxes: ReturnType<typeof makeTailBox>[] } {
  const startPy = tailBox.center.y;
  const endPy = headBox.center.y;
  const tailNb = makeMaximalBbox(tailBox, rank.tailHt1, rank.tailHt2);
  const headNb = makeMaximalBbox(headBox, rank.headHt1, rank.headHt2);
  const rp: RankBoxParams = {
    llx: rank.leftBound, urx: rank.rightBound,
    tailCy: tailBox.center.y, tailHt1: rank.tailHt1,
    headCy: headBox.center.y, headHt2: rank.headHt2,
  };
  return {
    startPt: ports?.tailP ?? { x: tailBox.center.x, y: startPy - 1 },
    endPt:   ports?.headP ?? { x: headBox.center.x, y: endPy   + 1 },
    boxes:   [makeTailBox(tailNb, startPy), makeRankBox(rp), makeHeadBox(headNb, endPy)],
  };
}

// ---------------------------------------------------------------------------
// clipToNodes
// @see lib/common/splines.c:clip_and_install (bezier_clip calls)
// ---------------------------------------------------------------------------

/**
 * Clip a routed Bezier to both node boundaries and extract arrow geometry.
 * @see lib/common/splines.c:bezier_clip
 */
/**
 * Arrow length for "normal" arrowhead (matching C's arrow_length_normal).
 *
 * Derived from miter_shape geometry for the normal (triangular) arrowhead:
 *   arrowwidth = 0.35, half-angle theta/2 = arctan(arrowwidth)
 *   miter_length l = penwidth/2 / tan(theta/2) = penwidth / (2*arrowwidth)
 *   delta_tip.x = -penwidth * sqrt(1 + arrowwidth^2) / (2*arrowwidth)
 *   full_length = ARROW_LENGTH - delta_tip.x + penwidth/2
 *   overlap = penwidth/2
 *   elen = full_length - overlap = ARROW_LENGTH + penwidth*sqrt(1+arrowwidth^2)/(2*arrowwidth)
 *
 * @see lib/common/arrows.c:arrow_length_normal
 * @see lib/common/arrows.c:miter_shape
 * @see lib/common/arrows.c:arrow_type_normal0
 */
export function normalArrowLen(penwidth = DEFAULT_NODEPENWIDTH): number {
  const ARROWWIDTH = 0.35;
  return ARROW_LENGTH + penwidth * Math.sqrt(1 + ARROWWIDTH * ARROWWIDTH) / (2 * ARROWWIDTH);
}

/**
 * Clip a routed Bezier to both node boundaries, then apply arrowEndClip
 * to trim the path to the arrowhead BASE (not the node boundary).
 * @see lib/common/splines.c:clip_and_install
 * @see lib/common/arrows.c:arrowEndClip
 */
export function nodeInsideFn(
  box: NodeBox,
): (lx: number, ly: number) => boolean {
  const halfW = (box.lw + box.rw) / 2;
  const halfH = box.ht / 2;
  const pw = box.penwidth ?? DEFAULT_NODEPENWIDTH;
  return box.isEllipse
    ? makeEllipseInsideFn(halfW, halfH, pw)
    : makeBoxInsideFn(halfW, halfH, pw);
}

export function clipToNodes(
  bezier: Point[],
  tailBox: NodeBox,
  headBox: NodeBox,
  penwidth = DEFAULT_NODEPENWIDTH,
  clip: ClipFlags = CLIP_BOTH,
): { clipped: Point[]; arrowTip: Point; arrowDir: Point } {
  const step1 = clip.tail
    ? bezierClipNode(bezier, tailBox.center.x, tailBox.center.y, nodeInsideFn(tailBox), true)
    : bezier;
  const step2 = clip.head
    ? bezierClipNode(step1, headBox.center.x, headBox.center.y, nodeInsideFn(headBox), false)
    : step1;
  const arrowTip = step2[3] as Point;
  const elen = normalArrowLen(penwidth);
  const clipped = arrowEndClip(step2, arrowTip, elen);
  const arrowDir = normalizeVec({
    x: (clipped[3] as Point).x - arrowTip.x,
    y: (clipped[3] as Point).y - arrowTip.y,
  });
  return { clipped, arrowTip, arrowDir };
}

// ---------------------------------------------------------------------------
// routeWithRank
// @see lib/common/routespl.c:routesplines_
// ---------------------------------------------------------------------------

/**
 * Route edge through the rank-gap corridor using polygon-based spline fitting.
 * @see lib/common/routespl.c:routesplines_
 */
export function routeWithRank(
  tailBox: NodeBox,
  headBox: NodeBox,
  rank: RankEdgeInfo,
  penwidth = DEFAULT_NODEPENWIDTH,
  port?: PortRoute,
): EdgeSplineResult {
  const corridor = port ? { tailP: port.tailP, headP: port.headP } : undefined;
  const { startPt, endPt, boxes } = buildRankCorridor(tailBox, headBox, rank, corridor);
  const bezier = computeSpline(boxes, startPt, endPt);
  const clip: ClipFlags = port
    ? { tail: port.clipTail, head: port.clipHead }
    : CLIP_BOTH;
  const { clipped, arrowTip, arrowDir } = clipToNodes(bezier, tailBox, headBox, penwidth, clip);
  return { bezierPts: clipped, arrowTip, arrowDir };
}

// ---------------------------------------------------------------------------
// routeSimple
// @see lib/dotgen/dotsplines.c:make_regular_edge (straight-line fallback)
// ---------------------------------------------------------------------------

/**
 * Boundary-clip fallback when no rank geometry is available.
 * @see lib/dotgen/dotsplines.c:make_regular_edge (straight-line fallback)
 */
export function routeSimple(
  tailBox: NodeBox,
  headBox: NodeBox,
  routeBezierFn: (from: Point, to: Point) => Point[],
): EdgeSplineResult {
  const dir = normalizeVec({
    x: headBox.center.x - tailBox.center.x,
    y: headBox.center.y - tailBox.center.y,
  });
  const headToTail = negateVec(dir);
  const tailClip = clipToNodeBox(tailBox, dir);
  const arrowTip = clipToNodeBox(headBox, headToTail);
  return {
    bezierPts: routeBezierFn(tailClip, offsetPoint(arrowTip, headToTail, ARROW_LENGTH)),
    arrowTip,
    arrowDir: headToTail,
  };
}
