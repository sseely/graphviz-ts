// SPDX-License-Identifier: EPL-2.0

/**
 * Striped/wedged shape fill helpers — stubs for the shape-rendering batch.
 *
 * The full implementations depend on path-planning primitives not yet ported.
 * These stubs preserve the call sites in emit-cluster.ts so that TypeScript
 * type-checks cleanly. They will be replaced when the shape batch lands.
 *
 * @see lib/common/emit.c:wedgedEllipse (line 549)
 * @see lib/common/emit.c:stripedBox (line 595)
 */

import type { Point } from '../model/geom.js';
import type { RenderJob } from './emit-types.js';

/**
 * Fill an ellipse with wedge-shaped color segments.
 *
 * Stub — returns 0 (no error) without rendering. Full implementation
 * requires ellipticWedge() from the path-plan module (not yet ported).
 *
 * @see lib/common/emit.c:wedgedEllipse (line 549)
 */
export function wedgedEllipse(
  _pf: [Point, Point],
  _clrs: string,
  _job: RenderJob,
): number {
  // Not yet implemented — shape rendering batch.
  return 0;
}

/**
 * Fill a rectangular box with vertical (or horizontal) color stripes.
 *
 * Stub — returns 0 (no error) without rendering. Full implementation
 * requires the color-segment parser and polygon emitter wired to the
 * shape renderer (not yet ported).
 *
 * @see lib/common/emit.c:stripedBox (line 595)
 */
export function stripedBox(
  _af: [Point, Point, Point, Point],
  _clrs: string,
  _rotate: boolean,
  _job: RenderJob,
): number {
  // Not yet implemented — shape rendering batch.
  return 0;
}
