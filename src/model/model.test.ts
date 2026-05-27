// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import { Graph } from './graph.js';
import { Node } from './node.js';
import { Edge } from './edge.js';

/**
 * Tests for Graph, Node, and Edge base classes.
 *
 * Acceptance criteria (from T3 task spec):
 *   AC-1: Given a directed graph with edge A→B, edge.head.name === 'B'
 *         and edge.tail.name === 'A'.
 *   AC-2: Given a node with a self-loop, outEdges(g) includes the self-loop.
 *   AC-3: Given a node with a self-loop, inEdges(g) does NOT include the
 *         self-loop.
 *   AC-4: Given an edge A→B, the same Edge instance appears in
 *         nodeA.outEdges(g) and nodeB.inEdges(g) (identity check with ===).
 */

describe('Edge direction semantics (Agedgepair_t / AGTAIL / AGHEAD)', () => {
  it('AC-1: edge.tail.name is "A" and edge.head.name is "B" for A→B', () => {
    // Mirrors AGTAIL(e) = in.node = source, AGHEAD(e) = out.node = destination.
    const g = new Graph('G', 'directed');
    const nodeA = new Node(1, 'A', g);
    const nodeB = new Node(2, 'B', g);
    g.nodes.set('A', nodeA);
    g.nodes.set('B', nodeB);

    const edge = new Edge(nodeA, nodeB, '');
    g.edges.push(edge);

    expect(edge.tail.name).toBe('A');
    expect(edge.head.name).toBe('B');
  });
});

describe('Self-loop handling (agnxtedge semantics)', () => {
  it('AC-2: outEdges(g) includes a self-loop on node A', () => {
    // agnxtedge visits self-loops as out-edges only. outEdges() must include them.
    const g = new Graph('G', 'directed');
    const nodeA = new Node(1, 'A', g);
    g.nodes.set('A', nodeA);

    const selfLoop = new Edge(nodeA, nodeA, '');
    g.edges.push(selfLoop);

    const out = nodeA.outEdges(g);
    expect(out).toContain(selfLoop);
  });

  it('AC-3: inEdges(g) does NOT include a self-loop on node A', () => {
    // agnxtedge skips self-loops when iterating in-edges. inEdges() must mirror this.
    const g = new Graph('G', 'directed');
    const nodeA = new Node(1, 'A', g);
    g.nodes.set('A', nodeA);

    const selfLoop = new Edge(nodeA, nodeA, '');
    g.edges.push(selfLoop);

    const inEdges = nodeA.inEdges(g);
    expect(inEdges).not.toContain(selfLoop);
    expect(inEdges).toHaveLength(0);
  });
});

describe('Edge identity across outEdges and inEdges', () => {
  it('AC-4: the same Edge instance appears in nodeA.outEdges(g) and nodeB.inEdges(g)', () => {
    // Matches AGEQEDGE semantics: pointer identity on the canonical edge object.
    const g = new Graph('G', 'directed');
    const nodeA = new Node(1, 'A', g);
    const nodeB = new Node(2, 'B', g);
    g.nodes.set('A', nodeA);
    g.nodes.set('B', nodeB);

    const edge = new Edge(nodeA, nodeB, '');
    g.edges.push(edge);

    const outA = nodeA.outEdges(g);
    const inB = nodeB.inEdges(g);

    expect(outA).toHaveLength(1);
    expect(inB).toHaveLength(1);

    // Strict reference equality — must be the exact same object.
    expect(outA[0]).toBe(edge);
    expect(inB[0]).toBe(edge);
    expect(outA[0] === inB[0]).toBe(true);
  });
});

describe('Graph constructor invariants', () => {
  it('root is self-referential for a new root graph', () => {
    const g = new Graph('test', 'directed');
    expect(g.root).toBe(g);
  });

  it('parent is null for a new root graph', () => {
    const g = new Graph('test', 'directed');
    expect(g.parent).toBeNull();
  });

  it('collections are initialized to empty', () => {
    const g = new Graph('test', 'undirected');
    expect(g.nodes.size).toBe(0);
    expect(g.edges).toHaveLength(0);
    expect(g.subgraphs.size).toBe(0);
    expect(g.attrs.size).toBe(0);
  });
});

describe('outEdges filtering', () => {
  it('returns only edges where the node is the tail', () => {
    const g = new Graph('G', 'directed');
    const nodeA = new Node(1, 'A', g);
    const nodeB = new Node(2, 'B', g);
    const nodeC = new Node(3, 'C', g);
    g.nodes.set('A', nodeA);
    g.nodes.set('B', nodeB);
    g.nodes.set('C', nodeC);

    const eAB = new Edge(nodeA, nodeB, '');
    const eBC = new Edge(nodeB, nodeC, '');
    g.edges.push(eAB, eBC);

    expect(nodeA.outEdges(g)).toStrictEqual([eAB]);
    expect(nodeB.outEdges(g)).toStrictEqual([eBC]);
    expect(nodeC.outEdges(g)).toHaveLength(0);
  });
});

describe('inEdges filtering', () => {
  it('returns only edges where the node is the head, excluding self-loops', () => {
    const g = new Graph('G', 'directed');
    const nodeA = new Node(1, 'A', g);
    const nodeB = new Node(2, 'B', g);
    g.nodes.set('A', nodeA);
    g.nodes.set('B', nodeB);

    const eAB = new Edge(nodeA, nodeB, '');
    const selfA = new Edge(nodeA, nodeA, '');
    g.edges.push(eAB, selfA);

    // nodeB should see eAB as in-edge; nodeA self-loop must not appear in inEdges.
    expect(nodeB.inEdges(g)).toStrictEqual([eAB]);
    expect(nodeA.inEdges(g)).toHaveLength(0);
  });
});
