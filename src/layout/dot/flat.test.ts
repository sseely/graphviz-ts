// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for T36: flat edges, edge classification (class1/class2), abomination.
 * Covers the four acceptance criteria from the T36 task spec.
 */

import { describe, it, expect } from 'vitest';
import { class2 } from './classify.js';
import { abomination } from './flat.js';
import { makeTestGraph, addTestEdge, setupRanks } from './position.test.js';

// ---------------------------------------------------------------------------
// AC1: flat edge in class2 → NodeInfo.flatOut + GraphInfo.hasFlatEdges
// ---------------------------------------------------------------------------

describe('class2: flat edge (AC1)', () => {
  it('puts same-rank edge in flat_out and sets hasFlatEdges', () => {
    const [g, nodes] = makeTestGraph(2);
    setupRanks(g, [0, 0]);
    nodes[0].info.clust = undefined;
    nodes[1].info.clust = undefined;
    const e = addTestEdge(g, nodes[0], nodes[1]);
    class2(g);
    expect(g.info.has_flat_edges).toBe(true);
    const flatOut = nodes[0].info.flat_out;
    expect(flatOut).toBeDefined();
    expect(flatOut!.list.slice(0, flatOut!.size)).toContain(e);
  });
});

// ---------------------------------------------------------------------------
// AC2: forward edge spanning 3 ranks → 1 virtual node at rank 1, 2 virt edges
// ---------------------------------------------------------------------------

describe('class2: forward edge chain (AC2)', () => {
  it('creates virtual node at rank 1 and two virtual edges for A(0)→B(2)', () => {
    const [g, nodes] = makeTestGraph(2);
    setupRanks(g, [0, 2]);
    nodes[0].info.clust = undefined;
    nodes[1].info.clust = undefined;
    const e = addTestEdge(g, nodes[0], nodes[1]);
    class2(g);
    // e.info.to_virt is the first virtual edge: A → vn
    const ve1 = e.info.to_virt;
    expect(ve1).toBeDefined();
    const vn = ve1!.head;
    expect(vn.info.rank).toBe(1);
    // second virtual edge: vn → B
    const vnOut = vn.info.out;
    expect(vnOut).toBeDefined();
    const ve2 = vnOut!.list[0];
    expect(ve2).toBeDefined();
    expect(ve2.head).toBe(nodes[1]);
  });
});

// ---------------------------------------------------------------------------
// AC3: backward edge → make_chain called in reverse direction
// ---------------------------------------------------------------------------

describe('class2: backward edge (AC3)', () => {
  it('converts backward edge to forward virtual chain (head→tail direction)', () => {
    const [g, nodes] = makeTestGraph(2);
    // nodes[0] at rank 1, nodes[1] at rank 0 — edge goes from higher to lower rank
    setupRanks(g, [1, 0]);
    nodes[0].info.clust = undefined;
    nodes[1].info.clust = undefined;
    const e = addTestEdge(g, nodes[0], nodes[1]);
    class2(g);
    // make_chain(g, head, tail, e) should have run: chain from nodes[1](rank0) to nodes[0](rank1)
    // e.info.to_virt points to the first virtual edge in the reversed chain
    expect(e.info.to_virt).toBeDefined();
    // The chain starts at e.head (rank 0) going to e.tail (rank 1)
    const firstVirt = e.info.to_virt!;
    expect(firstVirt.tail.info.rank).toBe(0);
    expect(firstVirt.head.info.rank).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC4: abomination — labeled non-adjacent flat edge at rank 0
// ---------------------------------------------------------------------------

function makeAbomGraph() {
  const [g] = makeTestGraph(0);
  g.info.minrank = 0;
  g.info.maxrank = 1;
  g.info.rank = [
    { n: 0, an: 0, v: [], av: [], ht1: 1, ht2: 1, pht1: 1, pht2: 1, candidate: false, valid: false, cache_nc: 0 },
    { n: 0, an: 0, v: [], av: [], ht1: 1, ht2: 1, pht1: 1, pht2: 1, candidate: false, valid: false, cache_nc: 0 },
  ];
  return g;
}

// AD-2: abomination renumbers 0-based (no negative indices). minrank stays 0,
// maxrank bumps by 1, a new empty rank is inserted at index 0, and every
// existing rank shifts up by one index.
describe('abomination: 0-based renumber (AC4)', () => {
  it('keeps minrank at 0 and bumps maxrank by 1', () => {
    const g = makeAbomGraph();
    abomination(g);
    expect(g.info.minrank).toBe(0);
    expect(g.info.maxrank).toBe(2);
  });
});

describe('abomination: new rank entry', () => {
  it('inserts an empty rank at index 0 and shifts existing ranks up', () => {
    const g = makeAbomGraph();
    const old0 = g.info.rank![0];
    const old1 = g.info.rank![1];
    abomination(g);
    expect(g.info.rank![0].n).toBe(0);
    expect(g.info.rank![0]).not.toBe(old0);
    expect(g.info.rank![1]).toBe(old0);
    expect(g.info.rank![2]).toBe(old1);
  });
});
