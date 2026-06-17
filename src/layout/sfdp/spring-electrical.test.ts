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
import { parse } from '../../parser/index.js';
import { beautifyLeaves, distance } from './spring-electrical.js';
import { sfdpLayout } from './index.js';
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

// Well-connected ring + 2 leaves: oracle-stable to 6 digits (a bare star is
// not — chaotic FP symmetry). Full-precision ND_pos from sfdp 15.0.0.
const RING_LEAVES = 'graph G { beautify=true; n0--n1; n1--n2; n2--n3; n3--n4; '
  + 'n4--n5; n5--n6; n6--n7; n7--n8; n8--n9; n9--n0; n0--n5; n2--n7; n0--L1; n5--L2; }';
const ORACLE: Record<string, [number, number]> = {
  n0: [2.7899406429179132, 1.8562913086323682], n1: [4.3128775658599832, 3.4722145313936394],
  n2: [5.6611618410937865, 4.638460629425162], n3: [7.8324499203228832, 3.2305650190082797],
  n4: [7.6306254628905155, 1.6194970258954737], n5: [5.233831007064385, 2.0562617282998379],
  n6: [4.2710361744633989, 4.6183618840531846], n7: [2.7946653301296203, 4.9375851976460154],
  n8: [0.44997892990351529, 3.9623309738246637], n9: [0.37500000000000044, 2.2586564545398988],
  L1: [2.1378595911392644, 0.25], L2: [4.5689475615142596, 0.41843388937155312],
};

describe('beautifyLeaves — sfdp oracle parity (beautify=true)', () => {
  it('reproduces sfdp 15.0.0 positions for ring+2-leaves to 6 digits', () => {
    const g = parse(RING_LEAVES);
    sfdpLayout(g);
    for (const [name, [x, y]] of Object.entries(ORACLE)) {
      const n = [...g.nodes.values()].find((nn) => nn.name === name)!;
      expect(n.info.pos![0]).toBeCloseTo(x, 6);
      expect(n.info.pos![1]).toBeCloseTo(y, 6);
    }
  });
});
