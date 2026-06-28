// SPDX-License-Identifier: EPL-2.0

/**
 * Arrowhead polygon geometry for dot-layout edge rendering.
 *
 * @see lib/common/arrows.c:arrow_type_normal0
 * @see lib/common/arrows.c:miter_shape
 */

import type { Point } from '../../model/geom.js';
import { normalizeVec } from './edge-route-geom.js';
import { parseArrow, resolveArrowType } from '../../common/arrows.js';
import { arrowDrawOps } from '../../common/arrows-shapes.js';
import type { ArrowDrawOp } from '../../common/arrows-types.js';

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

// ---------------------------------------------------------------------------
// Per-type arrow draw-op dispatch (ADR-1/ADR-2) — replaces the normal-only
// arrowheadPolygon at the layout storage sites.
// ---------------------------------------------------------------------------

/** Minimal edge shape exposing the arrow-related attributes. */
interface ArrowAttrEdge { attrs: Map<string, string> }

/** The arrowhead/arrowtail name for an edge end (default "normal"). */
export function edgeArrowName(e: ArrowAttrEdge, end: 'head' | 'tail'): string {
  return e.attrs.get(end === 'head' ? 'arrowhead' : 'arrowtail') ?? 'normal';
}

/** The `arrowsize` edge attribute (default 1.0; clamped to ≥0 like late_double). */
export function edgeArrowsize(e: ArrowAttrEdge): number {
  const s = parseFloat(e.attrs.get('arrowsize') ?? '');
  return Number.isFinite(s) ? Math.max(s, 0) : 1.0;
}

/**
 * Typed arrow draw-ops for one edge end: reads `arrowhead`/`arrowtail` +
 * `arrowsize`, resolves the compound arrow type, and dispatches to the full
 * geometry table (`arrowDrawOps`). `tip` is the node-boundary point, `dir`
 * points from tip toward the shaft (away from the node).
 *
 * @see lib/common/arrows.c:arrow_gen
 */
export function arrowDrawOpsForEnd(
  e: ArrowAttrEdge, end: 'head' | 'tail', tip: Point, dir: Point, penwidth: number,
): ArrowDrawOp[] {
  const comps = parseArrow(edgeArrowName(e, end)).map(resolveArrowType);
  // Pass the RAW direction (not normalized): componentU reproduces arrow_gen's
  // EPSILON normalization, which is relative to the raw shaft magnitude.
  return arrowDrawOps(comps, tip, dir, edgeArrowsize(e), penwidth);
}
