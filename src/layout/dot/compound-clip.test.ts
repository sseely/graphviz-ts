// SPDX-License-Identifier: EPL-2.0
//
// findVertical / findHorizontal must reject a Bézier/edge crossing whose
// coordinate is outside the box's valid range on the other axis, matching C's
// no_cross==1 y/x-range check (compound.c). Regression: a non-faithful
// `tmax-tmin < 1e-5` base case returned a valid t before that check ran, so
// ltail edges clipped to the wrong box side (1879).

import { describe, it, expect } from 'vitest';
import { findVertical, findHorizontal, splineIntersectf } from './compound-clip.js';
import type { Point } from '../../model/geom.js';

describe('findVertical — rejects a crossing outside the box y-range', () => {
  // A flat horizontal Bézier along y=0 crosses the line x=100 at y=0.
  const flat: Point[] = [{ x: 0, y: 0 }, { x: 66, y: 0 }, { x: 133, y: 0 }, { x: 200, y: 0 }];

  it('returns -1 when the x=100 crossing lies below the box [lo=10,hi=20]', () => {
    expect(findVertical(flat, 0, 1, { coord: 100, lo: 10, hi: 20 })).toBe(-1);
  });

  it('accepts the crossing when the box y-range contains y=0', () => {
    expect(findVertical(flat, 0, 1, { coord: 100, lo: -10, hi: 10 })).toBeGreaterThanOrEqual(0);
  });
});

describe('findHorizontal — rejects a crossing outside the box x-range', () => {
  const vert: Point[] = [{ x: 0, y: 0 }, { x: 0, y: 66 }, { x: 0, y: 133 }, { x: 0, y: 200 }];
  it('returns -1 when the y=100 crossing lies left of the box [lo=10,hi=20]', () => {
    expect(findHorizontal(vert, 0, 1, { coord: 100, lo: 10, hi: 20 })).toBe(-1);
  });
});

describe('splineIntersectf — clips to the bottom edge, not the far side (1879)', () => {
  it('picks the in-range bottom-edge crossing over an out-of-range side line', () => {
    // 1879 ltail geometry (port frame): the segment leaves the box bottom edge
    // (y=2611.2) at x=1710 and would cross the right-edge LINE x=1871 at
    // y=2566.9 — below the box y-range [2611.2, 2769.6]. The clip must land on
    // the bottom edge (y≈2611.2), not the right-edge false positive.
    const seg: Point[] = [
      { x: 1710, y: 2611.2 }, { x: 1710, y: 2611.2 },
      { x: 2274, y: 2456 }, { x: 2274, y: 2456 },
    ];
    const box = { ll: { x: 1487, y: 2611.2 }, ur: { x: 1871, y: 2769.6 } };
    const hit = splineIntersectf(seg, box);
    expect(hit).toBe(true);
    // seg[3] is the truncated crossing point; it must sit on the bottom edge,
    // not out at the right edge (x=1871, y≈2566.9).
    expect(seg[3]!.y).toBeCloseTo(2611.2, 1);
    expect(seg[3]!.x).toBeLessThan(1871);
  });
});
