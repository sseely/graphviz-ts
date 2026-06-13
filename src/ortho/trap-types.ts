// SPDX-License-Identifier: EPL-2.0
/**
 * Trapezoid types and floating-point helpers for Seidel trapezoidation.
 *
 * @see lib/ortho/trap.h
 */

/** Tolerance for floating-point equality. @see lib/ortho/trap.h:C_EPS */
export const C_EPS = 1e-7;

/** Sentinel for unset trap indices — mirrors C SIZE_MAX. */
export const TRAP_MAX = Number.MAX_SAFE_INTEGER;
/** Sentinel for invalid/absent trap — mirrors C 0. */
export const INVALID_TRAP = 0;

export const S_LEFT = 1;
export const S_RIGHT = 2;

export const T_X = 1;
export const T_Y = 2;
export const T_SINK = 3;

export const FIRSTPT = 1;
export const LASTPT = 2;

// ─── Point / segment / trapezoid structures ───────────────────────────────────

export interface SegPoint {
  x: number;
  y: number;
}

/**
 * A polygon boundary segment.
 * @see lib/ortho/trap.h:segment_t
 */
export interface SegmentT {
  v0: SegPoint;
  v1: SegPoint;
  isInserted: boolean;
  root0: number;
  root1: number;
  next: number;
  prev: number;
}

/**
 * A trapezoid in the decomposition.
 * @see lib/ortho/trap.h:trap_t
 */
export interface TrapT {
  lseg: number;
  rseg: number;
  hi: SegPoint;
  lo: SegPoint;
  u0: number;
  u1: number;
  d0: number;
  d1: number;
  sink: number;
  usave: number;
  uside: number;
  isValid: boolean;
}

/** Query-tree node. */
export interface QNode {
  nodetype: number;
  segnum: number;
  yval: SegPoint;
  trnum: number;
  parent: number;
  left: number;
  right: number;
}

// ─── Validity check ───────────────────────────────────────────────────────────

/** @see lib/ortho/trap.h:is_valid_trap */
export function isValidTrap(index: number): boolean {
  return index !== INVALID_TRAP && index !== TRAP_MAX;
}

// ─── Floating-point helpers ───────────────────────────────────────────────────

/** @see lib/ortho/trap.h:fp_equal */
export function fpEqual(s: number, t: number): boolean {
  return Math.abs(s - t) <= C_EPS;
}

/** @see lib/ortho/trap.h:dfp_cmp */
export function dfpCmp(f1: number, f2: number): number {
  const d = f1 - f2;
  if (d < -C_EPS) return -1;
  if (d > C_EPS) return 1;
  return 0;
}

/** @see lib/ortho/trap.h:equal_to */
export function equalTo(v0: SegPoint, v1: SegPoint): boolean {
  return fpEqual(v0.y, v1.y) && fpEqual(v0.x, v1.x);
}

/** @see lib/ortho/trap.h:greater_than */
export function greaterThan(v0: SegPoint, v1: SegPoint): boolean {
  return v0.y > v1.y + C_EPS
    ? true
    : v0.y < v1.y - C_EPS
      ? false
      : v0.x > v1.x;
}

export function greaterThanOrEq(v0: SegPoint, v1: SegPoint): boolean {
  return greaterThan(v0, v1) || equalTo(v0, v1);
}

export function lessThan(v0: SegPoint, v1: SegPoint): boolean {
  return !greaterThanOrEq(v0, v1);
}

export function maxPt(v0: SegPoint, v1: SegPoint): SegPoint {
  if (v0.y > v1.y + C_EPS) return v0;
  if (fpEqual(v0.y, v1.y)) return v0.x > v1.x + C_EPS ? v0 : v1;
  return v1;
}

export function minPt(v0: SegPoint, v1: SegPoint): SegPoint {
  if (v0.y < v1.y - C_EPS) return v0;
  if (fpEqual(v0.y, v1.y)) return v0.x < v1.x ? v0 : v1;
  return v1;
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

export function cross(v0: SegPoint, v1: SegPoint, v2: SegPoint): number {
  return (v1.x - v0.x) * (v2.y - v0.y) - (v1.y - v0.y) * (v2.x - v0.x);
}

// ─── Array helpers ────────────────────────────────────────────────────────────

export function newQNode(qs: QNode[]): number {
  qs.push({ nodetype: 0, segnum: 0, yval: { x: 0, y: 0 }, trnum: 0, parent: 0, left: 0, right: 0 });
  return qs.length - 1;
}

export function newTrap(tr: TrapT[]): number {
  tr.push({ lseg: 0, rseg: 0, hi: { x: 0, y: 0 }, lo: { x: 0, y: 0 }, u0: 0, u1: 0, d0: 0, d1: 0, sink: 0, usave: 0, uside: 0, isValid: false });
  return tr.length - 1;
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

/**
 * Number of times log₂ must be applied before result < 1.
 * @see lib/ortho/trapezoid.c:math_logstar_n
 */
export function mathLogstarN(n: number): number {
  let i = 0;
  for (let v = n; v >= 1; i++) v = Math.log2(v);
  return i - 1;
}

/**
 * ceil(n / log^(h)(n))
 * @see lib/ortho/trapezoid.c:math_N
 */
export function mathN(n: number, h: number): number {
  let v = n;
  for (let i = 0; i < h; i++) v = Math.log2(v);
  return Math.ceil(n / v);
}
