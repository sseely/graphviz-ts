// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for the SGD layout engine (T42).
 * @see lib/neatogen/sgd.c
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import {
  sgdLayout,
  MODEL_SHORTPATH,
  MODEL_CIRCUIT,
  MODEL_MDS,
} from './sgd.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a chain graph of `n` nodes with unit-weight edges. */
function buildGraph(n: number): Graph {
  const g = new Graph('test', 'undirected');
  const nodes: Node[] = [];
  for (let i = 0; i < n; i++) {
    const nd = new Node(i, String(i), g);
    g.nodes.set(String(i), nd);
    nodes.push(nd);
  }
  for (let i = 0; i < n - 1; i++) {
    const e = new Edge(nodes[i], nodes[i + 1], '');
    e.info.dist = 1;
    g.edges.push(e);
  }
  return g;
}

/** Assert every node in `g` has a finite 2D position. */
function assertFinitePositions(g: Graph): void {
  for (const [, node] of g.nodes) {
    expect(node.info.pos).toBeDefined();
    expect(node.info.pos).toHaveLength(2);
    expect(Number.isFinite(node.info.pos![0])).toBe(true);
    expect(Number.isFinite(node.info.pos![1])).toBe(true);
  }
}

// ---------------------------------------------------------------------------
// Test 1a: same seed → identical positions
// ---------------------------------------------------------------------------

describe('sgdLayout: same seed produces identical positions', () => {
  it('two runs with seed=42 produce bit-identical node positions', () => {
    const g1 = buildGraph(5);
    g1.info.seed = 42;
    sgdLayout(g1, MODEL_SHORTPATH);

    const g2 = buildGraph(5);
    g2.info.seed = 42;
    sgdLayout(g2, MODEL_SHORTPATH);

    const pos1 = [...g1.nodes.values()].map(n => n.info.pos!);
    const pos2 = [...g2.nodes.values()].map(n => n.info.pos!);
    for (let i = 0; i < 5; i++) {
      expect(pos1[i][0]).toBeCloseTo(pos2[i][0], 10);
      expect(pos1[i][1]).toBeCloseTo(pos2[i][1], 10);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 1b: different seeds → different positions
// ---------------------------------------------------------------------------

describe('sgdLayout: different seeds produce different positions', () => {
  it('seed=1 and seed=99999 yield at least one differing coordinate', () => {
    const g1 = buildGraph(5);
    g1.info.seed = 1;
    sgdLayout(g1, MODEL_SHORTPATH);

    const g2 = buildGraph(5);
    g2.info.seed = 99999;
    sgdLayout(g2, MODEL_SHORTPATH);

    const xs1 = [...g1.nodes.values()].map(n => n.info.pos![0]);
    const xs2 = [...g2.nodes.values()].map(n => n.info.pos![0]);
    const anyDiff = xs1.some((x, i) => Math.abs(x - xs2[i]) > 1e-9);
    expect(anyDiff).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 2: No Math.random in sgd.ts
// ---------------------------------------------------------------------------

describe('sgd.ts uses only MT19937, never Math.random', () => {
  it('sgd.ts source does not contain Math.random()', () => {
    const src = readFileSync(
      new URL('./sgd.ts', import.meta.url).pathname,
      'utf8',
    );
    expect(src).not.toMatch(/Math\.random\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// Test 3a: MODEL_CIRCUIT fallback
// ---------------------------------------------------------------------------

describe('MODEL_CIRCUIT fallback', () => {
  it('sgdLayout with MODEL_CIRCUIT does not throw and warns', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const g = buildGraph(4);
    g.info.seed = 0;
    expect(() => sgdLayout(g, MODEL_CIRCUIT)).not.toThrow();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('circuit model not yet supported'),
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Test 3b: MODEL_MDS fallback
// ---------------------------------------------------------------------------

describe('MODEL_MDS fallback', () => {
  it('sgdLayout with MODEL_MDS does not throw and warns', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const g = buildGraph(4);
    g.info.seed = 0;
    expect(() => sgdLayout(g, MODEL_MDS)).not.toThrow();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('mds model not yet supported'),
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Test 4a: seed === 0 default — runs without error
// ---------------------------------------------------------------------------

describe('g.info.seed === 0 default: layout runs without error', () => {
  it('sgdLayout on a 5-node graph with no seed set produces finite positions', () => {
    const g = buildGraph(5);
    expect(g.info.seed).toBeUndefined();
    expect(() => sgdLayout(g, MODEL_SHORTPATH)).not.toThrow();
    assertFinitePositions(g);
  });
});

// ---------------------------------------------------------------------------
// Test 4b: explicit seed=0 matches unset seed
// ---------------------------------------------------------------------------

describe('g.info.seed === 0 default: explicit 0 matches unset', () => {
  it('unset seed and explicit seed=0 produce identical positions', () => {
    const g1 = buildGraph(5);
    sgdLayout(g1, MODEL_SHORTPATH);

    const g2 = buildGraph(5);
    g2.info.seed = 0;
    sgdLayout(g2, MODEL_SHORTPATH);

    for (const [key, node1] of g1.nodes) {
      const node2 = g2.nodes.get(key)!;
      expect(node1.info.pos![0]).toBeCloseTo(node2.info.pos![0], 10);
      expect(node1.info.pos![1]).toBeCloseTo(node2.info.pos![1], 10);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 5: Pinned nodes are not moved
// ---------------------------------------------------------------------------

describe('pinned nodes are not moved', () => {
  it('a pinned node retains its initial position after sgdLayout', () => {
    const g = buildGraph(5);
    g.info.seed = 7;
    const first = [...g.nodes.values()][0];
    first.info.pinned = true;
    first.info.pos = [100, 200];

    sgdLayout(g, MODEL_SHORTPATH);

    expect(first.info.pos![0]).toBeCloseTo(100, 10);
    expect(first.info.pos![1]).toBeCloseTo(200, 10);
  });
});
