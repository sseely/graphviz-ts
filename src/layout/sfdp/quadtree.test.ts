// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the Barnes-Hut QuadTree. The key invariant: with bh = 0
 * the opening criterion never accepts an aggregated cell, so every
 * supernode is an individual leaf - the approximation degrades to
 * exact all-pairs. That checks the tree against brute force without an
 * oracle.
 */

import { describe, it, expect } from 'vitest';
import {
  type QuadTree,
  quadTreeNewFromPointList,
  quadTreeGetSupernodes,
} from './quadtree.js';

const MINDIST = 1e-15;

/** Deterministic 2D point cloud. */
function points(n: number): number[] {
  const x: number[] = [];
  let s = 7;
  for (let i = 0; i < 2 * n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    x.push((s / 0x7fffffff) * 10 - 5);
  }
  return x;
}

/** Brute-force repulsive force on node i (KP = 1, p = -1). */
function directForce(x: number[], dim: number, n: number, i: number): number[] {
  const f = [0, 0];
  for (let j = 0; j < n; j++) {
    if (j === i) continue;
    let d = 0;
    for (let k = 0; k < dim; k++) {
      const dd = x[i * dim + k]! - x[j * dim + k]!;
      d += dd * dd;
    }
    const dist = Math.max(Math.sqrt(d), MINDIST);
    for (let k = 0; k < dim; k++) {
      f[k]! += (x[i * dim + k]! - x[j * dim + k]!) / (dist * dist);
    }
  }
  return f;
}

/** Repulsive force on node i via the quadtree's supernodes. */
function qtForce(
  qt: QuadTree, x: number[], dim: number, i: number, bh: number,
): number[] {
  const { nsuper, center, supernodeWgts, distances } =
    quadTreeGetSupernodes(qt, bh, x, i * dim, i);
  const f = [0, 0];
  for (let j = 0; j < nsuper; j++) {
    const dist = Math.max(distances[j]!, MINDIST);
    for (let k = 0; k < dim; k++) {
      f[k]! += supernodeWgts[j]! * (x[i * dim + k]! - center[j * dim + k]!)
        / (dist * dist);
    }
  }
  return f;
}

describe('QuadTree bh=0 (exact all-pairs)', () => {
  it('yields exactly the other n-1 leaves as supernodes', () => {
    const n = 30;
    const x = points(n);
    const qt = quadTreeNewFromPointList(2, n, 10, x);
    for (let i = 0; i < n; i++) {
      const { nsuper, supernodeWgts } = quadTreeGetSupernodes(qt, 0, x, i * 2, i);
      expect(nsuper).toBe(n - 1);
      for (let j = 0; j < nsuper; j++) expect(supernodeWgts[j]).toBe(1);
    }
  });

  it('reproduces the brute-force repulsive sum', () => {
    const n = 25;
    const x = points(n);
    const qt = quadTreeNewFromPointList(2, n, 10, x);
    for (let i = 0; i < n; i++) {
      const fd = directForce(x, 2, n, i);
      const fq = qtForce(qt, x, 2, i, 0);
      expect(fq[0]).toBeCloseTo(fd[0]!, 9);
      expect(fq[1]).toBeCloseTo(fd[1]!, 9);
    }
  });
});

describe('QuadTree aggregation', () => {
  it('aggregates a distant cluster at bh=0.6', () => {
    const x = [0, 0, 0.01, 0, 0, 0.01, 0.01, 0.01, 100, 100];
    const qt = quadTreeNewFromPointList(2, 5, 10, x);
    const { nsuper } = quadTreeGetSupernodes(qt, 0.6, x, 8, 4);
    expect(nsuper).toBeLessThan(4);
    expect(nsuper).toBeGreaterThan(0);
  });
});
