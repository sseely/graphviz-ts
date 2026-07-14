// SPDX-License-Identifier: EPL-2.0

import { describe, expect, it } from 'vitest';
import { cround } from './arith.js';

/**
 * Oracle values below are C's libm `round()` (half away from zero), which is
 * also what `ROUND(f) = ((f>=0)?(int)(f+.5):(int)(f-.5))` computes.
 * @see lib/common/arith.h:48
 */
describe('cround', () => {
  it('breaks exact ties away from zero, where Math.round breaks toward +inf', () => {
    // The whole reason this helper exists: these four disagree with Math.round
    // on the negative side.
    expect(cround(-4.5)).toBe(-5);
    expect(cround(-0.5)).toBe(-1);
    expect(cround(-1.5)).toBe(-2);
    expect(cround(-2.5)).toBe(-3);

    // Math.round would give -4 / -0 / -1 / -2 here.
    expect(Math.round(-4.5)).toBe(-4);
  });

  it('agrees with Math.round on positive ties', () => {
    expect(cround(4.5)).toBe(5);
    expect(cround(0.5)).toBe(1);
    expect(cround(2.5)).toBe(3);
  });

  it('rounds non-ties to nearest in both directions', () => {
    expect(cround(-4.4)).toBe(-4);
    expect(cround(-4.6)).toBe(-5);
    expect(cround(4.4)).toBe(4);
    expect(cround(4.6)).toBe(5);
    expect(cround(-1.6)).toBe(-2);
    expect(cround(11.6)).toBe(12);
  });

  it('is the identity on integers', () => {
    expect(cround(8)).toBe(8);
    expect(cround(-8)).toBe(-8);
    expect(cround(0)).toBe(0);
  });

  it('preserves C round()\'s signed-zero behaviour on small negatives', () => {
    // C: round(-0.2) == -0.0. Math.ceil(-0.7) is likewise -0.
    expect(Object.is(cround(-0.2), -0)).toBe(true);
    // C: round(-0.0) == -0.0; we yield +0. Numerically equal (-0 === 0) and
    // both stringify to "0", so no emitted coordinate can observe this.
    expect(cround(-0)).toBe(0);
    expect(Object.is(cround(0), 0)).toBe(true);
  });
});
