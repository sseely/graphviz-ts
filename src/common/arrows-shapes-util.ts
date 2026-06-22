// SPDX-License-Identifier: EPL-2.0

/**
 * Shared geometry primitives for the arrowhead shape/length generators
 * ({@link arrows-shapes} closed shapes + {@link arrows-shapes-poly} complex
 * shapes). Pure helpers ported from lib/common/arrows.c + geomprocs.h.
 *
 * @see lib/common/arrows.c
 */

import type { Point } from '../model/geom.js';
import type { ArrowDrawOp, ResolvedArrow } from './arrows-types.js';
import {
  ARROW_LENGTH,
  ARR_MOD_OPEN, ARR_MOD_LEFT, ARR_MOD_RIGHT,
} from './arrows-constants.js';

// ---------------------------------------------------------------------------
// pointf helpers (geomprocs.h add_pointf/sub_pointf/scale)
// ---------------------------------------------------------------------------

export const vsub = (p: Point, q: Point): Point => ({ x: p.x - q.x, y: p.y - q.y });
export const vadd = (p: Point, q: Point): Point => ({ x: p.x + q.x, y: p.y + q.y });
export const vscale = (c: number, p: Point): Point => ({ x: c * p.x, y: c * p.y });

/** A vector of length `dist` pointing along `-u` (zero for degenerate `u`). */
export const negUnit = (u: Point, dist: number): Point => {
  if (u.x === 0 && u.y === 0) return { x: 0, y: 0 };
  const h = Math.hypot(u.x, u.y);
  return { x: dist * (-u.x / h), y: dist * (-u.y / h) };
};

/**
 * The `penwidth/2` shift along `-u` that box/dot/curve/gap apply to pull the
 * arrow off the node boundary (`delta` in those generators).
 *
 * @see lib/common/arrows.c:arrow_type_box / arrow_type_dot (delta computation)
 */
export const backwardDelta = (u: Point, penwidth: number): Point => negUnit(u, penwidth / 2.0);

/**
 * Project the segment `from`→`to` onto the arrow axis defined by `phiSrc`,
 * returning a vector of the projected length (× `sign`) along that axis. This
 * is the `delta_tip`/`delta_base` miter projection shared by normal0/crow0.
 *
 * @see lib/common/arrows.c:arrow_type_normal0 / arrow_type_crow0 (delta math)
 */
export function axialProjection(phiSrc: Point, from: Point, to: Point, sign: number): Point {
  const hp = Math.hypot(phiSrc.x, phiSrc.y);
  const cosPhi = phiSrc.x / hp;
  const sinPhi = phiSrc.y / hp;
  const phi = phiSrc.y > 0 ? Math.acos(cosPhi) : -Math.acos(cosPhi);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const h = Math.hypot(dx, dy);
  const cosAlpha = dx / h;
  const alpha = dy > 0 ? Math.acos(cosAlpha) : -Math.acos(cosAlpha);
  const len = sign * h * Math.cos(alpha - phi);
  return { x: len * cosPhi, y: len * sinPhi };
}

/**
 * Shaft vector for one component: `dir` normalized to length
 * `ARROW_LENGTH * lenfact * arrowsize` (mirrors `arrow_gen` normalizing `u` to
 * ARROW_LENGTH, then `arrow_gen_type` scaling by `lenfact * arrowsize`).
 *
 * C's `arrow_gen` adds EPSILON only to guard a near-zero *raw shaft* vector
 * (length ≫ EPSILON for a real edge), so it is omitted here where `dir` is a
 * direction to normalize cleanly; the degenerate zero case is guarded.
 */
export const componentU = (dir: Point, lenfact: number, arrowsize: number): Point => {
  const len = Math.hypot(dir.x, dir.y);
  if (len === 0) return { x: 0, y: 0 };
  const s = (ARROW_LENGTH * lenfact * arrowsize) / len;
  return { x: dir.x * s, y: dir.y * s };
};

/**
 * Reconstruct the C arrow flag word (type code + INV + open/side modifiers)
 * from a resolved component. `type` already carries the type code and INV bit.
 */
export const arrowFlag = (r: ResolvedArrow): number =>
  r.type |
  (r.open ? ARR_MOD_OPEN : 0) |
  (r.left ? ARR_MOD_LEFT : 0) |
  (r.right ? ARR_MOD_RIGHT : 0);

/** Result of one shape generator: its draw ops + the next tip (base point). */
export interface GenResult {
  readonly ops: ArrowDrawOp[];
  readonly q: Point;
}

/** Signature shared by every per-type shape generator. */
export type ArrowGen = (
  p: Point, u: Point, arrowsize: number, penwidth: number, flag: number,
) => GenResult;

// ---------------------------------------------------------------------------
// miter_shape (SVG line-join shape at the tip vertex)
// @see lib/common/arrows.c:miter_shape
// ---------------------------------------------------------------------------

const STROKE_MITERLIMIT = 4.0;

/** Unit direction + signed angle of a segment `from`→`to` (miter_shape arm). */
export interface Arm { cos: number; sin: number; angle: number }
export function arm(from: Point, to: Point): Arm {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const h = Math.hypot(dx, dy);
  const cos = dx / h;
  const sin = dy / h;
  return { cos, sin, angle: dy > 0 ? Math.acos(cos) : -Math.acos(cos) };
}

/**
 * Line-join shape (3-point triangle [apex, P1, P2]) at vertex `P` between the
 * `base_left`→P and P→`base_right` segments, for a stroke of width `penwidth`.
 * P1/P2 are the penwidth/2 perpendicular offsets of P along each arm.
 *
 * @see lib/common/arrows.c:miter_shape
 * @see https://www.w3.org/TR/SVG2/painting.html#TermLineJoinShape
 */
export function miterShape(baseLeft: Point, P: Point, baseRight: Point, penwidth: number): Point[] {
  if ((baseLeft.x === P.x && baseLeft.y === P.y) || (baseRight.x === P.x && baseRight.y === P.y)) {
    return [P, P, P]; // the stroke shape is really a point; do not extend it
  }
  const a = arm(baseLeft, P);
  const b = arm(P, baseRight);
  const hpw = penwidth / 2.0;
  const P1: Point = { x: P.x - hpw * a.sin, y: P.y + hpw * a.cos };
  const P2: Point = { x: P.x - hpw * b.sin, y: P.y + hpw * b.cos };
  const raw = b.angle - Math.PI - a.angle;
  const theta = raw + (raw <= -Math.PI ? 2 * Math.PI : 0);
  if (1.0 / Math.sin(theta / 2.0) > STROKE_MITERLIMIT) {
    // Miter limit exceeded → bevel: approximate the apex by the P1/P2 midpoint.
    return [{ x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 }, P1, P2];
  }
  const l = hpw / Math.tan(theta / 2.0);
  return [{ x: P1.x + l * a.cos, y: P1.y + l * a.sin }, P1, P2];
}
