// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for dot1Rank, dot2Rank, and dotRank dispatch.
 * Each describe callback is kept under 30 physical lines (lizard -L 30).
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { dot1Rank, dotRank, NEW_RANK } from './rank.js';
import { dot2Rank } from './rank-dot2.js';

// ---------------------------------------------------------------------------
// Test helpers (exported to prevent Lizard NLOC absorption)
// ---------------------------------------------------------------------------

export function makeRankGraph(n: number): [Graph, Node[]] {
  const g = new Graph('test', 'directed');
  const nodes: Node[] = [];
  for (let i = 0; i < n; i++) {
    const node = new Node(i, `n${i}`, g);
    g.nodes.set(node.name, node);
    nodes.push(node);
  }
  return [g, nodes];
}

export function addRankEdge(
  g: Graph, tail: Node, head: Node, minlen = 1
): Edge {
  const e = new Edge(tail, head, '');
  e.info.minlen = minlen;
  g.edges.push(e);
  return e;
}

// ---------------------------------------------------------------------------
// dot1Rank — chain ranking
// ---------------------------------------------------------------------------

describe('dot1Rank — chain ranking', () => {
  it('assigns ranks 0, 1, 2 to a 3-node chain', () => {
    const [g, [a, b, c]] = makeRankGraph(3);
    addRankEdge(g, a, b);
    addRankEdge(g, b, c);
    dot1Rank(g);
    expect(a.info.rank).toBe(0);
    expect(b.info.rank).toBe(1);
    expect(c.info.rank).toBe(2);
  });
  it('respects minlen=2 on a single edge', () => {
    const [g, [a, b]] = makeRankGraph(2);
    addRankEdge(g, a, b, 2);
    dot1Rank(g);
    expect((b.info.rank ?? 0) - (a.info.rank ?? 0)).toBeGreaterThanOrEqual(2);
  });
  it('sets minrank=0 and maxrank=2 on the graph', () => {
    const [g, [a, b, c]] = makeRankGraph(3);
    addRankEdge(g, a, b);
    addRankEdge(g, b, c);
    dot1Rank(g);
    expect(g.info.minrank).toBe(0);
    expect(g.info.maxrank).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// dot1Rank — isolated nodes
// ---------------------------------------------------------------------------

describe('dot1Rank — isolated nodes', () => {
  it('assigns rank 0 to a single isolated node', () => {
    const [g, [a]] = makeRankGraph(1);
    dot1Rank(g);
    expect(a.info.rank).toBe(0);
  });
  it('assigns equal rank to two unconnected nodes', () => {
    const [g, [a, b]] = makeRankGraph(2);
    dot1Rank(g);
    expect(a.info.rank).toBe(b.info.rank);
  });
});

// ---------------------------------------------------------------------------
// dot2Rank
// ---------------------------------------------------------------------------

describe('dot2Rank', () => {
  it('assigns ranks 0, 1, 2 to a 3-node chain', () => {
    const [g, [a, b, c]] = makeRankGraph(3);
    addRankEdge(g, a, b);
    addRankEdge(g, b, c);
    dot2Rank(g);
    expect(a.info.rank).toBe(0);
    expect(b.info.rank).toBe(1);
    expect(c.info.rank).toBe(2);
  });
  it('respects minlen=2 on a single edge', () => {
    const [g, [a, b]] = makeRankGraph(2);
    addRankEdge(g, a, b, 2);
    dot2Rank(g);
    expect((b.info.rank ?? 0) - (a.info.rank ?? 0)).toBeGreaterThanOrEqual(2);
  });
  it('sets minrank=0 and maxrank=2 on the graph', () => {
    const [g, [a, b, c]] = makeRankGraph(3);
    addRankEdge(g, a, b);
    addRankEdge(g, b, c);
    dot2Rank(g);
    expect(g.info.minrank).toBe(0);
    expect(g.info.maxrank).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// dotRank dispatch
// ---------------------------------------------------------------------------

function dispatchGraph(): [Graph, Node] {
  const [g, [a, b]] = makeRankGraph(2);
  addRankEdge(g, a, b);
  g.info.flags = 0;
  return [g, b];
}

describe('dotRank dispatch — newrank attr drives dot2 (rank.c:523)', () => {
  it('newrank=true → dot2Rank branch sets NEW_RANK', () => {
    const [g, b] = dispatchGraph();
    g.attrs.set('newrank', 'true');
    dotRank(g);
    expect(b.info.rank).toBe(1);
    expect((g.info.flags ?? 0) & NEW_RANK).toBe(NEW_RANK);
  });
});

describe('dotRank dispatch — dot1 when attr absent/false', () => {
  it('no attr → dot1Rank, NEW_RANK unset', () => {
    const [g, b] = dispatchGraph();
    dotRank(g);
    expect(b.info.rank).toBe(1);
    expect((g.info.flags ?? 0) & NEW_RANK).toBe(0);
  });
  it('newrank=false → dot1Rank, NEW_RANK unset', () => {
    const [g] = dispatchGraph();
    g.attrs.set('newrank', 'false');
    dotRank(g);
    expect((g.info.flags ?? 0) & NEW_RANK).toBe(0);
  });
});
