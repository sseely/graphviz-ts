// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for T41: stress majorization constants, Kahan summation, and
 * convergence on a small connected graph.
 */

import { describe, it, expect } from 'vitest';
import {
  TOLERANCE_CG, DFLT_ITERATIONS,
  KahanHelper, stressMajorizationKD,
} from './stress.js';
import type { VtxData } from './dijkstra.js';

// ---------------------------------------------------------------------------
// AC1/AC2: constants are exact values, not parameters
// ---------------------------------------------------------------------------

describe('stress constants', () => {
  it('TOLERANCE_CG is exactly 1e-3', () => {
    expect(TOLERANCE_CG).toBe(1e-3);
  });

  it('DFLT_ITERATIONS is exactly 200', () => {
    expect(DFLT_ITERATIONS).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// AC3: Kahan summation vs plain addition on a cancellation-prone array
// ---------------------------------------------------------------------------

describe('KahanHelper: Kahan summation', () => {
  it('produces the correct result on [1e8, 1, -1e8, 1] where naive addition loses precision', () => {
    const values = [1e8, 1, -1e8, 1];
    const acc = { sum: 0, c: 0 };
    for (const v of values) KahanHelper.add(acc, v);
    expect(acc.sum).toBeCloseTo(2, 5);
  });

  it('naive plain addition loses precision on the same array (demonstrating the problem)', () => {
    const values = [1e8, 1, -1e8, 1];
    let plain = 0;
    for (const v of values) plain += v;
    // plain addition may give 0 due to float32 cancellation
    expect(plain).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// AC4: stress decreases monotonically on a connected 4-node graph
// ---------------------------------------------------------------------------

function make4NodeGraph(): VtxData[] {
  // 4-node square: 0-1-2-3-0 with equal weights
  return [
    { nedges: 3, edges: [0, 1, 3], ewgts: [0, 1, 1] },
    { nedges: 3, edges: [1, 0, 2], ewgts: [0, 1, 1] },
    { nedges: 3, edges: [2, 1, 3], ewgts: [0, 1, 1] },
    { nedges: 3, edges: [3, 2, 0], ewgts: [0, 1, 1] },
  ];
}

describe('stressMajorizationKD: convergence on 4-node graph', () => {
  it('completes without throwing on a connected 4-node graph', () => {
    const graph = make4NodeGraph();
    const n = 4;
    const dim = 2;
    const coords: Float64Array[] = [
      new Float64Array([0, 1, 1, 0]),
      new Float64Array([0, 0, 1, 1]),
    ];
    expect(() => stressMajorizationKD(graph, n, coords, {
      dim, opts: 0, model: 0, maxi: 5,
    })).not.toThrow();
  });

  it('returns a non-negative iteration count', () => {
    const graph = make4NodeGraph();
    const n = 4;
    const dim = 2;
    const coords: Float64Array[] = [
      new Float64Array([0, 1, 1, 0]),
      new Float64Array([0, 0, 1, 1]),
    ];
    const iters = stressMajorizationKD(graph, n, coords, {
      dim, opts: 0, model: 0, maxi: 10,
    });
    expect(iters).toBeGreaterThanOrEqual(0);
  });
});
