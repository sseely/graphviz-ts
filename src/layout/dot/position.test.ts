// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for the dot position phase: setXcoords (AD-8), setYcoords,
 * connectGraph, setAspect, cluster helpers, and the dotPosition entry point.
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import type { RankEntry } from '../../model/rankEntry.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { setXcoords } from './position.js';
import {
  edgeListCrossesRank, rankHasCrossEdge,
  nsiter2, expandRankSlots,
} from './position.js';
import {
  dotComputeBb, scaleBb,
  rankNormalXRange, firstNormalNode, lastNormalNode,
} from './position-bbox.js';
import {
  subgraphBounds,
  interclexpMergeable, interclexpRanksEq, interclexpHeadHigher,
} from './cluster.js';
import { mapInterclustNode, makeSlots } from './cluster-path.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRankEntry(): RankEntry {
  return {
    n: 0, v: [], an: 0, av: [],
    ht1: 0, ht2: 0, pht1: 0, pht2: 0,
    candidate: false, valid: false, cache_nc: 0,
  };
}

export function makeTestGraph(nNodes: number): [Graph, Node[]] {
  const g = new Graph('test', 'directed');
  const nodes: Node[] = [];
  for (let i = 0; i < nNodes; i++) {
    const n = new Node(i, `n${i}`, g);
    n.info = makeNodeInfo();
    g.nodes.set(n.name, n);
    nodes.push(n);
  }
  return [g, nodes];
}

export function addTestEdge(g: Graph, tail: Node, head: Node): Edge {
  const e = new Edge(tail, head, '');
  g.edges.push(e);
  if (!tail.info.out) tail.info.out = { list: [], size: 0 };
  tail.info.out.list[tail.info.out.size++] = e;
  if (!head.info.in) head.info.in = { list: [], size: 0 };
  head.info.in.list[head.info.in.size++] = e;
  return e;
}

export function setupRanks(g: Graph, rankAssignments: number[]): Node[][] {
  const mn = Math.min(...rankAssignments);
  const mx = Math.max(...rankAssignments);
  g.info.minrank = mn;
  g.info.maxrank = mx;
  g.info.rank = [];
  for (let r = mn; r <= mx; r++) {
    g.info.rank[r] = makeRankEntry();
  }
  const perRank: Node[][] = [];
  for (let r = mn; r <= mx; r++) perRank[r] = [];
  const nodes = Array.from(g.nodes.values());
  for (let i = 0; i < rankAssignments.length; i++) {
    const r = rankAssignments[i];
    const n = nodes[i];
    n.info.rank = r;
    perRank[r].push(n);
  }
  for (let r = mn; r <= mx; r++) {
    g.info.rank[r].v = perRank[r];
    g.info.rank[r].n = perRank[r].length;
  }
  return perRank;
}

// ---------------------------------------------------------------------------
// AD-8: setXcoords — x-coord write and rank restore
// ---------------------------------------------------------------------------

describe('setXcoords: x-coord and rank restore (AD-8)', () => {
  it('writes ND_rank as x-coord and restores rank index', () => {
    const [g, nodes] = makeTestGraph(3);
    setupRanks(g, [0, 1, 2]);
    nodes[0].info.rank = 42;
    nodes[1].info.rank = 100;
    nodes[2].info.rank = 200;
    setXcoords(g);
    expect(nodes[0].info.coord.x).toBe(42);
    expect(nodes[1].info.coord.x).toBe(100);
    expect(nodes[2].info.coord.x).toBe(200);
    expect(nodes[0].info.rank).toBe(0);
    expect(nodes[1].info.rank).toBe(1);
    expect(nodes[2].info.rank).toBe(2);
  });
});

describe('setXcoords: flags and edge cases', () => {
  it('clears rankIsXCoord flag after restoring ranks', () => {
    const [g, nodes] = makeTestGraph(1);
    setupRanks(g, [0]);
    nodes[0].info.rank = 5;
    g.info.rankIsXCoord = true;
    setXcoords(g);
    expect(g.info.rankIsXCoord).toBe(false);
  });

  it('handles empty graph gracefully', () => {
    const [g] = makeTestGraph(0);
    g.info.minrank = 0;
    g.info.maxrank = -1;
    g.info.rank = [];
    expect(() => setXcoords(g)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// edgeListCrossesRank / rankHasCrossEdge
// ---------------------------------------------------------------------------

describe('edgeListCrossesRank', () => {
  it('returns false for undefined list', () => {
    expect(edgeListCrossesRank(undefined, 1)).toBe(false);
  });

  it('returns true when head rank exceeds r', () => {
    const [g, nodes] = makeTestGraph(2);
    nodes[0].info.rank = 0;
    nodes[1].info.rank = 2;
    const e = addTestEdge(g, nodes[0], nodes[1]);
    const list = { list: [e], size: 1 };
    expect(edgeListCrossesRank(list, 1)).toBe(true);
  });

  it('returns false when no edge crosses rank', () => {
    const [g, nodes] = makeTestGraph(2);
    nodes[0].info.rank = 0;
    nodes[1].info.rank = 1;
    const e = addTestEdge(g, nodes[0], nodes[1]);
    const list = { list: [e], size: 1 };
    expect(edgeListCrossesRank(list, 1)).toBe(false);
  });
});

describe('rankHasCrossEdge', () => {
  it('returns false when rank has no cross edges', () => {
    const [, nodes] = makeTestGraph(2);
    nodes[0].info.rank = 0;
    nodes[1].info.rank = 0;
    const rk = { v: [nodes[0], nodes[1]], n: 2 };
    expect(rankHasCrossEdge(rk, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// nsiter2
// ---------------------------------------------------------------------------

describe('nsiter2', () => {
  it('returns INT_MAX as default', () => {
    const [g] = makeTestGraph(0);
    expect(nsiter2(g)).toBe(2147483647);
  });
});

// ---------------------------------------------------------------------------
// expandRankSlots / makeLeafslots
// ---------------------------------------------------------------------------

describe('expandRankSlots', () => {
  it('expands rank to new size with nodes at correct order positions', () => {
    const [, nodes] = makeTestGraph(2);
    nodes[0].info.order = 0;
    nodes[1].info.order = 2;
    const rk = { v: [nodes[0], nodes[1]], n: 2 };
    expandRankSlots(rk, 3);
    expect(rk.n).toBe(3);
    expect(rk.v[0]).toBe(nodes[0]);
    expect(rk.v[2]).toBe(nodes[1]);
  });
});

// ---------------------------------------------------------------------------
// rankNormalXRange / firstNormalNode / lastNormalNode
// ---------------------------------------------------------------------------

describe('rankNormalXRange', () => {
  it('returns sentinel values for empty rank', () => {
    const rk = { v: [] as Node[], n: 0 };
    const [lx, rx] = rankNormalXRange(rk);
    expect(lx).toBe(2147483647);
    expect(rx).toBe(-2147483647);
  });

  it('computes range from lw/rw of normal nodes', () => {
    const [, nodes] = makeTestGraph(1);
    nodes[0].info.node_type = 0; // NORMAL
    nodes[0].info.coord = { x: 50, y: 0 };
    nodes[0].info.lw = 10;
    nodes[0].info.rw = 15;
    const rk = { v: [nodes[0]], n: 1 };
    const [lx, rx] = rankNormalXRange(rk);
    expect(lx).toBe(40);
    expect(rx).toBe(65);
  });
});

describe('firstNormalNode', () => {
  it('returns undefined for empty rank', () => {
    expect(firstNormalNode({ v: [], n: 0 })).toBeUndefined();
  });

  it('skips virtual nodes', () => {
    const [, nodes] = makeTestGraph(2);
    nodes[0].info.node_type = 1; // VIRTUAL
    nodes[1].info.node_type = 0; // NORMAL
    const rk = { v: [nodes[0], nodes[1]], n: 2 };
    expect(firstNormalNode(rk)).toBe(nodes[1]);
  });
});

describe('lastNormalNode', () => {
  it('returns undefined for empty rank', () => {
    expect(lastNormalNode({ v: [], n: 0 })).toBeUndefined();
  });

  it('skips virtual nodes from right', () => {
    const [, nodes] = makeTestGraph(2);
    nodes[0].info.node_type = 0; // NORMAL
    nodes[1].info.node_type = 1; // VIRTUAL
    const rk = { v: [nodes[0], nodes[1]], n: 2 };
    expect(lastNormalNode(rk)).toBe(nodes[0]);
  });
});

// ---------------------------------------------------------------------------
// dotComputeBb
// ---------------------------------------------------------------------------

describe('dotComputeBb', () => {
  it('uses ln/rn x-coords for non-root cluster bb', () => {
    const root = new Graph('root', 'directed');
    const g = new Graph('clust', 'directed');
    g.info.dotroot = root;
    const [, nodes] = makeTestGraph(2);
    nodes[0].info.coord = { x: 0, y: 20 };
    root.info.minrank = 0;
    root.info.maxrank = 0;
    root.info.rank = [makeRankEntry()];
    root.info.rank[0].v = [nodes[0]];
    root.info.rank[0].n = 1;
    g.info.minrank = 0;
    g.info.maxrank = 0;
    g.info.ht1 = 5;
    g.info.ht2 = 5;
    g.info.ln = { info: { rank: 10 } } as unknown as Node;
    g.info.rn = { info: { rank: 90 } } as unknown as Node;
    dotComputeBb(g, root);
    expect(g.info.bb?.ll.x).toBe(10);
    expect(g.info.bb?.ur.x).toBe(90);
    expect(g.info.bb?.ll.y).toBe(15);
    expect(g.info.bb?.ur.y).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// scaleBb
// ---------------------------------------------------------------------------

describe('scaleBb', () => {
  it('scales bounding box by xf and yf', () => {
    const [g] = makeTestGraph(0);
    g.info.n_cluster = 0;
    g.info.bb = { ll: { x: 10, y: 20 }, ur: { x: 30, y: 40 } };
    scaleBb(g, 2, 3);
    expect(g.info.bb.ll.x).toBe(20);
    expect(g.info.bb.ll.y).toBe(60);
    expect(g.info.bb.ur.x).toBe(60);
    expect(g.info.bb.ur.y).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// cluster helpers (cluster.ts / cluster-path.ts)
// ---------------------------------------------------------------------------

describe('subgraphBounds', () => {
  it('returns [minrank, maxrank] for a graph with explicit ranks', () => {
    const [g] = makeTestGraph(0);
    g.info.minrank = 2;
    g.info.maxrank = 5;
    expect(subgraphBounds(g)).toEqual([2, 5]);
  });

  it('defaults undefined minrank/maxrank to 0', () => {
    const [g] = makeTestGraph(0);
    expect(subgraphBounds(g)).toEqual([0, 0]);
  });
});

// C mergeable() checks only tail/head/label/ports — minlen and weight are
// irrelevant to the predicate. @see lib/dotgen/class2.c:mergeable

describe('interclexpMergeable — undefined prev', () => {
  it('returns false when prev is undefined', () => {
    const [g, nodes] = makeTestGraph(2);
    const e = addTestEdge(g, nodes[0], nodes[1]);
    expect(interclexpMergeable(undefined, e)).toBe(false);
  });
});

describe('interclexpMergeable — same endpoints', () => {
  it('returns true when prev and e share tail, head, label, ports', () => {
    const [g, nodes] = makeTestGraph(2);
    const e1 = addTestEdge(g, nodes[0], nodes[1]);
    const e2 = addTestEdge(g, nodes[0], nodes[1]);
    expect(interclexpMergeable(e1, e2)).toBe(true);
  });
});

// C mergeable() ignores minlen/weight — differing minlen does NOT make edges
// non-mergeable. @see lib/dotgen/class2.c:mergeable (lines 150-153)
describe('interclexpMergeable — minlen ignored', () => {
  it('returns true even when minlen differs', () => {
    const [g, nodes] = makeTestGraph(2);
    const e1 = addTestEdge(g, nodes[0], nodes[1]);
    e1.info.minlen = 1;
    const e2 = addTestEdge(g, nodes[0], nodes[1]);
    e2.info.minlen = 2;
    expect(interclexpMergeable(e1, e2)).toBe(true);
  });
});

describe('interclexpRanksEq', () => {
  it('returns true when tail and head ranks are equal', () => {
    const [g, nodes] = makeTestGraph(2);
    nodes[0].info.rank = 3;
    nodes[1].info.rank = 3;
    const e = addTestEdge(g, nodes[0], nodes[1]);
    expect(interclexpRanksEq(e)).toBe(true);
  });

  it('returns false when tail and head ranks differ', () => {
    const [g, nodes] = makeTestGraph(2);
    nodes[0].info.rank = 1;
    nodes[1].info.rank = 2;
    const e = addTestEdge(g, nodes[0], nodes[1]);
    expect(interclexpRanksEq(e)).toBe(false);
  });
});

describe('interclexpHeadHigher', () => {
  it('returns true when head rank > tail rank', () => {
    const [g, nodes] = makeTestGraph(2);
    nodes[0].info.rank = 1;
    nodes[1].info.rank = 3;
    const e = addTestEdge(g, nodes[0], nodes[1]);
    expect(interclexpHeadHigher(e)).toBe(true);
  });

  it('returns false when head rank <= tail rank', () => {
    const [g, nodes] = makeTestGraph(2);
    nodes[0].info.rank = 3;
    nodes[1].info.rank = 1;
    const e = addTestEdge(g, nodes[0], nodes[1]);
    expect(interclexpHeadHigher(e)).toBe(false);
  });
});

describe('mapInterclustNode', () => {
  it('returns node unchanged when no cluster is assigned', () => {
    const [, nodes] = makeTestGraph(1);
    nodes[0].info.clust = undefined;
    expect(mapInterclustNode(nodes[0])).toBe(nodes[0]);
  });

  it('returns node unchanged when cluster is already expanded', () => {
    const [, nodes] = makeTestGraph(1);
    const clust = new Graph('c', 'directed');
    clust.info.expanded = true;
    nodes[0].info.clust = clust;
    expect(mapInterclustNode(nodes[0])).toBe(nodes[0]);
  });

  it('returns rankleader when cluster is not yet expanded', () => {
    const [, nodes] = makeTestGraph(2);
    nodes[0].info.rank = 1;
    const clust = new Graph('c', 'directed');
    clust.info.expanded = false;
    clust.info.rankleader = [null as unknown as Node, nodes[1]];
    nodes[0].info.clust = clust;
    expect(mapInterclustNode(nodes[0])).toBe(nodes[1]);
  });
});

describe('makeSlots', () => {
  it('expands rank by d slots (d > 0)', () => {
    const [g, nodes] = makeTestGraph(3);
    nodes[0].info.order = 0;
    nodes[1].info.order = 1;
    nodes[2].info.order = 2;
    const rk = makeRankEntry();
    rk.v = [nodes[0], nodes[1], nodes[2]];
    rk.n = 3;
    g.info.rank = [rk];
    makeSlots(g, 0, 0, 2);
    expect(rk.n).toBe(4);
    expect(rk.v[0]).toBe(nodes[0]);
  });
});
