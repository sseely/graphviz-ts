// SPDX-License-Identifier: EPL-2.0
/**
 * Spline routing for lib/common/splines.c and lib/common/routespl.c.
 * This entry module re-exports the full public surface area.
 *
 * @see lib/common/splines.c
 * @see lib/common/routespl.c
 */

export type { InsideContext } from './splines-geom.js';
export { approxEqPt, evalBezier, updateBbBz, bezierClip } from './splines-geom.js';

export {
  NORMAL, REGULAREDGE, FLATEDGE, SELFEDGE,
  ARR_NONE,
  BOTTOM, RIGHT, TOP, LEFT,
  SELF_EDGE_SIZE, MILLIPOINT, FUDGE, INIT_DELTA, LOOP_TRIES, ROUTESPL_FUDGE,
} from './splines-constants.js';

export { newSpline, clipAndInstall } from './splines-clip.js';

export type { BeginPathArgs } from './splines-path-begin.js';
export { beginPath } from './splines-path-begin.js';

export type { EndPathArgs } from './splines-path-end.js';
export { endPath } from './splines-path-end.js';

export { checkPath, limitBoxes, routeSplines, routePolylines } from './splines-routespl.js';

export {
  selfBottom, selfTop, selfRight, selfLeft,
  selfRightSpace, makeSelfEdge,
} from './splines-selfedge.js';
