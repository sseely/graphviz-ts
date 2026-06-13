// SPDX-License-Identifier: EPL-2.0
/**
 * Acceptance tests for T45: neato layout engine.
 *
 * @see lib/neatogen/neatoinit.c
 * @see lib/neatogen/neatoprocs.h
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import {
  MODE_MAJOR,
  MODE_SGD,
  setSeed,
  neatoInitNode,
  neatoTranslate,
  neatoSetAspect,
} from './init.js';
import {
  NEATO_LAYOUT_ENGINE,
  neatoLayout,
  parseMode,
} from './index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Test helpers. Static class boundary forces Lizard to reset its parser
 * between methods, preventing false multi-function CCN/length violations.
 * @see stress.ts (same pattern)
 */
class H {
  static makeTriangleNodes(g: Graph): [Node, Node, Node] {
    const a = new Node(0, 'A', g); a.info.pos = [0, 0];
    const b = new Node(1, 'B', g); b.info.pos = [1, 0];
    const c = new Node(2, 'C', g); c.info.pos = [0.5, 1];
    g.nodes.set('A', a); g.nodes.set('B', b); g.nodes.set('C', c);
    return [a, b, c];
  }

  static addTriangleEdges(g: Graph, a: Node, b: Node, c: Node): void {
    const eAB = new Edge(a, b, 'AB'); eAB.info.weight = 1;
    const eBC = new Edge(b, c, 'BC'); eBC.info.weight = 1;
    const eCA = new Edge(c, a, 'CA'); eCA.info.weight = 1;
    g.edges.push(eAB, eBC, eCA);
  }

  static buildTriangle(): Graph {
    const g = new Graph('triangle', 'undirected');
    const [a, b, c] = H.makeTriangleNodes(g);
    H.addTriangleEdges(g, a, b, c);
    return g;
  }

  static hasAnyNonZeroCoord(g: Graph): boolean {
    for (const [, n] of g.nodes) {
      if (n.info.coord.x !== 0 || n.info.coord.y !== 0) return true;
    }
    return false;
  }

  static assertFiniteCoords(g: Graph): void {
    for (const [, n] of g.nodes) {
      expect(Number.isFinite(n.info.coord.x)).toBe(true);
      expect(Number.isFinite(n.info.coord.y)).toBe(true);
    }
  }
}

// ---------------------------------------------------------------------------
// Test 1: constant values
// ---------------------------------------------------------------------------

describe('neato: mode and model constants', () => {
  it('MODE_MAJOR === 1', () => { expect(MODE_MAJOR).toBe(1); });
  it('MODE_SGD === 4', () => { expect(MODE_SGD).toBe(4); });
});

// ---------------------------------------------------------------------------
// Test 2: setSeed — numeric seeds
// ---------------------------------------------------------------------------

describe('setSeed: numeric seeds', () => {
  it('start="42" sets seed to 42', () => {
    const g = new Graph('g', 'undirected');
    g.info.start = '42';
    const seed = { value: 0 };
    setSeed(g, MODE_MAJOR, seed);
    expect(seed.value).toBe(42);
  });

  it('start="random7" sets seed to 7', () => {
    const g = new Graph('g', 'undirected');
    g.info.start = 'random7';
    const seed = { value: 0 };
    setSeed(g, MODE_MAJOR, seed);
    expect(seed.value).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Test 2b: setSeed — keyword seeds
// ---------------------------------------------------------------------------

describe('setSeed: keyword seeds', () => {
  it('start="" leaves seed at 0', () => {
    const g = new Graph('g', 'undirected');
    g.info.start = '';
    const seed = { value: 99 };
    setSeed(g, MODE_MAJOR, seed);
    expect(seed.value).toBe(0);
  });

  it('start="self" leaves seed at 0', () => {
    const g = new Graph('g', 'undirected');
    g.info.start = 'self';
    const seed = { value: 99 };
    setSeed(g, MODE_MAJOR, seed);
    expect(seed.value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 3: engine descriptor
// ---------------------------------------------------------------------------

describe('NEATO_LAYOUT_ENGINE', () => {
  it('type is "neato"', () => {
    expect(NEATO_LAYOUT_ENGINE.type).toBe('neato');
  });

  it('has layout and cleanup functions', () => {
    expect(typeof NEATO_LAYOUT_ENGINE.layout).toBe('function');
    expect(typeof NEATO_LAYOUT_ENGINE.cleanup).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Test 4a: end-to-end — triangle produces non-zero coords
// ---------------------------------------------------------------------------

describe('neatoLayout: non-zero coord', () => {
  it('at least one node has non-zero coord after sgd layout', () => {
    const g = H.buildTriangle();
    g.info.mode = 'sgd';
    g.info.seed = 0;
    g.info.overlap = 'false';
    neatoLayout(g);
    expect(H.hasAnyNonZeroCoord(g)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 4b: end-to-end — all coords are finite
// ---------------------------------------------------------------------------

describe('neatoLayout: finite coords', () => {
  it('all nodes have finite coord after sgd layout', () => {
    const g = H.buildTriangle();
    g.info.mode = 'sgd';
    g.info.seed = 1;
    g.info.overlap = 'false';
    neatoLayout(g);
    H.assertFiniteCoords(g);
  });
});

// ---------------------------------------------------------------------------
// Test 5: neatoInitNode defaults
// ---------------------------------------------------------------------------

describe('neatoInitNode', () => {
  it('initialises pos to [0,0] when unset', () => {
    const g = new Graph('g', 'undirected');
    const n = new Node(0, 'n', g);
    neatoInitNode(n);
    expect(n.info.pos).toEqual([0, 0]);
  });

  it('sets default width=0.75 and height=0.5', () => {
    const g = new Graph('g', 'undirected');
    const n = new Node(0, 'n', g);
    neatoInitNode(n);
    expect(n.info.width).toBe(0.75);
    expect(n.info.height).toBe(0.5);
  });

  it('does not overwrite existing pos', () => {
    const g = new Graph('g', 'undirected');
    const n = new Node(0, 'n', g);
    n.info.pos = [3, 4];
    neatoInitNode(n);
    expect(n.info.pos).toEqual([3, 4]);
  });
});

// ---------------------------------------------------------------------------
// Test 6: neatoTranslate
// ---------------------------------------------------------------------------

describe('neatoTranslate', () => {
  it('shifts positions so minimum is (0,0)', () => {
    const g = new Graph('g', 'undirected');
    const a = new Node(0, 'A', g);
    a.info.pos = [2, 3];
    const b = new Node(1, 'B', g);
    b.info.pos = [5, 7];
    g.nodes.set('A', a);
    g.nodes.set('B', b);
    neatoTranslate(g);
    expect(a.info.pos).toEqual([0, 0]);
    expect(b.info.pos).toEqual([3, 4]);
  });
});

// ---------------------------------------------------------------------------
// Test 7: neatoSetAspect
// ---------------------------------------------------------------------------

describe('neatoSetAspect', () => {
  it('multiplies pos by 72 into coord', () => {
    const g = new Graph('g', 'undirected');
    const n = new Node(0, 'n', g);
    n.info.pos = [1, 2];
    g.nodes.set('n', n);
    neatoSetAspect(g);
    expect(n.info.coord.x).toBe(72);
    expect(n.info.coord.y).toBe(144);
  });
});

// ---------------------------------------------------------------------------
// Test 8: parseMode
// ---------------------------------------------------------------------------

describe('parseMode', () => {
  it('returns MODE_MAJOR for unset mode', () => {
    const g = new Graph('g', 'undirected');
    expect(parseMode(g)).toBe(MODE_MAJOR);
  });

  it('returns MODE_SGD for mode="sgd"', () => {
    const g = new Graph('g', 'undirected');
    g.info.mode = 'sgd';
    expect(parseMode(g)).toBe(MODE_SGD);
  });
});
