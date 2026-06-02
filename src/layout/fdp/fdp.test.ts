// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for fdp force primitives: displacement, forces, and position update.
 *
 * @see lib/fdpgen/tlayout.c
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import {
  getDisp,
  zeroDisp,
  jitter,
  safeDelta,
  repForce,
  attrForce,
  withinCell,
  moveNode,
  applyRep,
  applyAttr,
  computeAttractive,
  type ForceCtx,
  type AttrEdgeInfo,
} from './forces.js';
import {
  cool,
  computeT0,
  randomisePositions,
  posToCoord,
  coordToPos,
  fdpXLayout,
} from './index.js';
import { fdpInitParams } from './init.js';

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
}

// ---------------------------------------------------------------------------
// cool() — temperature schedule
// ---------------------------------------------------------------------------

describe('cool: temperature schedule', () => {
  it('returns T0 at t=0', () => {
    expect(cool(10, 100, 0)).toBeCloseTo(10);
  });

  it('returns 0 at t=maxIter', () => {
    expect(cool(10, 100, 100)).toBeCloseTo(0);
  });

  it('returns half T0 at midpoint', () => {
    expect(cool(10, 100, 50)).toBeCloseTo(5);
  });

  it('decreases monotonically', () => {
    const temps = [0, 10, 25, 50, 75, 99].map(t => cool(10, 100, t));
    for (let i = 1; i < temps.length; i++) {
      expect(temps[i]).toBeLessThan(temps[i - 1]!);
    }
  });
});

// ---------------------------------------------------------------------------
// computeT0() — initial temperature
// ---------------------------------------------------------------------------

describe('computeT0: initial temperature', () => {
  it('returns params.T0 when non-negative', () => {
    const p = fdpInitParams(new Graph('g', 'undirected'));
    p.T0 = 5.0;
    expect(computeT0(p, 9)).toBeCloseTo(5.0);
  });

  it('auto-computes from Tfact * K * sqrt(n) / 5 when T0 = -1', () => {
    const p = fdpInitParams(new Graph('g', 'undirected'));
    p.T0 = -1; p.K = 1.0; p.Tfact = 1.0;
    expect(computeT0(p, 25)).toBeCloseTo(1.0);
  });
});

// ---------------------------------------------------------------------------
// jitter() — always returns non-zero vector
// ---------------------------------------------------------------------------

describe('jitter: non-zero output', () => {
  it('never returns [0, 0]', () => {
    for (let i = 0; i < 100; i++) {
      const [xd, yd] = jitter();
      expect(xd * xd + yd * yd).toBeGreaterThan(0);
    }
  });

  it('values are in [-5, 5]', () => {
    for (let i = 0; i < 50; i++) {
      const [xd, yd] = jitter();
      expect(Math.abs(xd)).toBeLessThanOrEqual(5);
      expect(Math.abs(yd)).toBeLessThanOrEqual(5);
    }
  });
});

// ---------------------------------------------------------------------------
// safeDelta()
// ---------------------------------------------------------------------------

describe('safeDelta: position delta', () => {
  it('returns correct delta for separated nodes', () => {
    const g = new Graph('g', 'undirected');
    const a = H.makeNode(0, 'A', g, 0, 0);
    const b = H.makeNode(1, 'B', g, 3, 4);
    const [xd, yd] = safeDelta(a, b);
    expect(xd).toBeCloseTo(3);
    expect(yd).toBeCloseTo(4);
  });

  it('jitters when nodes are co-located', () => {
    const g = new Graph('g', 'undirected');
    const a = H.makeNode(0, 'A', g, 2, 2);
    const b = H.makeNode(1, 'B', g, 2, 2);
    const [xd, yd] = safeDelta(a, b);
    expect(xd * xd + yd * yd).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// repForce()
// ---------------------------------------------------------------------------

describe('repForce: repulsion force', () => {
  const ctx: ForceCtx = { K: 1.0, useNew: false };

  it('proportional mode: K² / dist²', () => {
    expect(repForce(4, ctx)).toBeCloseTo(0.25);
  });

  it('Hooke mode: K² / (sqrt(dist²) * dist²)', () => {
    const hookCtx: ForceCtx = { K: 1.0, useNew: true };
    expect(repForce(4, hookCtx)).toBeCloseTo(0.125);
  });

  it('larger K yields larger force', () => {
    const weak: ForceCtx = { K: 1.0, useNew: false };
    const strong: ForceCtx = { K: 2.0, useNew: false };
    expect(repForce(4, strong)).toBeGreaterThan(repForce(4, weak));
  });
});

// ---------------------------------------------------------------------------
// attrForce()
// ---------------------------------------------------------------------------

describe('attrForce: attractive force', () => {
  const info: AttrEdgeInfo = { factor: 1.0, edgeDist: 2.0 };

  it('proportional mode: factor * dist / edgeDist', () => {
    expect(attrForce(4, info, false)).toBeCloseTo(2.0);
  });

  it('Hooke mode: factor * (dist - edgeDist) / dist', () => {
    expect(attrForce(4, info, true)).toBeCloseTo(0.5);
  });

  it('zero when dist equals edgeDist in Hooke mode', () => {
    expect(attrForce(2, info, true)).toBeCloseTo(0);
  });
});

// ---------------------------------------------------------------------------
// getDisp / zeroDisp
// ---------------------------------------------------------------------------

describe('getDisp / zeroDisp: displacement buffer', () => {
  it('allocates [0, 0] on first call', () => {
    const g = new Graph('g', 'undirected');
    const n = H.makeNode(0, 'N', g);
    expect(getDisp(n)).toEqual([0, 0]);
  });

  it('returns the same array on repeated calls', () => {
    const g = new Graph('g', 'undirected');
    const n = H.makeNode(0, 'N', g);
    const d1 = getDisp(n);
    d1[0] = 99;
    expect(getDisp(n)[0]).toBe(99);
  });

  it('zeroDisp resets to [0, 0]', () => {
    const g = new Graph('g', 'undirected');
    const n = H.makeNode(0, 'N', g);
    const d = getDisp(n);
    d[0] = 5; d[1] = -3;
    zeroDisp(n);
    expect(d).toEqual([0, 0]);
  });
});

// ---------------------------------------------------------------------------
// withinCell()
// ---------------------------------------------------------------------------

describe('withinCell: distance check', () => {
  it('returns true when nodes are within cellSize', () => {
    const g = new Graph('g', 'undirected');
    const a = H.makeNode(0, 'A', g, 0, 0);
    const b = H.makeNode(1, 'B', g, 0.5, 0);
    expect(withinCell(a, b, 1.0)).toBe(true);
  });

  it('returns false when nodes exceed cellSize', () => {
    const g = new Graph('g', 'undirected');
    const a = H.makeNode(0, 'A', g, 0, 0);
    const b = H.makeNode(1, 'B', g, 2, 0);
    expect(withinCell(a, b, 1.0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyRep()
// ---------------------------------------------------------------------------

describe('applyRep: mutual repulsion', () => {
  it('pushes nodes apart and produces equal-opposite displacements', () => {
    const g = new Graph('g', 'undirected');
    const a = H.makeNode(0, 'A', g, 0, 0);
    const b = H.makeNode(1, 'B', g, 2, 0);
    const ctx: ForceCtx = { K: 1.0, useNew: false };
    zeroDisp(a); zeroDisp(b);
    applyRep(a, b, ctx);
    const da = getDisp(a);
    const db = getDisp(b);
    expect(da[0]).toBeLessThan(0);
    expect(db[0]).toBeGreaterThan(0);
    expect(da[0]).toBeCloseTo(-db[0]);
  });
});

// ---------------------------------------------------------------------------
// applyAttr()
// ---------------------------------------------------------------------------

describe('applyAttr: edge attraction', () => {
  it('pulls nodes toward each other in proportional mode', () => {
    const g = new Graph('g', 'undirected');
    const a = H.makeNode(0, 'A', g, 0, 0);
    const b = H.makeNode(1, 'B', g, 4, 0);
    const info: AttrEdgeInfo = { factor: 1.0, edgeDist: 1.0 };
    const ctx: ForceCtx = { K: 1.0, useNew: false };
    zeroDisp(a); zeroDisp(b);
    applyAttr(a, b, info, ctx);
    expect(getDisp(a)[0]).toBeGreaterThan(0);
    expect(getDisp(b)[0]).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeAttractive()
// ---------------------------------------------------------------------------

describe('computeAttractive: edge filtering', () => {
  it('ignores self-loops', () => {
    const g = new Graph('g', 'undirected');
    const a = H.makeNode(0, 'A', g, 0, 0);
    const loop = new Edge(a, a, 'loop');
    loop.info.factor = 1; loop.info.dist = 1;
    g.edges.push(loop);
    zeroDisp(a);
    computeAttractive(g, [a], { K: 1.0, useNew: false });
    expect(getDisp(a)).toEqual([0, 0]);
  });

  it('ignores edges whose endpoints are outside the node set', () => {
    const g = new Graph('g', 'undirected');
    const a = H.makeNode(0, 'A', g, 0, 0);
    const b = H.makeNode(1, 'B', g, 3, 0);
    const e = new Edge(a, b, 'AB');
    e.info.factor = 1; e.info.dist = 1;
    g.edges.push(e);
    zeroDisp(a);
    computeAttractive(g, [a], { K: 1.0, useNew: false });
    expect(getDisp(a)).toEqual([0, 0]);
  });
});

// ---------------------------------------------------------------------------
// moveNode()
// ---------------------------------------------------------------------------

describe('moveNode: position cap', () => {
  it('applies full displacement when within temperature cap', () => {
    const g = new Graph('g', 'undirected');
    const n = H.makeNode(0, 'N', g, 0, 0);
    const d = getDisp(n);
    d[0] = 1; d[1] = 1;
    moveNode(n, 10);
    expect(n.info.pos![0]).toBeCloseTo(1);
    expect(n.info.pos![1]).toBeCloseTo(1);
  });

  it('caps displacement at temperature', () => {
    const g = new Graph('g', 'undirected');
    const n = H.makeNode(0, 'N', g, 0, 0);
    getDisp(n)[0] = 100;
    moveNode(n, 1.0);
    expect(n.info.pos![0]).toBeCloseTo(1.0);
  });

  it('skips pinned nodes', () => {
    const g = new Graph('g', 'undirected');
    const n = H.makeNode(0, 'N', g, 5, 5);
    n.info.pinned = true;
    getDisp(n)[0] = 10; getDisp(n)[1] = 10;
    moveNode(n, 100);
    expect(n.info.pos![0]).toBe(5);
    expect(n.info.pos![1]).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// randomisePositions()
// ---------------------------------------------------------------------------

describe('randomisePositions: initial placement', () => {
  it('all non-pinned nodes receive positions within expected range', () => {
    const g = new Graph('g', 'undirected');
    const nodes = Array.from({ length: 4 }, (_, i) => new Node(i, `N${i}`, g));
    randomisePositions(nodes, 1.0);
    const half = 1.0 * (Math.sqrt(4) + 1.0) * 1.2 / 2;
    for (const n of nodes) {
      expect(n.info.pos).toBeDefined();
      expect(Math.abs(n.info.pos![0])).toBeLessThanOrEqual(half + 1e-9);
      expect(Math.abs(n.info.pos![1])).toBeLessThanOrEqual(half + 1e-9);
    }
  });

  it('pinned nodes are not repositioned', () => {
    const g = new Graph('g', 'undirected');
    const n = new Node(0, 'N', g);
    n.info.pos = [99, 99]; n.info.pinned = true;
    randomisePositions([n], 1.0);
    expect(n.info.pos[0]).toBe(99);
    expect(n.info.pos[1]).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// posToCoord / coordToPos / fdpXLayout
// ---------------------------------------------------------------------------

describe('posToCoord: copies pos to coord', () => {
  it('sets coord from pos', () => {
    const g = new Graph('g', 'undirected');
    const n = H.makeNode(0, 'N', g, 3, 7);
    posToCoord(n);
    expect(n.info.coord.x).toBeCloseTo(3);
    expect(n.info.coord.y).toBeCloseTo(7);
  });

  it('sets default width/height when zero', () => {
    const g = new Graph('g', 'undirected');
    const n = H.makeNode(0, 'N', g, 1, 1);
    n.info.width = 0; n.info.height = 0;
    posToCoord(n);
    expect(n.info.width).toBe(0.5);
    expect(n.info.height).toBe(0.5);
  });

  it('does nothing when pos is absent', () => {
    const g = new Graph('g', 'undirected');
    const n = new Node(0, 'N', g);
    n.info.pos = undefined;
    n.info.coord.x = 42;
    posToCoord(n);
    expect(n.info.coord.x).toBe(42);
  });
});

describe('coordToPos: copies coord to pos', () => {
  it('sets pos from coord', () => {
    const g = new Graph('g', 'undirected');
    const n = new Node(0, 'N', g);
    n.info.coord.x = 5; n.info.coord.y = 8;
    coordToPos(n);
    expect(n.info.pos![0]).toBeCloseTo(5);
    expect(n.info.pos![1]).toBeCloseTo(8);
  });
});

describe('fdpXLayout: single-node passthrough', () => {
  it('does nothing for fewer than 2 nodes', () => {
    const g = new Graph('g', 'undirected');
    const n = H.makeNode(0, 'N', g, 3, 7);
    const origX = n.info.coord.x;
    fdpXLayout([n]);
    expect(n.info.coord.x).toBe(origX);
  });
});
