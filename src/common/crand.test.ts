// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the C rand() stream port. Expected values captured from a
 * C program on the reference machine (srand/rand from Apple Libc).
 */

import { describe, it, expect } from 'vitest';
import { csrand, crand, cdrand, gvRandom, gvPermutation, C_RAND_MAX } from './crand.js';

describe('crand', () => {
  it('reproduces the srand(123) stream of the reference libc', () => {
    csrand(123);
    expect(crand()).toBe(2067261);
    expect(crand()).toBe(384717275);
    expect(crand()).toBe(2017463455);
    expect(crand()).toBe(888985702);
    expect(crand()).toBe(1138961335);
    expect(crand()).toBe(2001411634);
  });

  it('cdrand is rand()/RAND_MAX', () => {
    csrand(123);
    expect(cdrand()).toBe(2067261 / C_RAND_MAX);
  });

});

describe('gv_random helpers', () => {
  it('gvRandom rejects above the discard threshold and reduces mod bound', () => {
    csrand(123);
    const v = gvRandom(10);
    expect(v).toBe(2067261 % 10);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(10);
  });

  it('gvPermutation is a permutation and consumes the stream', () => {
    csrand(123);
    const p = gvPermutation(8);
    expect([...p].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // deterministic given the seed
    csrand(123);
    expect(gvPermutation(8)).toEqual(p);
  });
});
