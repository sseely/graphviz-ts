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
import { bezierClipNode, makeBoxInsideFn, arrowEndClip, DEFAULT_NODEPENWIDTH } from './edge-route-clip.js';
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
export function buildRankCorridor(
  tailBox: NodeBox,
  headBox: NodeBox,
  rank: RankEdgeInfo,
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
    startPt: { x: tailBox.center.x, y: startPy - 1 },
    endPt:   { x: headBox.center.x, y: endPy   + 1 },
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
 * C computes this using arrow_type_normal0 with the miter correction:
 *   u = {ARROW_LENGTH, 0} (horizontal reference)
 *   delta_tip ≈ (-1.496, -0.006) for arrowwidth=0.35, penwidth=1
 *   delta_base ≈ {penwidth/2 * cos(π), 0} = {-penwidth/2, 0}
 *   q = u - delta_tip - delta_base  →  q.x = ARROW_LENGTH + 1.496 + penwidth/2
 *   full_length = q.x ≈ ARROW_LENGTH + 1.496 + penwidth/2
 *   overlap = penwidth/2
 *   elen = full_length - overlap = ARROW_LENGTH + 1.496
 *
 * Empirically: elen ≈ ARROW_LENGTH + 1.496 = 11.496 for penwidth=1.
 *
 * @see lib/common/arrows.c:arrow_length_normal
 */
export function normalArrowLen(penwidth = DEFAULT_NODEPENWIDTH): number {
  // miter correction ≈ 1.496 for arrowwidth=0.35, penwidth=1
  // This is |delta_base.x| + |delta_tip.x| contribution to q.x
  const MITER_CORRECTION = 1.496;
  return ARROW_LENGTH + MITER_CORRECTION;
}

/**
 * Clip a routed Bezier to both node boundaries, then apply arrowEndClip
 * to trim the path to the arrowhead BASE (not the node boundary).
 * @see lib/common/splines.c:clip_and_install
 * @see lib/common/arrows.c:arrowEndClip
 */
export function clipToNodes(
  bezier: Point[],
  tailBox: NodeBox,
  headBox: NodeBox,
): { clipped: Point[]; arrowTip: Point; arrowDir: Point } {
  const tailInside = makeBoxInsideFn((tailBox.lw + tailBox.rw) / 2, tailBox.ht / 2);
  const step1 = bezierClipNode(
    bezier, tailBox.center.x, tailBox.center.y, tailInside, true,
  );
  const headInside = makeBoxInsideFn((headBox.lw + headBox.rw) / 2, headBox.ht / 2);
  const step2 = bezierClipNode(
    step1, headBox.center.x, headBox.center.y, headInside, false,
  );
  // arrowTip = node boundary clip result = spl.ep in C
  const arrowTip = step2[3] as Point;
  // arrowEndClip: trim path to arrowhead BASE (path P3 -> arrowhead base)
  const elen = normalArrowLen();
  const clipped = arrowEndClip(step2, arrowTip, elen);
  // Arrow direction: from arrowTip toward shaft (= clipped[3] → arrowTip direction)
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
): EdgeSplineResult {
  const { startPt, endPt, boxes } = buildRankCorridor(tailBox, headBox, rank);
  const bezier = computeSpline(boxes, startPt, endPt);
  const { clipped, arrowTip, arrowDir } = clipToNodes(bezier, tailBox, headBox);
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
