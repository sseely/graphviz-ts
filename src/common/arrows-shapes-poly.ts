// SPDX-License-Identifier: EPL-2.0

/**
 * Complex arrowhead shape/length generators (crow/vee, tee, gap, curve) ported
 * from lib/common/arrows.c. Split from {@link arrows-shapes} to keep each
 * module under the size/complexity bar. Pure geometry; no layout/render deps.
 *
 * @see lib/common/arrows.c
 */

import type { Point } from '../model/geom.js';
import type { GenResult } from './arrows-shapes-util.js';
import {
  vsub, vadd, miterShape, negUnit, backwardDelta, axialProjection,
} from './arrows-shapes-util.js';
import {
  ARROW_LENGTH, ARR_MOD_INV, ARR_MOD_LEFT, ARR_MOD_RIGHT,
} from './arrows-constants.js';

// ===========================================================================
// crow / vee  (G2 target: the 9-point polygon)
// @see lib/common/arrows.c:arrow_type_crow0 (:632), arrow_type_crow (:774)
// ===========================================================================

const CROW_ARROWWIDTH = 0.45;

/** crow0 locals bundled to keep helper signatures within the parameter bar. */
interface CrowGeom {
  p0: Point; u: Point; v: Point; w: Point; m: Point; q0: Point; P: Point;
}
interface CrowBase { baseLeft: Point; baseRight: Point; P: Point }

/** Resolve crow0's base_left/base_right/P (note: arms are v/v_inv, tip is +u). */
function crowBasePoints(u: Point, v: Point, flag: number): CrowBase {
  const origin: Point = { x: 0, y: 0 };
  const vInv: Point = { x: -v.x, y: -v.y };
  const normalLeft = flag & ARR_MOD_RIGHT ? origin : v;
  const normalRight = flag & ARR_MOD_LEFT ? origin : vInv;
  return {
    baseLeft: flag & ARR_MOD_INV ? normalRight : normalLeft,
    baseRight: flag & ARR_MOD_INV ? normalLeft : normalRight,
    P: flag & ARR_MOD_INV ? { x: -u.x, y: -u.y } : u,
  };
}

/** crow0's delta_tip (miter point P1/P2/P3 selected by LEFT/RIGHT/INV). */
function crowDeltaTip(bp: CrowBase, penwidth: number, flag: number): Point {
  const ls = miterShape(bp.baseLeft, bp.P, bp.baseRight, penwidth);
  if (!(flag & ARR_MOD_LEFT) && !(flag & ARR_MOD_RIGHT)) return vsub(ls[0], bp.P);
  const useP2 = !!(flag & ARR_MOD_LEFT) === !!(flag & ARR_MOD_INV);
  return axialProjection(bp.P, bp.P, useP2 ? ls[2] : ls[1], 1);
}

/** crow0's delta_base: penwidth offset for vee, or the toe miter for crow. */
function crowDeltaBase(g: CrowGeom, penwidth: number, flag: number): Point {
  if (flag & ARR_MOD_INV) return negUnit(g.P, -penwidth / 2.0); // vee: +pw/2 along P
  // crow: the toes extend by the right-toe miter projection (negated).
  const toeBaseLeft = vadd(vsub(g.m, g.q0), g.w);
  const toeP = vsub(g.v, g.u);
  const ls = miterShape(toeBaseLeft, toeP, { x: 0, y: 0 }, penwidth);
  return axialProjection(g.P, toeP, ls[1], -1);
}

/** Assemble crow0's a[9] + visual start q for the vee (INV) branch. */
function assembleVee(g: CrowGeom, base: Point, tip: Point): { a: Point[]; q: Point } {
  const p = vsub(g.p0, tip);
  const qs = vsub(g.q0, tip);
  const a: Point[] = [
    p, vsub(qs, g.v), vsub(g.m, g.w), vsub(qs, g.w), qs,
    vadd(qs, g.w), vadd(g.m, g.w), vadd(qs, g.v), p,
  ];
  return { a, q: vsub(qs, base) };
}

/** Assemble crow0's a[9] + visual start q for the crow branch. */
function assembleCrowHead(g: CrowGeom, base: Point, tip: Point): { a: Point[]; q: Point } {
  const ps = vadd(g.p0, base);
  const qs = vadd(g.q0, base);
  const toeTip = vadd(ps, base); // C: a[3..5] = p (already shifted) + delta_base
  const a: Point[] = [
    qs, vsub(ps, g.v), vsub(g.m, g.w), toeTip, toeTip,
    toeTip, vadd(g.m, g.w), vadd(ps, g.v), qs,
  ];
  return { a, q: vadd(qs, tip) };
}

/** @see lib/common/arrows.c:arrow_type_crow0 */
function arrowTypeCrow0(p0: Point, u: Point, arrowsize: number, penwidth: number, flag: number): { a: Point[]; q: Point } {
  let arrowwidth = CROW_ARROWWIDTH;
  if (penwidth > 4 * arrowsize && flag & ARR_MOD_INV) arrowwidth *= penwidth / (4 * arrowsize);
  let shaftwidth = 0;
  if (penwidth > 1 && flag & ARR_MOD_INV) shaftwidth = (0.05 * (penwidth - 1)) / arrowsize;

  const v: Point = { x: -u.y * arrowwidth, y: u.x * arrowwidth };
  const w: Point = { x: -u.y * shaftwidth, y: u.x * shaftwidth };
  const q0: Point = { x: p0.x + u.x, y: p0.y + u.y };
  const m: Point = { x: p0.x + u.x * 0.5, y: p0.y + u.y * 0.5 };
  const P: Point = flag & ARR_MOD_INV ? { x: -u.x, y: -u.y } : u;
  const g: CrowGeom = { p0, u, v, w, m, q0, P };

  let base: Point = { x: 0, y: 0 };
  let tip: Point = { x: 0, y: 0 };
  if (u.x !== 0 || u.y !== 0) {
    tip = crowDeltaTip(crowBasePoints(u, v, flag), penwidth, flag);
    base = crowDeltaBase(g, penwidth, flag);
  }
  return flag & ARR_MOD_INV ? assembleVee(g, base, tip) : assembleCrowHead(g, base, tip);
}

/** @see lib/common/arrows.c:arrow_type_crow (always filled; OPEN has no effect) */
export function genCrow(p: Point, u: Point, arrowsize: number, penwidth: number, flag: number): GenResult {
  const { a, q } = arrowTypeCrow0(p, u, arrowsize, penwidth, flag);
  let points: Point[];
  if (flag & ARR_MOD_LEFT) points = a.slice(0, 5);
  else if (flag & ARR_MOD_RIGHT) points = a.slice(4, 9);
  else points = a.slice(0, 8);
  return { ops: [{ kind: 'polygon', points, filled: true }], q };
}

/** @see lib/common/arrows.c:arrow_length_crow */
export function arrowLengthCrow(lenfact: number, arrowsize: number, penwidth: number, flag: number): number {
  const u: Point = { x: lenfact * arrowsize * ARROW_LENGTH, y: 0 };
  const { a, q } = arrowTypeCrow0({ x: 0, y: 0 }, u, arrowsize, penwidth, flag);
  const base1 = a[1];
  const fullLength = q.x;
  const fullLengthWithoutShaft = fullLength - (base1.x - a[3].x);
  const nominalLength = Math.abs(base1.x - a[0].x);
  const nominalBaseWidth = a[7].y - base1.y;
  const fullBaseWidth = (nominalBaseWidth * fullLengthWithoutShaft) / nominalLength;
  const overlapAtBase = penwidth / 2;
  const overlapAtTip = (fullLengthWithoutShaft * penwidth) / fullBaseWidth;
  const overlap = flag & ARR_MOD_INV ? overlapAtBase : overlapAtTip;
  return fullLength - overlap;
}

// ===========================================================================
// gap (none) — a polyline with no fill
// @see lib/common/arrows.c:arrow_type_gap (:791)
// ===========================================================================

/** @see lib/common/arrows.c:arrow_type_gap */
export function genGap(p0: Point, u: Point, _arrowsize: number, _penwidth: number, _flag: number): GenResult {
  const q: Point = { x: p0.x + u.x, y: p0.y + u.y };
  return { ops: [{ kind: 'polyline', points: [p0, q] }], q };
}

// ===========================================================================
// tee — a thick bar (polygon) + a shaft polyline
// @see lib/common/arrows.c:arrow_type_tee (:808)
// ===========================================================================

/** @see lib/common/arrows.c:arrow_type_tee */
export function genTee(p0: Point, u: Point, _arrowsize: number, penwidth: number, flag: number): GenResult {
  const v: Point = { x: -u.y, y: u.x };
  const length = Math.hypot(u.x, u.y);
  const extend = penwidth / 2 - 0.2 * length;
  const delta = length > 0 && extend > 0 ? negUnit(u, extend) : { x: 0, y: 0 };
  const p = vsub(p0, delta);
  const m = vsub({ x: p0.x + u.x * 0.2, y: p0.y + u.y * 0.2 }, delta);
  const n = vsub({ x: p0.x + u.x * 0.6, y: p0.y + u.y * 0.6 }, delta);
  const q = vsub({ x: p0.x + u.x, y: p0.y + u.y }, delta);

  const a: Point[] = [
    { x: m.x + v.x, y: m.y + v.y },
    { x: m.x - v.x, y: m.y - v.y },
    { x: n.x - v.x, y: n.y - v.y },
    { x: n.x + v.x, y: n.y + v.y },
  ];
  if (flag & ARR_MOD_LEFT) { a[0] = m; a[3] = n; }
  else if (flag & ARR_MOD_RIGHT) { a[1] = m; a[2] = n; }
  return {
    ops: [
      { kind: 'polygon', points: a, filled: true },
      { kind: 'polyline', points: [p, q] },
    ],
    q,
  };
}

/** @see lib/common/arrows.c:arrow_length_tee (preserves the C `_at_start` reuse) */
export function arrowLengthTee(lenfact: number, arrowsize: number, penwidth: number): number {
  const nominal = lenfact * arrowsize * ARROW_LENGTH;
  let length = nominal;
  const extendStart = penwidth / 2 - (1 - 0.6) * nominal;
  if (extendStart > 0) length += extendStart;
  const extendEnd = penwidth / 2 - 0.2 * nominal;
  if (extendStart > 0) length += extendEnd; // C checks `_at_start` here too; preserved
  return length;
}

// ===========================================================================
// curve / icurve — a shaft polyline + a concave Bézier
// @see lib/common/arrows.c:arrow_type_curve (:1031)
// ===========================================================================

const lerp = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Split a cubic at t=0.5 (de Casteljau); return the left or right half. */
function cubicHalf(c: Point[], rightHalf: boolean): Point[] {
  const A = lerp(c[0], c[1]);
  const B = lerp(c[1], c[2]);
  const C = lerp(c[2], c[3]);
  const D = lerp(A, B);
  const E = lerp(B, C);
  const M = lerp(D, E);
  return rightHalf ? [M, E, C, c[3]] : [c[0], A, D, M];
}

/** Build the four Bézier control points for the curve arms. */
function curveControlPoints(p: Point, v: Point, w: Point, flag: number): Point[] {
  const AF0: Point = { x: p.x + v.x + w.x, y: p.y + v.y + w.y };
  const AF3: Point = { x: p.x - v.x + w.x, y: p.y - v.y + w.y };
  const s = flag & ARR_MOD_INV ? 1 : -1; // inv bulges the curve the other way
  const AF1: Point = { x: p.x + 0.95 * v.x + w.x + s * w.x * (4.0 / 3.0), y: AF0.y + s * w.y * (4.0 / 3.0) };
  const AF2: Point = { x: p.x - 0.95 * v.x + w.x + s * w.x * (4.0 / 3.0), y: AF3.y + s * w.y * (4.0 / 3.0) };
  return [AF0, AF1, AF2, AF3];
}

/** @see lib/common/arrows.c:arrow_type_curve */
export function genCurve(p0: Point, u: Point, _arrowsize: number, penwidth: number, flag: number): GenResult {
  const arrowwidth = penwidth > 4 ? (0.5 * penwidth) / 4 : 0.5;
  const noShift = (flag & ARR_MOD_INV) || (u.x === 0 && u.y === 0);
  const p = noShift ? p0 : vsub(p0, backwardDelta(u, penwidth));
  const q: Point = { x: p.x + u.x, y: p.y + u.y };
  const v: Point = { x: -u.y * arrowwidth, y: u.x * arrowwidth };
  const w: Point = { x: v.y, y: -v.x };
  let af = curveControlPoints(p, v, w, flag);
  if (flag & ARR_MOD_LEFT) af = cubicHalf(af, true);
  else if (flag & ARR_MOD_RIGHT) af = cubicHalf(af, false);
  return {
    ops: [
      { kind: 'polyline', points: [p0, q] },
      { kind: 'bezier', points: af },
    ],
    q,
  };
}

/** @see lib/common/arrows.c:arrow_length_curve */
export const arrowLengthCurve = (lenfact: number, arrowsize: number, penwidth: number): number =>
  lenfact * arrowsize * ARROW_LENGTH + penwidth / 2;
