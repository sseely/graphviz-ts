// SPDX-License-Identifier: EPL-2.0

/**
 * Ground truth: compiled C (macOS libc) with srand48(1)/drand48().
 */

import { describe, it, expect } from 'vitest';
import { srand48, drand48 } from './random.js';

const SEED1_SEQUENCE = [
  0.041630344771878214,
  0.45449244472862915,
  0.8348172181669149,
  0.33598603014520023,
  0.56548940356613642,
  0.001766912391744313,
];

describe('drand48', () => {
  it('reproduces the libc sequence for seed 1 exactly', () => {
    srand48(1);
    for (const expected of SEED1_SEQUENCE) {
      expect(drand48()).toBe(expected);
    }
  });

  it('reseeding restarts the sequence', () => {
    srand48(1);
    drand48();
    srand48(1);
    expect(drand48()).toBe(SEED1_SEQUENCE[0]);
  });
});
