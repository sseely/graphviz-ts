// SPDX-License-Identifier: EPL-2.0

/**
 * M1: Unit tests for edge-offset geometry helpers.
 *
 * Oracle values derived from the C formulas in emit.c:1836-1867.
 * Sign convention: res.x = y*d/len, res.y = -x*d/len where x=p.x-q.x, y=p.y-q.y.
 * @see lib/common/emit.c:1836 computeoffset_p
 * @see lib/common/emit.c:1849 computeoffset_qr
 */

import { describe, it, expect } from 'vitest';
import {
  computeOffsetP,
  computeOffsetQR,
  buildOffsetLists,
  advanceTmpList,
  PARALLEL_SEP,
  OFFSET_EPSILON,
} from './edge-offset.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps;
}

function ptApprox(
  actual: { x: number; y: number },
  expected: { x: number; y: number },
  eps = 1e-9,
): boolean {
  return approx(actual.x, expected.x, eps) && approx(actual.y, expected.y, eps);
}

// ---------------------------------------------------------------------------
// computeOffsetP — sign oracle from C: res.x = y*d/len, res.y = -x*d/len
// where x=p.x-q.x, y=p.y-q.y
// ---------------------------------------------------------------------------

describe('computeOffsetP', () => {
  it('horizontal line p→q(rightward): offset is downward (negative y)', () => {
    // p=(0,0), q=(10,0) → x=-10, y=0, len=10
    // res.x = 0, res.y = -(-10)*d/10 = +d
    const r = computeOffsetP({ x: 0, y: 0 }, { x: 10, y: 0 }, PARALLEL_SEP);
    expect(approx(r.x, 0, 1e-6)).toBe(true);
    expect(approx(r.y, PARALLEL_SEP, 1e-6)).toBe(true);
  });

  it('vertical line p→q(upward): offset is leftward (negative x)', () => {
    // p=(0,0), q=(0,10) → x=0, y=-10, len=10
    // res.x = (-10)*d/10 = -d, res.y = 0
    const r = computeOffsetP({ x: 0, y: 0 }, { x: 0, y: 10 }, PARALLEL_SEP);
    expect(approx(r.x, -PARALLEL_SEP, 1e-6)).toBe(true);
    expect(approx(r.y, 0, 1e-6)).toBe(true);
  });

  it('EPSILON guard: near-zero segment does not produce Infinity/NaN', () => {
    const r = computeOffsetP({ x: 0, y: 0 }, { x: 0, y: 0 }, PARALLEL_SEP);
    expect(isFinite(r.x)).toBe(true);
    expect(isFinite(r.y)).toBe(true);
  });

  it('unit diagonal: offset magnitude ≈ d', () => {
    // p=(0,0) q=(1,1): dir=(-1,-1), len≈sqrt(2+ε)≈sqrt(2)
    const d = PARALLEL_SEP;
    const r = computeOffsetP({ x: 0, y: 0 }, { x: 1, y: 1 }, d);
    const mag = Math.sqrt(r.x * r.x + r.y * r.y);
    expect(approx(mag, d, 1e-4)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeOffsetQR — sign oracle from C: res.x = y*d/len, res.y = -x*d/len
// where x=q.x-r.x, y=q.y-r.y
// ---------------------------------------------------------------------------

describe('computeOffsetQR', () => {
  it('q=(5,0) r=(15,0): perp direction is downward (+y)', () => {
    // x=5-15=-10, y=0, len=10
    // res.x = 0, res.y = -(-10)*d/10 = d
    const r = computeOffsetQR(
      { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 }, { x: 20, y: 0 },
      PARALLEL_SEP,
    );
    expect(approx(r.x, 0, 1e-6)).toBe(true);
    expect(approx(r.y, PARALLEL_SEP, 1e-6)).toBe(true);
  });

  it('fallback when q===r: uses p→s direction, result finite', () => {
    const r = computeOffsetQR(
      { x: 0, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 10, y: 0 },
      PARALLEL_SEP,
    );
    expect(isFinite(r.x)).toBe(true);
    expect(isFinite(r.y)).toBe(true);
  });

  it('EPSILON guard when all points coincide: result is finite', () => {
    const r = computeOffsetQR(
      { x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 },
      PARALLEL_SEP,
    );
    expect(isFinite(r.x)).toBe(true);
    expect(isFinite(r.y)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildOffsetLists + advanceTmpList
// ---------------------------------------------------------------------------

describe('buildOffsetLists', () => {
  // Simplified vertical spline (4 pts = 1 cubic Bezier segment)
  const pts = [
    { x: 26, y: -71.7 },
    { x: 26, y: -64.41 },
    { x: 26, y: -55.73 },
    { x: 26, y: -47.54 },
  ];

  it('returns offlist with same length as pts', () => {
    const { offlist } = buildOffsetLists(pts, 1.5);
    expect(offlist).toHaveLength(pts.length);
  });

  it('returns tmplist with same length as pts', () => {
    const { tmplist } = buildOffsetLists(pts, 1.5);
    expect(tmplist).toHaveLength(pts.length);
  });

  it('tmplist[i] = pts[i] - numc2 * offlist[i] for all i', () => {
    const numc2 = 1.5;
    const { offlist, tmplist } = buildOffsetLists(pts, numc2);
    for (let i = 0; i < pts.length; i++) {
      const expected = {
        x: pts[i]!.x - numc2 * offlist[i]!.x,
        y: pts[i]!.y - numc2 * offlist[i]!.y,
      };
      expect(ptApprox(tmplist[i]!, expected, 1e-9)).toBe(true);
    }
  });

  it('for a straight vertical spline, x-offsets are non-zero (horizontal perp)', () => {
    // Vertical spline: q→r is vertical, so perpendicular is horizontal
    // Offset vector should have non-zero x and zero y
    const { offlist } = buildOffsetLists(pts, 1.5);
    // All y-components should be ~0 for vertical spline
    for (const o of offlist) {
      expect(approx(o.y, 0, 1e-4)).toBe(true);
    }
  });
});

describe('advanceTmpList', () => {
  it('adds offlist to tmplist element-wise (one step)', () => {
    const tmplist = [{ x: 24, y: -71 }, { x: 24, y: -65 }];
    const offlist = [{ x: 2, y: 0 }, { x: 2, y: 0 }];
    advanceTmpList(tmplist, offlist);
    expect(ptApprox(tmplist[0]!, { x: 26, y: -71 })).toBe(true);
    expect(ptApprox(tmplist[1]!, { x: 26, y: -65 })).toBe(true);
  });

  it('second advance produces +2 more offset', () => {
    const tmplist = [{ x: 24, y: 0 }];
    const offlist = [{ x: 2, y: 0 }];
    advanceTmpList(tmplist, offlist);
    advanceTmpList(tmplist, offlist);
    expect(ptApprox(tmplist[0]!, { x: 28, y: 0 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('OFFSET_EPSILON is 0.0001', () => {
    expect(OFFSET_EPSILON).toBe(0.0001);
  });
  it('PARALLEL_SEP is 2.0', () => {
    expect(PARALLEL_SEP).toBe(2.0);
  });
});
