// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for beautifyLeaves (SFDP-1).
 *
 * beautify_leaves fans a node's degree-1 leaves radially around it at their
 * average distance, evenly over [pad, 2*PI-pad] with pad=0.1. The radial and
 * angular invariants are checked independently of the fma placement.
 *
 * @see lib/sfdpgen/spring_electrical.c:beautify_leaves
 */

import { describe, it, expect } from 'vitest';
import { beautifyLeaves, distance } from './spring-electrical.js';
import type { SpMatrix } from './sparse-matrix.js';

/** Minimal CSR carrying only the fields beautifyLeaves reads (ia, ja, m). */
function csr(m: number, ia: number[], ja: number[]): SpMatrix {
  return { m, n: m, nz: ja.length, ia, ja, a: null, type: 0, format: 1 } as unknown as SpMatrix;
}

const PAD = 0.1;
// Star: center 0 with degree-1 leaves 1,2,3 (no diagonal).
const STAR = csr(4, [0, 3, 4, 5, 6], [1, 2, 3, 0, 0, 0]);

describe('beautifyLeaves — radial distance', () => {
  it('fans leaves to the average distance, leaving the center fixed', () => {
    // center (10,20); leaves at distances 3,4,5 → avg 4.
    const x = [10, 20, 13, 20, 10, 24, 10, 15];
    beautifyLeaves(2, STAR, x);
    expect([x[0], x[1]]).toEqual([10, 20]);
    for (const leaf of [1, 2, 3]) expect(distance(x, 2, 0, leaf)).toBeCloseTo(4, 9);
  });
});

describe('beautifyLeaves — angular fan', () => {
  it('assigns evenly-spaced angles from pad, in ja order', () => {
    const x = [0, 0, 3, 0, 0, 4, 0, -5];
    beautifyLeaves(2, STAR, x);
    const step = (2 * Math.PI - 2 * PAD) / 3;
    [1, 2, 3].forEach((leaf, t) => {
      let ang = Math.atan2(x[leaf * 2 + 1]!, x[leaf * 2]!);
      if (ang < 0) ang += 2 * Math.PI; // atan2 is [-PI,PI]; fan exceeds PI
      expect(ang).toBeCloseTo(PAD + t * step, 9);
    });
  });
});

describe('beautifyLeaves — no leaves', () => {
  it('leaves a graph with no degree-1 nodes unchanged', () => {
    const TRI = csr(3, [0, 2, 4, 6], [1, 2, 0, 2, 0, 1]); // triangle, all degree 2
    const x = [1, 2, 3, 4, 5, 6];
    const before = [...x];
    beautifyLeaves(2, TRI, x);
    expect(x).toEqual(before);
  });
});
