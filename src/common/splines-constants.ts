// SPDX-License-Identifier: EPL-2.0

/**
 * Constants used by spline routing, ported from lib/common/const.h.
 *
 * @see lib/common/const.h
 */

/** Normal node type. @see lib/common/const.h:NORMAL */
export const NORMAL = 0;

/** Regular (non-flat, non-self) edge. @see lib/common/const.h:REGULAREDGE */
export const REGULAREDGE = 1;
/** Flat edge (same rank). @see lib/common/const.h:FLATEDGE */
export const FLATEDGE = 2;
/** Self-loop edge. @see lib/common/const.h:SELFEDGE */
export const SELFEDGE = 8;

/** No arrowhead. @see lib/common/const.h:ARR_NONE */
export const ARR_NONE = 0;

/** Bottom side bitmask. @see lib/common/const.h:BOTTOM */
export const BOTTOM = 1 << 0;
/** Right side bitmask. @see lib/common/const.h:RIGHT */
export const RIGHT = 1 << 1;
/** Top side bitmask. @see lib/common/const.h:TOP */
export const TOP = 1 << 2;
/** Left side bitmask. @see lib/common/const.h:LEFT */
export const LEFT = 1 << 3;

/** Default self-edge size in points. @see lib/common/const.h:SELF_EDGE_SIZE */
export const SELF_EDGE_SIZE = 18;

/**
 * Tolerance for approximate point equality.
 * @see lib/common/geom.h:MILLIPOINT
 */
export const MILLIPOINT = 0.001;

/**
 * Fudge offset for box paths (prevents router confusion at polygon boundary).
 * @see lib/common/splines.c:FUDGE
 */
export const FUDGE = 2;

/** Initial delta for limitBoxes sampling. @see lib/common/routespl.c:INIT_DELTA */
export const INIT_DELTA = 10;

/** Max attempts to reclaim box space. @see lib/common/routespl.c:LOOP_TRIES */
export const LOOP_TRIES = 15;

/** Fudge for box overlap checks on 32-bit. @see lib/common/routespl.c:FUDGE */
export const ROUTESPL_FUDGE = 0.0001;
