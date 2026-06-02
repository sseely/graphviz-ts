// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the fdp layout pipeline: fdpLayout, fdpEngine, and the
 * temperature / position orchestration functions.
 *
 * @see lib/fdpgen/layout.c:fdp_layout
 * @see lib/fdpgen/tlayout.c:fdp_tLayout
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import {
  fdpLayout,
  fdpEngine,
} from './index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class H {
  static makeNode(id: number, name: string, g: Graph, x = 0, y = 0): Node {
    const n = new Node(id, name, g);
    n.info.pos = [x, y];
    g.nodes.set(name, n);
    return n;
  }

  static buildTriangle(): Graph {
    const g = new Graph('tri', 'undirected');
    const a = H.makeNode(0, 'A', g, 0, 0);
    const b = H.makeNode(1, 'B', g, 1, 0);
    const c = H.makeNode(2, 'C', g, 0.5, 1);
    const eAB = new Edge(a, b, 'AB'); eAB.info.factor = 1; eAB.info.dist = 1;
    const eBC = new Edge(b, c, 'BC'); eBC.info.factor = 1; eBC.info.dist = 1;
    const eCA = new Edge(c, a, 'CA'); eCA.info.factor = 1; eCA.info.dist = 1;
    g.edges.push(eAB, eBC, eCA);
    return g;
  }

  static buildPair(): Graph {
    const g = new Graph('pair', 'undirected');
    const a = H.makeNode(0, 'A', g, 0, 0);
    const b = H.makeNode(1, 'B', g, 1, 0);
    const e = new Edge(a, b, 'AB');
    e.info.factor = 1; e.info.dist = 1;
    g.edges.push(e);
    return g;
  }

  static buildPinnedPair(): { g: Graph; fixed: Node } {
    const g = new Graph('g', 'undirected');
    const fixed = H.makeNode(0, 'Fixed', g, 10, 10);
    fixed.info.pinned = true;
    fixed.attrs.set('pos', '10,10!');
    H.makeNode(1, 'Free', g, 0, 0);
    return { g, fixed };
  }

  static allCoordsFinite(g: Graph): boolean {
    for (const [, n] of g.nodes) {
      if (!Number.isFinite(n.info.coord.x)) return false;
      if (!Number.isFinite(n.info.coord.y)) return false;
    }
    return true;
  }

  static anyCoordNonZero(g: Graph): boolean {
    for (const [, n] of g.nodes) {
      if (n.info.coord.x !== 0 || n.info.coord.y !== 0) return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// fdpEngine — plugin descriptor
// ---------------------------------------------------------------------------

describe('fdpEngine: engine descriptor', () => {
  it('type is "fdp"', () => {
    expect(fdpEngine.type).toBe('fdp');
  });

  it('has layout and cleanup functions', () => {
    expect(typeof fdpEngine.layout).toBe('function');
    expect(typeof fdpEngine.cleanup).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// fdpLayout() — triangle graph
// ---------------------------------------------------------------------------

describe('fdpLayout: triangle graph', () => {
  it('all coords are finite after layout', () => {
    const g = H.buildTriangle();
    g.attrs.set('K', '1.0'); g.attrs.set('maxiter', '10');
    fdpLayout(g);
    expect(H.allCoordsFinite(g)).toBe(true);
  });

  it('at least one coord is non-zero', () => {
    const g = H.buildTriangle();
    g.attrs.set('K', '1.0'); g.attrs.set('maxiter', '10');
    fdpLayout(g);
    expect(H.anyCoordNonZero(g)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fdpLayout() — simple edge cases
// ---------------------------------------------------------------------------

describe('fdpLayout: single and empty graphs', () => {
  it('isolated node produces finite coord', () => {
    const g = new Graph('g', 'undirected');
    H.makeNode(0, 'A', g, 0, 0);
    fdpLayout(g);
    expect(H.allCoordsFinite(g)).toBe(true);
  });

  it('empty graph does not throw', () => {
    const g = new Graph('empty', 'undirected');
    expect(() => fdpLayout(g)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fdpLayout() — two-node graph
// ---------------------------------------------------------------------------

describe('fdpLayout: two-node graph', () => {
  it('produces finite coords', () => {
    const g = H.buildPair();
    g.attrs.set('maxiter', '5');
    fdpLayout(g);
    expect(H.allCoordsFinite(g)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fdpLayout() — pinned node
// ---------------------------------------------------------------------------

describe('fdpLayout: pinned node', () => {
  it('pinned node retains its position after layout', () => {
    const { g, fixed } = H.buildPinnedPair();
    g.attrs.set('maxiter', '5');
    fdpLayout(g);
    expect(fixed.info.coord.x).toBeCloseTo(10);
    expect(fixed.info.coord.y).toBeCloseTo(10);
  });
});

// ---------------------------------------------------------------------------
// fdpLayout() — naive (no-grid) path
// ---------------------------------------------------------------------------

describe('fdpLayout: naive repulsion path', () => {
  it('small K forces naive path and still produces finite coords', () => {
    const g = H.buildTriangle();
    g.attrs.set('K', '0.001'); g.attrs.set('maxiter', '5');
    fdpLayout(g);
    expect(H.allCoordsFinite(g)).toBe(true);
  });
});
