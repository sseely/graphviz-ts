// SPDX-License-Identifier: EPL-2.0

/**
 * Integration tests for the dot layout pipeline entry point (T39).
 *
 * AC1: dotLayoutEntry on an empty graph does not throw.
 * AC2: Attribute parsing — GraphInfo / EdgeInfo fields are set correctly.
 * AC3: DOT_LAYOUT_ENGINE.type === 'dot'.
 * AC4: A→B→C chain with maxphase=3 (TB): y(A) > y(B) > y(C).
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
import { NORMAL } from './fastgr.js';
import {
  DOT_LAYOUT_ENGINE,
  dotLayoutEntry,
  dotLayoutPipeline,
  dotInitNode,
  dotInitEdge,
  dotInitSubg,
} from './index.js';

// ---------------------------------------------------------------------------
// Graph builder helpers
// ---------------------------------------------------------------------------

export function makeGraph(name: string): Graph {
  return new Graph(name, 'directed');
}

export function addNode(g: Graph, id: number, nm: string): Node {
  const n = new Node(id, nm, g);
  n.info = makeNodeInfo();
  g.nodes.set(nm, n);
  return n;
}

/**
 * Adds an edge to the graph. The fast graph (in/out lists) is built by
 * class1 during the rank phase — pre-installing raw edges there would
 * make class1's findFastEdge return the edge itself and self-merge.
 */
export function addEdge(g: Graph, tail: Node, head: Node): Edge {
  const e = new Edge(tail, head, '');
  e.info = makeEdgeInfo(makePort(), makePort());
  g.edges.push(e);
  return e;
}

/** Build a three-node A→B→C chain graph stopping at maxphase=3. */
export function makeChainGraph(): [Graph, Node, Node, Node] {
  const g = makeGraph('chain');
  g.attrs.set('maxphase', '3');
  const nodeA = addNode(g, 0, 'A');
  const nodeB = addNode(g, 1, 'B');
  const nodeC = addNode(g, 2, 'C');
  addEdge(g, nodeA, nodeB);
  addEdge(g, nodeB, nodeC);
  return [g, nodeA, nodeB, nodeC];
}

// ---------------------------------------------------------------------------
// AC1: empty graph
// ---------------------------------------------------------------------------

describe('dotLayoutEntry: empty graph', () => {
  it('does not throw on a graph with no nodes', () => {
    const g = makeGraph('empty');
    expect(() => dotLayoutEntry(g)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC2: attribute parsing
// ---------------------------------------------------------------------------

describe('dotInitSubg: graph attribute defaults', () => {
  it('sets nodesep to 18 pts and ranksep to 36 pts when unset', () => {
    const g = makeGraph('attrs');
    dotInitSubg(g);
    expect(g.info.nodesep).toBe(18);
    expect(g.info.ranksep).toBe(36);
  });

  it('preserves caller-set nodesep and ranksep', () => {
    const g = makeGraph('preset');
    g.info.nodesep = 36;
    g.info.ranksep = 72;
    dotInitSubg(g);
    expect(g.info.nodesep).toBe(36);
    expect(g.info.ranksep).toBe(72);
  });
});

describe('dotInitNode: node geometry and edge list defaults', () => {
  it('initialises UF_size, edge lists, geometry, and node_type', () => {
    const g = makeGraph('ninfo');
    const n = addNode(g, 0, 'a');
    dotInitNode(n);
    expect(n.info.UF_size).toBe(1);
    expect(n.info.in).toEqual({ list: [], size: 0 });
    expect(n.info.out).toEqual({ list: [], size: 0 });
    expect(n.info.lw).toBe(27);
    expect(n.info.rw).toBe(27);
    expect(n.info.ht).toBe(36);
    expect(n.info.node_type).toBe(NORMAL);
  });
});

describe('dotInitEdge: edge field defaults and pre-set values', () => {
  it('sets weight, count, xpenalty, minlen to 1 by default', () => {
    const g = makeGraph('einfo');
    const a = addNode(g, 0, 'a');
    const b = addNode(g, 1, 'b');
    const e = addEdge(g, a, b);
    dotInitEdge(e);
    expect(e.info.weight).toBe(1);
    expect(e.info.count).toBe(1);
    expect(e.info.xpenalty).toBe(1);
    expect(e.info.minlen).toBe(1);
  });

  it('respects pre-set weight=2, minlen=2', () => {
    const g = makeGraph('presetedge');
    const a = addNode(g, 0, 'a');
    const b = addNode(g, 1, 'b');
    const e = addEdge(g, a, b);
    e.info.weight = 2;
    e.info.minlen = 2;
    dotInitEdge(e);
    expect(e.info.weight).toBe(2);
    expect(e.info.minlen).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// AC3: engine registration
// ---------------------------------------------------------------------------

describe('DOT_LAYOUT_ENGINE', () => {
  it('has type === "dot"', () => {
    expect(DOT_LAYOUT_ENGINE.type).toBe('dot');
  });

  it('exposes layout and cleanup functions', () => {
    expect(typeof DOT_LAYOUT_ENGINE.layout).toBe('function');
    expect(typeof DOT_LAYOUT_ENGINE.cleanup).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// AC4: A→B→C chain — after dotPosition, y(A) > y(B) > y(C)
// ---------------------------------------------------------------------------

describe('dotLayoutPipeline: A→B→C chain coordinate ordering', () => {
  it('assigns y(A) > y(B) > y(C) for a three-node TB chain', () => {
    const [g, nodeA, nodeB, nodeC] = makeChainGraph();
    dotLayoutPipeline(g);
    // In dot TB layout rank-0 nodes sit highest (largest y in point coords).
    // A→B→C means A is rank 0, B rank 1, C rank 2 → y(A) > y(B) > y(C).
    expect(nodeA.info.coord.y).toBeGreaterThan(nodeB.info.coord.y);
    expect(nodeB.info.coord.y).toBeGreaterThan(nodeC.info.coord.y);
  });
});
