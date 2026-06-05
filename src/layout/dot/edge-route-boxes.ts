// SPDX-License-Identifier: EPL-2.0

/**
 * Box assembly helpers for edge spline routing.
 *
 * Constructs the path boxes (tail, rank, head) that define the corridor
 * through which a spline is routed.
 *
 * @see lib/common/splines.c:beginpath
 * @see lib/common/splines.c:endpath
 * @see lib/dotgen/dotsplines.c:rank_box
 * @see lib/dotgen/dotsplines.c:maximal_bbox
 */

import type { Box } from '../../model/geom.js';
import type { NodeBox } from './edge-route-geom.js';

/** FUDGE padding added around node x-extents in maximal_bbox. */
const FUDGE = 2;

/**
 * Assemble the tail-side box (beginpath, REGULAREDGE, no port).
 *
 * C sets boxes[0].UR.y = start.p.y. In TS SVG coords C's UR.y maps to
 * our ll.y. The tail box spans ll.y=startPy (center) to ur.y (bottom).
 *
 * @see lib/common/splines.c:beginpath
 */
/**
 * Tail box: nb with ur.y overridden to startPy (= beginpath UR.y = center.y).
 * C: endp->boxes[0] = nb; endp->boxes[0].UR.y = P->start.p.y
 * @see lib/common/splines.c:beginpath REGULAREDGE case
 */
export function makeTailBox(nb: Box, startPy: number): Box {
  return { ll: nb.ll, ur: { x: nb.ur.x, y: startPy } };
}

/**
 * Assemble the head-side box (endpath, REGULAREDGE, no port).
 *
 * C sets boxes[0].LL.y = end.p.y. In TS SVG coords C's LL.y maps to
 * our ur.y. The head box spans ll.y (top) to ur.y=endPy (center).
 *
 * @see lib/common/splines.c:endpath
 */
/**
 * Head box: nb with ll.y overridden to endPy (= endpath LL.y = center.y).
 * C: endp->boxes[0] = nb; endp->boxes[0].LL.y = P->end.p.y
 * @see lib/common/splines.c:endpath REGULAREDGE case
 */
export function makeHeadBox(nb: Box, endPy: number): Box {
  return { ll: { x: nb.ll.x, y: endPy }, ur: nb.ur };
}

/** Parameters for makeRankBox — avoids a 6-parameter signature. */
export interface RankBoxParams {
  llx: number;
  urx: number;
  tailCy: number;
  tailHt1: number;
  headCy: number;
  headHt2: number;
}

/**
 * Inter-rank space box between two adjacent ranks.
 *
 * In TS SVG coords: ll.y = tailCy+tailHt1 (bottom of tail node),
 * ur.y = headCy-headHt2 (top of head node).
 *
 * @see lib/dotgen/dotsplines.c:rank_box
 */
/**
 * Inter-rank space box: from head node top (ll.y) to tail node bottom (ur.y).
 * C: ll.y = headCy + headHt2  (= B.top = 90+18=108)
 *    ur.y = tailCy - tailHt1  (= A.bottom = 162-18=144)
 * @see lib/dotgen/dotsplines.c:rank_box
 */
export function makeRankBox(p: RankBoxParams): Box {
  return {
    ll: { x: p.llx, y: p.headCy + p.headHt2 },
    ur: { x: p.urx, y: p.tailCy - p.tailHt1 },
  };
}

/**
 * Node bounding box for maximal_bbox (simple node, no neighbors).
 *
 * ll = { x: cx-lw-FUDGE, y: cy-ht1 }  (top-left in SVG)
 * ur = { x: cx+rw+FUDGE, y: cy+ht2 }  (bottom-right in SVG)
 *
 * @see lib/dotgen/dotsplines.c:maximal_bbox
 */
export function makeMaximalBbox(box: NodeBox, ht1: number, ht2: number): Box {
  return {
    ll: { x: box.center.x - box.lw - FUDGE, y: box.center.y - ht1 },
    ur: { x: box.center.x + box.rw + FUDGE, y: box.center.y + ht2 },
  };
}
