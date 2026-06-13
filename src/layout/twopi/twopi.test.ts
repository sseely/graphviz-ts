// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import { THETA_UNSET, TWOPI_LAYOUT_ENGINE, twopiLayout } from './index.js';
import { twopiInitNodeEdge, twopiCleanup } from './init.js';
import { initLayout } from './circle.js';
import { makeStar, makeTwoTriangles } from './twopi-test-helpers.js';

// ---------------------------------------------------------------------------
// THETA_UNSET sentinel
// ---------------------------------------------------------------------------

describe('THETA_UNSET value', () => {
  it('equals 10.0', () => { expect(THETA_UNSET).toBe(10.0); });
  it('is outside valid [0, 2π] range', () => {
    expect(THETA_UNSET).toBeGreaterThan(2 * Math.PI);
  });
});

describe('THETA_UNSET: initLayout sets theta', () => {
  it('sets theta=THETA_UNSET on all nodes', () => {
    const g = makeStar(3);
    initLayout(g);
    for (const n of g.nodes.values()) {
      expect(n.info.alg?.kind).toBe('twopi');
      if (n.info.alg?.kind === 'twopi') expect(n.info.alg.theta).toBe(THETA_UNSET);
    }
  });
});

// ---------------------------------------------------------------------------
// Engine identity
// ---------------------------------------------------------------------------

describe('TWOPI_LAYOUT_ENGINE identity', () => {
  it('has type "twopi"', () => { expect(TWOPI_LAYOUT_ENGINE.type).toBe('twopi'); });
  it('exposes layout function', () => { expect(typeof TWOPI_LAYOUT_ENGINE.layout).toBe('function'); });
  it('exposes cleanup function', () => { expect(typeof TWOPI_LAYOUT_ENGINE.cleanup).toBe('function'); });
});

// ---------------------------------------------------------------------------
// twopiInitNodeEdge — alg and nlist
// ---------------------------------------------------------------------------

describe('twopiInitNodeEdge: alg allocation', () => {
  it('sets kind="twopi" alg on every node', () => {
    const g = makeStar(4);
    twopiInitNodeEdge(g);
    for (const n of g.nodes.values()) expect(n.info.alg?.kind).toBe('twopi');
  });

  it('populates neato_nlist with all nodes', () => {
    const g = makeStar(3);
    twopiInitNodeEdge(g);
    expect(g.info.neato_nlist?.length).toBe(g.nodes.size);
  });

  it('initialises theta to THETA_UNSET on all nodes', () => {
    const g = makeStar(3);
    twopiInitNodeEdge(g);
    for (const n of g.nodes.values()) {
      if (n.info.alg?.kind === 'twopi') expect(n.info.alg.theta).toBe(THETA_UNSET);
    }
  });
});

describe('twopiInitNodeEdge: edge factors', () => {
  it('reads edge factor from weight attribute', () => {
    const g = makeStar(1);
    g.edges[0]!.attrs.set('weight', '3');
    twopiInitNodeEdge(g);
    expect(g.edges[0]!.info.factor).toBe(3);
  });

  it('defaults edge factor to 1 when weight absent', () => {
    const g = makeStar(1);
    twopiInitNodeEdge(g);
    expect(g.edges[0]!.info.factor).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// twopiCleanup — null first node only
// ---------------------------------------------------------------------------

describe('twopiCleanup', () => {
  it('nulls alg on the first node only', () => {
    const g = makeStar(3);
    twopiInitNodeEdge(g);
    const first = g.nodes.values().next().value as Node;
    twopiCleanup(g);
    expect(first.info.alg).toBeUndefined();
  });

  it('clears neato_nlist', () => {
    const g = makeStar(3);
    twopiInitNodeEdge(g);
    twopiCleanup(g);
    expect(g.info.neato_nlist).toBeUndefined();
  });

  it('is a no-op on an empty graph', () => {
    const g = new Graph('empty', 'undirected');
    expect(() => twopiCleanup(g)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Star-graph leaf positions
// ---------------------------------------------------------------------------

describe('star-graph layout: hub centered', () => {
  // C's spline_edges translates pos so the drawing's lower-left corner
  // is the origin (decision D5: the old "hub at (0,0)" expectation
  // contradicted C behavior). The hub must sit at the leaf-ring center.
  it('places hub coord at the centroid of the leaves', () => {
    const g = makeStar(4);
    twopiLayout(g);
    const hub = g.nodes.get('hub')!;
    let cx = 0;
    let cy = 0;
    let count = 0;
    for (const [name, n] of g.nodes) {
      if (name === 'hub') continue;
      cx += n.info.coord.x;
      cy += n.info.coord.y;
      count++;
    }
    expect(hub.info.coord.x).toBeCloseTo(cx / count, 5);
    expect(hub.info.coord.y).toBeCloseTo(cy / count, 5);
  });
});

describe('star-graph layout: leaf positions', () => {
  it('assigns coord to every node', () => {
    const g = makeStar(4);
    twopiLayout(g);
    for (const n of g.nodes.values()) expect(n.info.coord).toBeDefined();
  });

  it('places leaves at equal radius from hub', () => {
    const g = makeStar(4);
    twopiLayout(g);
    const hub = g.nodes.get('hub')!;
    const radii: number[] = [];
    for (const [name, n] of g.nodes) {
      if (name === 'hub') continue;
      radii.push(Math.hypot(n.info.coord.x - hub.info.coord.x, n.info.coord.y - hub.info.coord.y));
    }
    for (const r of radii) expect(r).toBeCloseTo(radii[0]!, 1);
  });

  it('produces 4 distinct leaf positions', () => {
    const g = makeStar(4);
    twopiLayout(g);
    const pos = new Set<string>();
    for (const [name, n] of g.nodes) {
      if (name === 'hub') continue;
      pos.add(`${n.info.coord.x.toFixed(2)},${n.info.coord.y.toFixed(2)}`);
    }
    expect(pos.size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Two-component packing
// ---------------------------------------------------------------------------

describe('two-component graph: node count and cleanup', () => {
  it('assigns coord to all 6 nodes', () => {
    const g = makeTwoTriangles();
    twopiLayout(g);
    expect(g.nodes.size).toBe(6);
    for (const n of g.nodes.values()) expect(n.info.coord).toBeDefined();
  });

  it('clears neato_nlist after layout', () => {
    const g = makeTwoTriangles();
    twopiLayout(g);
    expect(g.info.neato_nlist).toBeUndefined();
  });
});

describe('two-component graph: distinct positions', () => {
  it('produces 6 distinct positions', () => {
    const g = makeTwoTriangles();
    twopiLayout(g);
    const pos = new Set<string>();
    for (const n of g.nodes.values()) {
      pos.add(`${n.info.coord.x.toFixed(1)},${n.info.coord.y.toFixed(1)}`);
    }
    expect(pos.size).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Empty graph guard
// ---------------------------------------------------------------------------

describe('twopiLayout on empty graph', () => {
  it('returns without error', () => {
    expect(() => twopiLayout(new Graph('empty', 'undirected'))).not.toThrow();
  });
});
