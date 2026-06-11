// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the software fused multiply-add.
 */

import { describe, it, expect } from 'vitest';
import { fma, fms } from './fma.js';

describe('fma', () => {
  it('matches plain arithmetic when no double rounding occurs', () => {
    expect(fma(2, 3, 4)).toBe(10);
    expect(fma(0.5, 0.5, 0.25)).toBe(0.5);
    expect(fma(-2, 3, 4)).toBe(-2);
  });

  it('keeps the product bits a separate mul+add would lose', () => {
    // a·b = 1 + 2^-26 + 2^-54; c cancels the leading 1 + 2^-26.
    // Plain (a*b + c) rounds a·b to 1 + 2^-26 first and yields 0;
    // a true fma preserves 2^-54.
    const a = 1 + 2 ** -27;
    const c = -(1 + 2 ** -26);
    expect(a * a + c).toBe(0);
    expect(fma(a, a, c)).toBe(2 ** -54);
  });

  it('handles sign and zero correctly', () => {
    expect(fma(0, 5, 3)).toBe(3);
    expect(fma(5, 0, -3)).toBe(-3);
    expect(fma(1, 1, -1)).toBe(0);
  });

  it('fms computes c − a·b with one rounding', () => {
    expect(fms(2, 3, 10)).toBe(4);
    const a = 1 + 2 ** -27;
    expect(fms(a, a, 1 + 2 ** -26)).toBe(-(2 ** -54));
  });
});
