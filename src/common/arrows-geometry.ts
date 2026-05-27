// SPDX-License-Identifier: EPL-2.0

/**
 * Pure geometry helpers for arrow rendering.
 * Ported from the internal static functions in lib/common/arrows.c.
 *
 * @see lib/common/arrows.c
 */

import type { Point } from '../model/geom.js';
import { miterShapeImpl } from './arrows-miter.js';

// ---------------------------------------------------------------------------
// Small vector helpers
// ---------------------------------------------------------------------------

/** @see lib/common/geomprocs.h:add_pointf */
export function addPoint(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** @see lib/common/geomprocs.h:sub_pointf */
export function subPoint(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** @see lib/common/geomprocs.h:scale */
export function scalePoint(s: number, p: Point): Point {
  return { x: s * p.x, y: s * p.y };
}

/** Euclidean distance between two points. @see lib/common/arrows.c:DIST macro */
export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ---------------------------------------------------------------------------
// Angle helpers
// ---------------------------------------------------------------------------

/** Signed angle in radians from direction vector (dx, dy). */
export function signedAngle(dx: number, dy: number): number {
  return dy > 0
    ? Math.acos(dx / Math.hypot(dx, dy))
    : -Math.acos(dx / Math.hypot(dx, dy));
}

// ---------------------------------------------------------------------------
// Triangle (line-join shape) — re-exported from arrows-miter.ts
// ---------------------------------------------------------------------------

export type { Triangle } from './arrows-miter.js';

/**
 * Miter (or bevel fallback) line-join shape for a stroke corner at P.
 * @see lib/common/arrows.c:miter_shape
 */
export function miterShape(
  baseLeft: Point, P: Point, baseRight: Point, penwidth: number,
): import('./arrows-miter.js').Triangle {
  return miterShapeImpl(baseLeft, P, baseRight, penwidth);
}
