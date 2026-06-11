// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for the fdp engine port (15.0.0 spec).
 *
 * The end-to-end expectations are full-precision ND_pos values dumped
 * from the installed graphviz 15.0.0 binary (the same build that
 * generated the golden refs) via a C probe reading ND_pos directly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '../../model/graph.js';
import { parse } from '../../parser/index.js';
import { Grid } from './grid.js';
import { Node } from '../../model/node.js';
import {
  fdpInitParams,
  setSeedFdp,
  classifyStart,
  parms,
  fdpParms,
  INIT_RANDOM,
  INIT_REGULAR,
  INIT_SELF,
} from './tlayout-parms.js';
import { deriveGraph, type LayoutInfo } from './derive.js';
import { findCComp } from './comp.js';
import { initInfo, mkClusters } from './layout.js';
import { fdpInitGraph, fdpLayoutEngine } from './index.js';
import { fdpInitNodeEdge } from './init.js';
import { gdata, dndata, getDnode, realEdges } from './fdp-model.js';

const SIMPLE = `graph G {
  A -- B; A -- C; B -- D; C -- D; D -- E; E -- F; F -- A;
}`;

const TWO_COMPONENTS = `graph G {
  A -- B; C -- D;
}`;

const CLUSTERED = `graph G {
  subgraph cluster_0 { label="Left"; A -- B -- C; }
  subgraph cluster_1 { label="Right"; D -- E -- F; }
  C -- D;
}`;

function freshInfo(g: Graph): LayoutInfo {
  return initInfo(g);
}

describe('Grid', () => {
  it('walks cells in ascending (i, j) order — the dtwalk order', () => {
    const g = new Graph('g', 'directed');
    const grid = new Grid();
    const mk = (id: number): Node => new Node(id, `n${id}`, g);
    grid.add(1, 0, mk(0));
    grid.add(-1, 2, mk(1));
    grid.add(0, -3, mk(2));
    grid.add(-1, -2, mk(3));
    const visits: Array<[number, number]> = [];
    grid.walk((c) => visits.push([c.i, c.j]));
    expect(visits).toEqual([[-1, -2], [-1, 2], [0, -3], [1, 0]]);
  });

  it('prepends nodes within a cell (reverse insertion order)', () => {
    const g = new Graph('g', 'directed');
    const grid = new Grid();
    const a = new Node(0, 'a', g);
    const b = new Node(1, 'b', g);
    grid.add(0, 0, a);
    grid.add(0, 0, b);
    expect(grid.find(0, 0)!.nodes.map((n) => n.name)).toEqual(['b', 'a']);
  });
});

describe('fdpInitParams', () => {
  beforeEach(() => {
    fdpParms.T0 = -1.0;
    fdpParms.K = -1.0;
  });

  it('resolves the C defaults: K=0.3, maxiter=600, Cell=3K, pass1=300', () => {
    const g = parse(SIMPLE);
    fdpInitParams(g);
    expect(parms.K).toBe(0.3);
    expect(parms.maxIters).toBe(600);
    expect(parms.Cell).toBeCloseTo(0.9, 15);
    expect(parms.pass1).toBe(300);
    expect(parms.seed).toBe(1);
    expect(parms.smode).toBe(INIT_RANDOM);
    expect(parms.useGrid).toBe(1);
    expect(parms.useNew).toBe(1);
  });

  it('honors maxiter and K attributes', () => {
    const g = parse(SIMPLE);
    g.attrs.set('maxiter', '100');
    g.attrs.set('K', '0.6');
    fdpInitParams(g);
    expect(parms.maxIters).toBe(100);
    expect(parms.K).toBe(0.6);
    expect(parms.pass1).toBe(50);
  });
});

describe('setSeedFdp / classifyStart', () => {
  it('returns the default mode when start is unset', () => {
    const g = parse(SIMPLE);
    const seed = { value: 1 };
    expect(setSeedFdp(g, INIT_RANDOM, seed)).toBe(INIT_RANDOM);
    expect(seed.value).toBe(1);
  });

  it('parses a numeric start as a random seed', () => {
    const g = parse(SIMPLE);
    g.attrs.set('start', '42');
    const seed = { value: 1 };
    expect(setSeedFdp(g, INIT_RANDOM, seed)).toBe(INIT_RANDOM);
    expect(seed.value).toBe(42);
  });

  it('classifies keyword prefixes per C setSeed', () => {
    expect(classifyStart('self', INIT_RANDOM).init).toBe(INIT_SELF);
    expect(classifyStart('regular', INIT_RANDOM).init).toBe(INIT_REGULAR);
    expect(classifyStart('random7', INIT_RANDOM)).toEqual({
      init: INIT_RANDOM,
      rest: '7',
    });
  });
});

describe('deriveGraph', () => {
  it('mirrors a flat graph with creation-ordered canonical edges', () => {
    const g = parse(SIMPLE);
    fdpInitGraph(g);
    const dg = deriveGraph(g, freshInfo(g))!;
    expect(dg.nodes.size).toBe(6);
    expect(dg.edges.length).toBe(7);
    // F -- A canonicalizes to A→F (tail = earlier-created node)
    const fa = dg.edges.find(
      (e) => e.tail.name === 'A' && e.head.name === 'F');
    expect(fa).toBeDefined();
    expect(realEdges(fa!).length).toBe(1);
    // every real node maps to its derived image
    for (const n of g.nodes.values()) {
      expect(getDnode(n)!.name).toBe(n.name);
    }
  });

  it('collapses clusters to single derived nodes', () => {
    const g = parse(CLUSTERED);
    fdpInitGraph(g);
    const dg = deriveGraph(g, freshInfo(g))!;
    // two cluster dnodes; C--D becomes one derived edge between them
    expect(dg.nodes.size).toBe(2);
    expect(dg.edges.length).toBe(1);
    const de = dg.edges[0]!;
    expect(dndata(de.tail).clust!.name).toBe('cluster_0');
    expect(dndata(de.head).clust!.name).toBe('cluster_1');
    expect(de.info.count).toBe(1);
  });

  it('merges parallel real edges into one counted derived edge', () => {
    const g = parse('graph G { A -- B; A -- B; }');
    fdpInitGraph(g);
    const dg = deriveGraph(g, freshInfo(g))!;
    expect(dg.edges.length).toBe(1);
    expect(dg.edges[0]!.info.count).toBe(2);
    expect(realEdges(dg.edges[0]!).length).toBe(2);
  });
});

describe('findCComp', () => {
  it('separates disconnected components with id-ordered node maps', () => {
    const g = parse(TWO_COMPONENTS);
    fdpInitGraph(g);
    const dg = deriveGraph(g, freshInfo(g))!;
    const { comps, pinned } = findCComp(dg, { value: 0 });
    expect(comps.length).toBe(2);
    expect(pinned).toBe(false);
    expect([...comps[0]!.nodes.keys()]).toEqual(['A', 'B']);
    expect([...comps[1]!.nodes.keys()]).toEqual(['C', 'D']);
    expect(comps[0]!.edges.length).toBe(1);
  });
});

describe('mkClusters', () => {
  it('attaches cluster lists with levels and parents', () => {
    const g = parse(CLUSTERED);
    gdata(g);
    mkClusters(g, null, g);
    expect(g.info.n_cluster).toBe(2);
    const c0 = g.info.clust![0]!;
    expect(c0.name).toBe('cluster_0');
    expect(gdata(c0).level).toBe(1);
    expect(gdata(c0).parent).toBe(g);
  });
});

describe('fdpInitNodeEdge', () => {
  it('defaults edge dist to K and factor to weight', () => {
    const g = parse('graph G { A -- B [weight=2]; B -- C; }');
    gdata(g);
    fdpInitParams(g);
    fdpInitNodeEdge(g);
    const [ab, bc] = g.edges;
    expect(ab!.info.factor).toBe(2);
    expect(ab!.info.dist).toBe(0.3);
    expect(bc!.info.factor).toBe(1);
    expect(bc!.info.dist).toBe(0.3);
  });
});

describe('fdpLayoutEngine oracle parity', () => {
  it('reproduces the C binary positions for fdp-simple (inches)', () => {
    const g = parse(SIMPLE);
    fdpLayoutEngine(g);
    // Full-precision ND_pos from graphviz 15.0.0 (fdp-oracle probe)
    const expected: Record<string, [number, number]> = {
      A: [0.73565685231550637, 0.95081201001870741],
      B: [2.1557979615773393, 0.87561471491424159],
      C: [1.2669986123129777, 0.25],
      D: [1.7653927523775672, 1.5407139417694784],
      E: [1.3271635377648716, 2.2691443120820569],
      F: [0.375, 1.6449794941618794],
    };
    for (const [name, [x, y]] of Object.entries(expected)) {
      const n = g.nodes.get(name)!;
      expect(n.info.pos![0]).toBeCloseTo(x, 12);
      expect(n.info.pos![1]).toBeCloseTo(y, 12);
    }
  });
});
