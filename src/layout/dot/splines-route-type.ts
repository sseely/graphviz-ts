// SPDX-License-Identifier: EPL-2.0

/**
 * Edge-type dispatch for regular (cross-rank) edge routing.
 *
 * `make_regular_edge` routes the box corridor through `routesplines` for
 * `EDGETYPE_SPLINE` and `routepolylines` otherwise; for `EDGETYPE_LINE` it
 * additionally straightens a polyline of more than 4 points down to a 4-point
 * line (first/last control points only). This module is the single home for
 * that dispatch + straighten, called by every box-corridor emit point.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge (1799-1808, 1849-1861)
 */

import type { Point } from '../../model/geom.js';
import type { Path } from '../../common/types.js';
import { routeSplines, routePolylines } from '../../common/splines-routespl.js';
import { EDGETYPE_SPLINE, EDGETYPE_LINE } from './splines.js';

/**
 * Route the box corridor in `P` according to the edge type `et`.
 *
 * - `EDGETYPE_SPLINE` → `routeSplines` (the default; byte-identical to before).
 * - any other type → `routePolylines`.
 * - `EDGETYPE_LINE` with a result of more than 4 points → straighten to the
 *   4-point line `[p0, p0, pLast, pLast]`.
 *
 * Returns the control points, or `null`/empty exactly as the underlying
 * `routeSplines`/`routePolylines` do (the caller treats that as a decline).
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 */
export function routeRegularByType(P: Path, et: number): Point[] | null {
  if (et === EDGETYPE_SPLINE) return routeSplines(P);
  const ps = routePolylines(P);
  if (et === EDGETYPE_LINE && ps !== null && ps.length > 4) {
    // Straighten the polyline to a line: keep only the endpoints.
    // C: ps[1]=ps[0]; ps[3]=ps[2]=ps[pn-1]; pn=4.
    const p0 = ps[0];
    const pLast = ps[ps.length - 1];
    return [p0, p0, pLast, pLast];
  }
  return ps;
}
