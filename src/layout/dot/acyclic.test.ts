// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for acyclic() (cycle-breaking) and decompose() (component detection).
 *
 * Covers:
 *  1. 3-cycle A→B→C→A: exactly one back edge reversed.
 *  2. Two back edges from one node: i-- swap-shrink idiom processes both.
 *  3. Disconnected pairs: decompose() produces two components.
 *  4. Connected cycle: one component with all nodes.
 *  5. Every node in exactly one component (no duplicates, no missing).
 *  6. UF union/find correctness.
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { fastEdge } from './fastgr.js';
import { ufFind, ufUnion, decompose } from './decomp.js';
import { acyclic } from './acyclic.js';

// Exported so Lizard treats each helper as a standalone function (no absorption).
export function makeGraph(n: number): [Graph, Node[]] {
  const g = new Graph('test', 'directed');
  const nodes: Node[] = [];
  for (let i = 0; i < n; i++) {
    const node = new Node(i, `n${i}`, g);
    g.nodes.set(node.name, node);
    nodes.push(node);
  }
  return [g, nodes];
}

export function addFastEdge(tail: Node, head: Node): Edge {
  const e = new Edge(tail, head, '');
  fastEdge(e);
  return e;
}

// ---------------------------------------------------------------------------
// acyclic tests
// ---------------------------------------------------------------------------

describe('acyclic', () => {
  it('reverses exactly one back edge in a 3-cycle', () => {
    const [g, [a, b, c]] = makeGraph(3);
    const eAB = addFastEdge(a, b);
    const eBC = addFastEdge(b, c);
    const eCA = addFastEdge(c, a);
    decompose(g, 0);
    acyclic(g);
    const rev = [eAB, eBC, eCA].filter((e) => e.info.reversed === true);
    expect(rev).toHaveLength(1);
  });
  it('handles two back edges from one node via i-- swap-shrink idiom', () => {
    const [g, [a, b, c]] = makeGraph(3);
    addFastEdge(a, b); addFastEdge(b, c);
    const eCA = addFastEdge(c, a);
    const eCB = addFastEdge(c, b);
    decompose(g, 0);
    acyclic(g);
    expect(eCA.info.reversed).toBe(true);
    expect(eCB.info.reversed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// decompose tests
// ---------------------------------------------------------------------------

describe('decompose', () => {
  it('produces two components for two disconnected pairs', () => {
    const [g, [a, b, c, d]] = makeGraph(4);
    addFastEdge(a, b); addFastEdge(b, a);
    addFastEdge(c, d); addFastEdge(d, c);
    decompose(g, 0);
    expect(g.info.comp).toHaveLength(2);
  });
  it('produces one component for a connected cycle', () => {
    const [g, ns] = makeGraph(3);
    for (let i = 0; i < 3; i++) addFastEdge(ns[i], ns[(i + 1) % 3]);
    decompose(g, 0);
    expect(g.info.comp).toHaveLength(1);
  });
  it('places every node in exactly one component', () => {
    const [g, [a, b, c]] = makeGraph(3);
    addFastEdge(a, b);
    decompose(g, 0);
    const all: Node[] = [];
    for (const h of g.info.comp ?? []) {
      for (let n: Node | undefined = h; n; n = n.info.next) all.push(n);
    }
    expect(all).toHaveLength(3);
    expect(new Set(all).size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Union-Find tests
// ---------------------------------------------------------------------------

describe('ufFind / ufUnion', () => {
  it('finds an uninitialized node as its own root', () => {
    const [, [a]] = makeGraph(1);
    expect(ufFind(a)).toBe(a);
  });
  it('merges two nodes to the same root', () => {
    const [, [a, b, _c]] = makeGraph(3);
    ufUnion(a, b);
    expect(ufFind(a)).toBe(ufFind(b));
    expect(ufFind(_c)).not.toBe(ufFind(a));
  });
  it('transitively merges three nodes', () => {
    const [, [a, b, c]] = makeGraph(3);
    ufUnion(a, b);
    ufUnion(ufFind(a), c);
    expect(ufFind(a)).toBe(ufFind(b));
    expect(ufFind(b)).toBe(ufFind(c));
  });
});
