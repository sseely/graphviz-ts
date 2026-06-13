// SPDX-License-Identifier: EPL-2.0

/**
 * Arrowhead polygon geometry for dot-layout edge rendering.
 *
 * @see lib/common/arrows.c:arrow_type_normal0
 * @see lib/common/arrows.c:miter_shape
 */

import type { Point } from '../../model/geom.js';
import { normalizeVec } from './edge-route-geom.js';

/** Arrow length in points. @see lib/common/arrows.c:#define ARROW_LENGTH 10. */
export const ARROW_LENGTH = 10;

/** Arrow width factor. @see lib/common/arrows.c:arrowwidth = 0.35 */
export const ARROW_WIDTH_FACTOR = 0.35;

/**
 * Three-point arrowhead polygon: [rightBase, adj_tip, leftBase].
 *
 * Matches C's arrow_type_normal0 for a standard "normal" arrowhead:
 *   1. delta_tip correction shifts both the polygon tip and base TOWARD the
 *      shaft by the miter-join extension length, so the filled polygon covers
 *      the miter join produced by the SVG renderer at the sharp tip vertex.
 *      Formula: (penwidth / (2 * arrowwidth)) * sqrt(1 + arrowwidth^2)
 *   2. Polygon order is [a[1]=right_base, a[2]=adj_tip, a[3]=left_base]
 *      (matching gvrender_polygon(job, &a[1], 3)).
 *
 * @see lib/common/arrows.c:arrow_type_normal0
 * @see lib/common/arrows.c:miter_shape
 */
export function arrowheadPolygon(arrowTip: Point, arrowDir: Point, penwidth = 1.0): Point[] {
  const dir = normalizeVec(arrowDir);
  const delta = (penwidth / (2 * ARROW_WIDTH_FACTOR)) * Math.sqrt(1 + ARROW_WIDTH_FACTOR * ARROW_WIDTH_FACTOR);
  const adj_tip: Point = { x: arrowTip.x + dir.x * delta, y: arrowTip.y + dir.y * delta };
  const adj_base: Point = {
    x: arrowTip.x + dir.x * (ARROW_LENGTH + delta),
    y: arrowTip.y + dir.y * (ARROW_LENGTH + delta),
  };
  const hw = ARROW_LENGTH * ARROW_WIDTH_FACTOR;
  const perp: Point = { x: -dir.y * hw, y: dir.x * hw };
  return [
    { x: adj_base.x - perp.x, y: adj_base.y - perp.y },  // a[1] = right base
    adj_tip,                                                // a[2] = tip
    { x: adj_base.x + perp.x, y: adj_base.y + perp.y },  // a[3] = left base
  ];
}
