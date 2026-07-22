// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the ARM optimized-routines pow port. Reference values
 * captured from the ARM C source compiled on this machine (the
 * cases below are exact matches; ~0.07% of cases differ by 1 ULP due
 * to fma-contraction in the C build, which is the -ffp-contract=on
 * reading the plain-arithmetic port deliberately does not take).
 */

import { describe, it, expect } from 'vitest';
import { armPow } from './arm-pow.js';

/** [x, y, ARM-C pow(x, y)] triples (exact-match subset). */
const CASES: [number, number, number][] = [
  [4.920020968525897e-7, 2, 2.4206606330734504e-13],
  [0.00032701518627227175, 2, 1.0693893205268859e-7],
  [0.009611102699451878, 2, 0.00009237329509941118],
  [0.0031385649426626744, 2, 0.000009850589899311157],
  [0.004638592343184633, 2, 0.000021516538926251104],
  [0.000055551160091904445, 2, 3.085931387556397e-9],
  [0.00021370725293797015, 2, 4.567078995829355e-8],
  [5.951860711463104e-7, 2, 3.5424645928658094e-13],
  [144027.91286172744, 2, 20744039683.30535],
  [14081.84315519401, 2, 198298306.6474844],
  [0.0001578516617314849, 2, 2.4917147111391137e-8],
  [0.002386594000643761, 2, 0.000005695830923908794],
  [74296.26370514007, 2, 5519934800.543714],
  [1496367.746946307, 2, 2239116434101.167],
];

describe('armPow', () => {
  it('matches the ARM C reference on validated cases', () => {
    for (const [x, y, want] of CASES) {
      expect(armPow(x, y)).toBe(want);
    }
  });

  it('agrees with the exact result on exact squares', () => {
    expect(armPow(3, 2)).toBe(9);
    expect(armPow(2, 10)).toBe(1024);
    expect(armPow(4, 0.5)).toBeCloseTo(2, 15);
  });

  it('stays within a few ULP of Math.pow over the sfdp range', () => {
    let maxRel = 0;
    for (let i = 0; i < 5000; i++) {
      const x = Math.exp((i / 5000 - 0.5) * 20);
      const a = armPow(x, 2);
      const b = Math.pow(x, 2);
      maxRel = Math.max(maxRel, Math.abs(a - b) / Math.max(b, 1e-300));
    }
    // both are ~0.5 ULP implementations, so they differ by at most a
    // small multiple of the relative ULP (2^-52 ≈ 2.2e-16)
    expect(maxRel).toBeLessThan(1e-15);
  });

});

describe('armPow special cases (libm-faithful, never throws)', () => {
  // The special-case branch returns exactly what libm's pow returns. This is
  // load-bearing for sfdp graphs whose force loop blows up to NaN under a large
  // repulsiveforce (e.g. 2556): the native oracle emits all-nan positions, so
  // the port must reproduce NaN, not throw. @see ARM pow.c:pow
  it('propagates NaN (pow(NaN, y) = NaN for y != 0)', () => {
    expect(armPow(NaN, 101)).toBeNaN();
    expect(armPow(NaN, 2)).toBeNaN();
  });

  it('returns 1 for a zero exponent, even on nan/inf bases', () => {
    expect(armPow(5, 0)).toBe(1);
    expect(armPow(NaN, 0)).toBe(1);
    expect(armPow(Infinity, 0)).toBe(1);
  });

  it('handles zero and infinite bases like libm', () => {
    expect(armPow(0, 2)).toBe(0);
    expect(armPow(0, -2)).toBe(Infinity);
    expect(armPow(Infinity, 2)).toBe(Infinity);
    expect(armPow(Infinity, -2)).toBe(0);
  });

  it('handles negative bases (sign by integer parity; nan for non-integer y)', () => {
    expect(armPow(-3, 2)).toBe(9);   // even integer → positive
    expect(armPow(-2, 3)).toBe(-8);  // odd integer → negative
    expect(armPow(-3, 0.5)).toBeNaN(); // non-integer → invalid
  });

  it('returns 1 for pow(1, y)', () => {
    expect(armPow(1, 999)).toBe(1);
  });
});
