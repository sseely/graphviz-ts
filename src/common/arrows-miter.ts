// SPDX-License-Identifier: EPL-2.0

/**
 * Miter line-join shape computation, split from arrows-geometry.ts to
 * satisfy per-function line-length limits.
 *
 * @see lib/common/arrows.c:miter_shape
 */

import type { Point } from '../model/geom.js';

/**
 * Three points describing a line-join shape at a stroke corner.
 * points[0] = miter tip P3 (or bevel midpoint)
 * points[1] = P1 (left penwidth offset)
 * points[2] = P2 (right penwidth offset)
 *
 * @see lib/common/arrows.c:triangle
 */
export type Triangle = { readonly points: readonly [Point, Point, Point] };

/** Signed angle in radians from direction vector (dx, dy). */
const ang = (dx: number, dy: number): number =>
  dy > 0
    ? Math.acos(dx / Math.hypot(dx, dy))
    : -Math.acos(dx / Math.hypot(dx, dy));

/** Left penwidth-offset at corner P for incoming direction from→P. */
const p1Off = (from: Point, P: Point, half: number): Point => {
  const dx = P.x - from.x;
  const dy = P.y - from.y;
  const h = Math.hypot(dx, dy);
  return { x: P.x - half * dy / h, y: P.y + half * dx / h };
};

/** Right penwidth-offset at corner P for outgoing direction P→to. */
const p2Off = (P: Point, to: Point, half: number): Point => {
  const dx = to.x - P.x;
  const dy = to.y - P.y;
  const h = Math.hypot(dx, dy);
  return { x: P.x - half * dy / h, y: P.y + half * dx / h };
};

/** Miter theta: interior angle at P clamped to (−π, π]. */
const mTheta = (from: Point, P: Point, to: Point): number => {
  const raw = ang(to.x - P.x, to.y - P.y)
    - Math.PI
    - ang(P.x - from.x, P.y - from.y);
  return raw <= -Math.PI ? raw + 2 * Math.PI : raw;
};

/** Miter tip P3: P1 extended along incoming segment by arm l. */
const p3Tip = (from: Point, P: Point, P1: Point, l: number): Point => {
  const dx = P.x - from.x;
  const dy = P.y - from.y;
  const h = Math.hypot(dx, dy);
  return { x: P1.x + l * dx / h, y: P1.y + l * dy / h };
};

/**
 * Miter (or bevel fallback) line-join shape for a stroke corner at P.
 * @see lib/common/arrows.c:miter_shape
 */
export function miterShapeImpl(
  baseLeft: Point,
  P: Point,
  baseRight: Point,
  penwidth: number,
): Triangle {
  if (
    (baseLeft.x === P.x && baseLeft.y === P.y) ||
    (baseRight.x === P.x && baseRight.y === P.y)
  ) {
    return { points: [P, P, P] };
  }
  const half = penwidth / 2.0;
  const P1 = p1Off(baseLeft, P, half);
  const P2 = p2Off(P, baseRight, half);
  const t = mTheta(baseLeft, P, baseRight);
  if (1.0 / Math.sin(t / 2.0) > 4.0) {
    return { points: [{ x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 }, P1, P2] };
  }
  return { points: [p3Tip(baseLeft, P, P1, half / Math.tan(t / 2.0)), P1, P2] };
}
