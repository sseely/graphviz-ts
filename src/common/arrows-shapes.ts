// SPDX-License-Identifier: EPL-2.0

/**
 * Arrowhead geometry — pure port of the closed-shape (normal/box/diamond/dot)
 * generators and the length/dispatch layer of lib/common/arrows.c. Complex
 * shapes (crow/vee/tee/gap/curve) live in {@link arrows-shapes-poly}; shared
 * primitives in {@link arrows-shapes-util}. Produces {@link ArrowDrawOp}s and
 * clip lengths from a resolved arrow type, a tip point, and a shaft direction.
 *
 * Convention (from `arrow_gen`/`arrow_gen_type`): `u` is the shaft vector from
 * the tip toward the base, length `ARROW_LENGTH * lenfact * arrowsize` per
 * component. Each generator returns the visual start point `q` (the base),
 * which becomes the tip of the next stacked component (compound stacking).
 *
 * @see lib/common/arrows.c
 * @see plans/arrowhead-geometry/decisions.md ADR-2
 */

import type { Point } from '../model/geom.js';
import type { ArrowDrawOp, ResolvedArrow } from './arrows-types.js';
import {
  vsub, vadd, vscale, miterShape, axialProjection, backwardDelta,
  componentU, arrowFlag, type GenResult,
} from './arrows-shapes-util.js';
import {
  genCrow, genTee, genGap, genCurve,
  arrowLengthCrow, arrowLengthTee, arrowLengthCurve,
} from './arrows-shapes-poly.js';
import {
  ARROW_LENGTH,
  ARR_TYPE_MASK, ARR_TYPE_NONE, ARR_TYPE_NORM, ARR_TYPE_CROW, ARR_TYPE_TEE,
  ARR_TYPE_BOX, ARR_TYPE_DIAMOND, ARR_TYPE_DOT, ARR_TYPE_CURVE, ARR_TYPE_GAP,
  ARR_MOD_OPEN, ARR_MOD_INV, ARR_MOD_LEFT, ARR_MOD_RIGHT,
} from './arrows-constants.js';

// ---------------------------------------------------------------------------
// arrow_type_normal0 / arrow_type_normal
// @see lib/common/arrows.c:arrow_type_normal0 (:516), arrow_type_normal (:613)
// ---------------------------------------------------------------------------

const NORMAL_ARROWWIDTH = 0.35;

/** The three modifier-resolved base/tip points feeding normal0's miter math. */
interface NormalBasePoints { baseLeft: Point; baseRight: Point; P: Point }

/** Resolve normal0's base_left/base_right/P honoring LEFT/RIGHT/INV flags. */
function normalBasePoints(u: Point, v: Point, flag: number): NormalBasePoints {
  const origin: Point = { x: 0, y: 0 };
  const vInv: Point = { x: -v.x, y: -v.y };
  const normalLeft = flag & ARR_MOD_RIGHT ? origin : vInv;
  const normalRight = flag & ARR_MOD_LEFT ? origin : v;
  return {
    baseLeft: flag & ARR_MOD_INV ? normalRight : normalLeft,
    baseRight: flag & ARR_MOD_INV ? normalLeft : normalRight,
    P: flag & ARR_MOD_INV ? u : { x: -u.x, y: -u.y },
  };
}

/** Compute `delta_tip` for normal0, honoring LEFT/RIGHT miter corrections. */
function normalDeltaTip(bp: NormalBasePoints, penwidth: number, flag: number): Point {
  const ls = miterShape(bp.baseLeft, bp.P, bp.baseRight, penwidth);
  if (!(flag & ARR_MOD_LEFT) && !(flag & ARR_MOD_RIGHT)) {
    return vsub(ls[0], bp.P); // delta_tip = P3 - P
  }
  const Pn = flag & ARR_MOD_LEFT ? ls[1] : ls[2];
  return axialProjection(bp.P, bp.P, Pn, 1);
}

/** Base/tip overlap deltas computed for normal0. */
interface NormalDeltas { base: Point; tip: Point }

/** Assemble normal0's `a[5]` + visual start `q` from the deltas (INV branch). */
function assembleNormal(
  p0: Point, u: Point, v: Point, deltas: NormalDeltas, flag: number,
): { a: Point[]; q: Point } {
  let p: Point = { x: p0.x, y: p0.y };
  let q: Point = { x: p0.x + u.x, y: p0.y + u.y };
  const a: Point[] = new Array<Point>(5);
  if (flag & ARR_MOD_INV) {
    p = vadd(p, deltas.base);
    q = vadd(q, deltas.base);
    a[0] = a[4] = p;
    a[1] = vsub(p, v);
    a[2] = q;
    a[3] = vadd(p, v);
    q = vadd(q, deltas.tip);
  } else {
    p = vsub(p, deltas.tip);
    q = vsub(q, deltas.tip);
    a[0] = a[4] = q;
    a[1] = vsub(q, v);
    a[2] = p;
    a[3] = vadd(q, v);
    q = vsub(q, deltas.base);
  }
  return { a, q };
}

/**
 * Compute the 5-point array `a` and visual start `q` for a normal arrowhead.
 *
 * @see lib/common/arrows.c:arrow_type_normal0
 */
function arrowTypeNormal0(p0: Point, u: Point, penwidth: number, flag: number): { a: Point[]; q: Point } {
  let arrowwidth = NORMAL_ARROWWIDTH;
  if (penwidth > 4) arrowwidth *= penwidth / 4;

  const v: Point = { x: -u.y * arrowwidth, y: u.x * arrowwidth };
  const bp = normalBasePoints(u, v, flag);

  let deltaBase: Point = { x: 0, y: 0 };
  let deltaTip: Point = { x: 0, y: 0 };
  if (u.x !== 0 || u.y !== 0) {
    const hyp = Math.hypot(bp.P.x, bp.P.y);
    deltaTip = normalDeltaTip(bp, penwidth, flag);
    deltaBase = { x: (penwidth / 2.0) * (bp.P.x / hyp), y: (penwidth / 2.0) * (bp.P.y / hyp) };
  }
  return assembleNormal(p0, u, v, { base: deltaBase, tip: deltaTip }, flag);
}

/** @see lib/common/arrows.c:arrow_type_normal */
function genNormal(p: Point, u: Point, _arrowsize: number, penwidth: number, flag: number): GenResult {
  const { a, q } = arrowTypeNormal0(p, u, penwidth, flag);
  const filled = !(flag & ARR_MOD_OPEN);
  let points: Point[];
  if (flag & ARR_MOD_LEFT) points = [a[0], a[1], a[2]];
  else if (flag & ARR_MOD_RIGHT) points = [a[2], a[3], a[4]];
  else points = [a[1], a[2], a[3]];
  return { ops: [{ kind: 'polygon', points, filled }], q };
}

// ---------------------------------------------------------------------------
// arrow_type_box
// @see lib/common/arrows.c:arrow_type_box (:868)
// ---------------------------------------------------------------------------

const BOX_ARROWWIDTH = 0.4;

/** @see lib/common/arrows.c:arrow_type_box */
function genBox(p0: Point, u: Point, _arrowsize: number, penwidth: number, flag: number): GenResult {
  const v: Point = { x: -u.y * BOX_ARROWWIDTH, y: u.x * BOX_ARROWWIDTH };
  const delta = backwardDelta(u, penwidth); // move backwards to not overlap node
  const p = vsub(p0, delta);
  const m = vsub({ x: p0.x + u.x * 0.8, y: p0.y + u.y * 0.8 }, delta);
  const q = vsub({ x: p0.x + u.x, y: p0.y + u.y }, delta);

  const a: Point[] = [
    { x: p.x + v.x, y: p.y + v.y },
    { x: p.x - v.x, y: p.y - v.y },
    { x: m.x - v.x, y: m.y - v.y },
    { x: m.x + v.x, y: m.y + v.y },
  ];
  if (flag & ARR_MOD_LEFT) { a[0] = p; a[3] = m; }
  else if (flag & ARR_MOD_RIGHT) { a[1] = p; a[2] = m; }
  return {
    ops: [
      { kind: 'polygon', points: a, filled: !(flag & ARR_MOD_OPEN) },
      { kind: 'polyline', points: [m, q] },
    ],
    q,
  };
}

// ---------------------------------------------------------------------------
// arrow_type_diamond0 / arrow_type_diamond
// @see lib/common/arrows.c:arrow_type_diamond0 (:926), arrow_type_diamond (:968)
// ---------------------------------------------------------------------------

/** @see lib/common/arrows.c:arrow_type_diamond0 */
function arrowTypeDiamond0(p0: Point, u: Point, penwidth: number, flag: number): { a: Point[]; q: Point } {
  const v: Point = { x: -u.y / 3.0, y: u.x / 3.0 };
  let r: Point = { x: p0.x + u.x / 2.0, y: p0.y + u.y / 2.0 };
  let q: Point = { x: p0.x + u.x, y: p0.y + u.y };
  let p: Point = { x: p0.x, y: p0.y };

  const origin: Point = { x: 0, y: 0 };
  const unmodLeft = vsub(vscale(-0.5, u), v);
  const unmodRight = vadd(vscale(-0.5, u), v);
  const baseLeft = flag & ARR_MOD_RIGHT ? origin : unmodLeft;
  const baseRight = flag & ARR_MOD_LEFT ? origin : unmodRight;
  const P = vscale(-1, u);

  const ls = miterShape(baseLeft, P, baseRight, penwidth);
  const delta = vsub(ls[0], P);

  p = vsub(p, delta);
  r = vsub(r, delta);
  q = vsub(q, delta);

  const a: Point[] = new Array<Point>(5);
  a[0] = a[4] = q;
  a[1] = { x: r.x + v.x, y: r.y + v.y };
  a[2] = p;
  a[3] = { x: r.x - v.x, y: r.y - v.y };

  q = vsub(q, delta);
  return { a, q };
}

/** @see lib/common/arrows.c:arrow_type_diamond */
function genDiamond(p: Point, u: Point, _arrowsize: number, penwidth: number, flag: number): GenResult {
  const { a, q } = arrowTypeDiamond0(p, u, penwidth, flag);
  const filled = !(flag & ARR_MOD_OPEN);
  let points: Point[];
  if (flag & ARR_MOD_LEFT) points = [a[2], a[3], a[4]];
  else if (flag & ARR_MOD_RIGHT) points = [a[0], a[1], a[2]];
  else points = [a[0], a[1], a[2], a[3]];
  return { ops: [{ kind: 'polygon', points, filled }], q };
}

// ---------------------------------------------------------------------------
// arrow_type_dot
// @see lib/common/arrows.c:arrow_type_dot (:987)
// ---------------------------------------------------------------------------

/** @see lib/common/arrows.c:arrow_type_dot */
function genDot(p0: Point, u: Point, _arrowsize: number, penwidth: number, flag: number): GenResult {
  const r = Math.hypot(u.x, u.y) / 2.0;
  const delta = backwardDelta(u, penwidth);
  const p = vsub(p0, delta);
  const center: Point = { x: p.x + u.x / 2.0, y: p.y + u.y / 2.0 };
  const q = vsub({ x: p.x + u.x, y: p.y + u.y }, delta);
  return { ops: [{ kind: 'ellipse', center, rx: r, ry: r, filled: !(flag & ARR_MOD_OPEN) }], q };
}

// ---------------------------------------------------------------------------
// Length functions
// @see lib/common/arrows.c:arrow_length_* (:1182+)
// ---------------------------------------------------------------------------

/** @see lib/common/arrows.c:arrow_length_generic */
const arrowLengthGeneric = (lenfact: number, arrowsize: number): number =>
  lenfact * arrowsize * ARROW_LENGTH;

/** @see lib/common/arrows.c:arrow_length_normal */
function arrowLengthNormal(lenfact: number, arrowsize: number, penwidth: number, flag: number): number {
  const u: Point = { x: lenfact * arrowsize * ARROW_LENGTH, y: 0 };
  const { a, q } = arrowTypeNormal0({ x: 0, y: 0 }, u, penwidth, flag);
  const base1 = a[1];
  const base2 = a[3];
  const tip = a[2];
  const fullLength = q.x;
  const nominalLength = Math.abs(base1.x - tip.x);
  const nominalBaseWidth = base2.y - base1.y;
  const fullBaseWidth = (nominalBaseWidth * fullLength) / nominalLength;
  const overlapAtBase = penwidth / 2;
  const overlapAtTip = (fullLength * penwidth) / fullBaseWidth;
  const overlap = flag & ARR_MOD_INV ? overlapAtTip : overlapAtBase;
  return fullLength - overlap;
}

/** @see lib/common/arrows.c:arrow_length_box */
const arrowLengthBox = (lenfact: number, arrowsize: number, penwidth: number): number =>
  lenfact * arrowsize * ARROW_LENGTH + penwidth / 2;

/** @see lib/common/arrows.c:arrow_length_dot */
const arrowLengthDot = (lenfact: number, arrowsize: number, penwidth: number): number =>
  lenfact * arrowsize * ARROW_LENGTH + penwidth;

/** @see lib/common/arrows.c:arrow_length_diamond */
function arrowLengthDiamond(lenfact: number, arrowsize: number, penwidth: number, flag: number): number {
  const u: Point = { x: lenfact * arrowsize * ARROW_LENGTH, y: 0 };
  const { a, q } = arrowTypeDiamond0({ x: 0, y: 0 }, u, penwidth, flag);
  const base1 = a[3];
  const base2 = a[1];
  const tip = a[2];
  const fullLength = q.x / 2;
  const nominalLength = Math.abs(base1.x - tip.x);
  const nominalBaseWidth = base2.y - base1.y;
  const fullBaseWidth = (nominalBaseWidth * fullLength) / nominalLength;
  const overlapAtTip = (fullLength * penwidth) / fullBaseWidth;
  return 2 * fullLength - overlapAtTip;
}

/**
 * Length of one resolved component (the per-type length function), matching the
 * `Arrowtypes[].len` dispatch. gap/none use `arrow_length_generic`.
 *
 * @see lib/common/arrows.c:arrow_length (per-type dispatch)
 */
export function arrowLengthOne(r: ResolvedArrow, arrowsize: number, penwidth: number): number {
  const flag = arrowFlag(r);
  switch (r.type & ARR_TYPE_MASK) {
    case ARR_TYPE_NORM: return arrowLengthNormal(r.lenfact, arrowsize, penwidth, flag);
    case ARR_TYPE_CROW: return arrowLengthCrow(r.lenfact, arrowsize, penwidth, flag);
    case ARR_TYPE_TEE: return arrowLengthTee(r.lenfact, arrowsize, penwidth);
    case ARR_TYPE_BOX: return arrowLengthBox(r.lenfact, arrowsize, penwidth);
    case ARR_TYPE_DIAMOND: return arrowLengthDiamond(r.lenfact, arrowsize, penwidth, flag);
    case ARR_TYPE_DOT: return arrowLengthDot(r.lenfact, arrowsize, penwidth);
    case ARR_TYPE_CURVE: return arrowLengthCurve(r.lenfact, arrowsize, penwidth);
    default: return arrowLengthGeneric(r.lenfact, arrowsize);
  }
}

/**
 * Total clip length over a parsed compound arrow (sum of component lengths).
 * Returns 0 when arrowsize is 0, matching `arrow_length`.
 *
 * @see lib/common/arrows.c:arrow_length (:253)
 */
export function arrowLength(comps: ResolvedArrow[], arrowsize: number, penwidth: number): number {
  if (arrowsize === 0) return 0;
  let length = 0;
  const n = Math.min(comps.length, 4); // NUMB_OF_ARROW_HEADS
  for (let i = 0; i < n; i++) length += arrowLengthOne(comps[i], arrowsize, penwidth);
  return length;
}

// ---------------------------------------------------------------------------
// Dispatch + compound stacking
// @see lib/common/arrows.c:arrow_gen_type (:1090), arrow_gen (:1142)
// ---------------------------------------------------------------------------

/**
 * Generate draw ops for ONE resolved component at `tip`, with shaft direction
 * `dir` (tip → base). Dispatches across all eight arrow types.
 *
 * @see lib/common/arrows.c:arrow_gen_type
 */
export function dispatchSimple(
  r: ResolvedArrow, tip: Point, dir: Point, arrowsize: number, penwidth: number,
): GenResult {
  const flag = arrowFlag(r);
  const u = componentU(dir, r.lenfact, arrowsize);
  switch (r.type & ARR_TYPE_MASK) {
    case ARR_TYPE_CROW: return genCrow(tip, u, arrowsize, penwidth, flag);
    case ARR_TYPE_TEE: return genTee(tip, u, arrowsize, penwidth, flag);
    case ARR_TYPE_BOX: return genBox(tip, u, arrowsize, penwidth, flag);
    case ARR_TYPE_DIAMOND: return genDiamond(tip, u, arrowsize, penwidth, flag);
    case ARR_TYPE_DOT: return genDot(tip, u, arrowsize, penwidth, flag);
    case ARR_TYPE_CURVE: return genCurve(tip, u, arrowsize, penwidth, flag);
    case ARR_TYPE_GAP: return genGap(tip, u, arrowsize, penwidth, flag);
    case ARR_TYPE_NORM:
    default:
      return genNormal(tip, u, arrowsize, penwidth, flag);
  }
}

/**
 * Generate all draw ops for a parsed compound arrow (up to 4 stacked
 * components). Each component is drawn at the running tip and advances the tip
 * to its base, matching `arrow_gen`'s loop. Stops at the first NONE component.
 *
 * @see lib/common/arrows.c:arrow_gen
 */
export function arrowDrawOps(
  comps: ResolvedArrow[], tip: Point, dir: Point, arrowsize: number, penwidth: number,
): ArrowDrawOp[] {
  const ops: ArrowDrawOp[] = [];
  let p = tip;
  const n = Math.min(comps.length, 4); // NUMB_OF_ARROW_HEADS
  for (let i = 0; i < n; i++) {
    const r = comps[i];
    if ((r.type & ARR_TYPE_MASK) === ARR_TYPE_NONE) break;
    const res = dispatchSimple(r, p, dir, arrowsize, penwidth);
    ops.push(...res.ops);
    p = res.q;
  }
  return ops;
}
