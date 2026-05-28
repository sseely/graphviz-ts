// SPDX-License-Identifier: EPL-2.0

/**
 * Coordinate conversion helpers for the emit rendering dispatch.
 *
 * In the C source, map_point() managed URL-map hotspot data in GVJ_t's
 * obj_state_t. Since AD-2 removes the URL/map machinery, these functions
 * provide the coordinate-conversion primitives needed by other emit modules.
 *
 * @see lib/common/emit.c:map_point (lines 342-365)
 */

import type { Point } from '../model/geom.js';

/**
 * Conversion factor: PostScript points → inches.
 * @see lib/common/geom.h: POINTS_PER_INCH
 */
export const PS2INCH = 1.0 / 72.0;

/**
 * Conversion factor: inches → PostScript points.
 * @see lib/common/geom.h: POINTS_PER_INCH
 */
export const INCH2PS = 72.0;

/**
 * Map a point from graph-units (points) to the renderer coordinate space.
 *
 * In the C implementation, map_point() also maintained URL hotspot data in
 * the GVJ_t obj_state_t. That URL-map machinery is out of scope (AD-2).
 * This stub simply returns the point unchanged; renderers that need Y-axis
 * flip (e.g. SVG) must apply it themselves using job.graphHeight.
 *
 * @see lib/common/emit.c:map_point
 */
export function mapPoint(p: Point): Point {
  // URL-map machinery is not ported (AD-2: single-layer, no pagination).
  // Coordinate passthrough: points stay in graph units.
  return { x: p.x, y: p.y };
}
