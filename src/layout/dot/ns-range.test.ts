// SPDX-License-Identifier: EPL-2.0

/**
 * Equivalence tests locking the AD-1 flat-stack rewrite of dfsRange /
 * dfsRangeInit and the AD-3 iterative rerank against reference recursive
 * implementations (the forms these replaced). Same tree → bit-identical
 * low / lim / par / rank, proving the representation change is behavior-free.
 *
 * @see lib/common/ns.c:dfs_range_init (1176), dfs_range (1242), rerank (691)
 */

import { describe, it, expect } from 'vitest';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { NsCtx } from './ns-core.js';
import { addTreeEdge } from './ns-core.js';
import { dfsRangeInit, dfsRange } from './ns-range.js';
import { rerank } from './ns.js';
import { treeAdjust } from './ns-subtree.js';

// ---------------------------------------------------------------------------
// Minimal fixture builders
// ---------------------------------------------------------------------------

function mkNode(): Node {
  return { info: {} } as unknown as Node;
}

function mkCtx(): NsCtx {
  return { g: undefined, treeEdges: [], sI: 0, nEdges: 0, nNodes: 0, searchSize: 30 } as unknown as NsCtx;
}

/** Build a tree from [tailIdx, headIdx] edge pairs; returns the node list. */
function buildTree(n: number, edges: readonly [number, number][]): Node[] {
  const nodes = Array.from({ length: n }, mkNode);
  const ctx = mkCtx();
  for (const [t, h] of edges) {
    const e = { tail: nodes[t], head: nodes[h], info: {} } as unknown as Edge;
    addTreeEdge(ctx, e);
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Reference recursive implementations (the forms AD-1/AD-3 replaced)
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c — recursive dfs_range_init(v, par, low). */
function refRangeInit(v: Node, par: Edge | undefined, low: number): number {
  let lim = low;
  v.info.par = par;
  v.info.low = low;
  const to = v.info.tree_out;
  if (to) for (let i = 0; i < to.size; i++) {
    const e = to.list[i];
    if (e !== par) lim = refRangeInit(e.head, e, lim);
  }
  const ti = v.info.tree_in;
  if (ti) for (let i = 0; i < ti.size; i++) {
    const e = ti.list[i];
    if (e !== par) lim = refRangeInit(e.tail, e, lim);
  }
  v.info.lim = lim;
  return lim + 1;
}

/** @see lib/common/ns.c:rerank (recursive). */
function refRerank(v: Node, delta: number): void {
  v.info.rank = (v.info.rank ?? 0) - delta;
  const to = v.info.tree_out;
  if (to) for (let i = 0; i < to.size; i++) {
    const e = to.list[i];
    if (e !== v.info.par) refRerank(e.head, delta);
  }
  const ti = v.info.tree_in;
  if (ti) for (let i = 0; i < ti.size; i++) {
    const e = ti.list[i];
    if (e !== v.info.par) refRerank(e.tail, delta);
  }
}

function snapshot(nodes: Node[], keys: readonly ('low' | 'lim' | 'rank')[]): number[][] {
  return nodes.map((n) => keys.map((k) => n.info[k] ?? 0));
}

/** Index of the parent node of `n` (the endpoint of its par edge that is not n). */
function parentIdx(nodes: Node[], n: Node): number {
  const e = n.info.par;
  if (!e) return -1;
  return nodes.indexOf(e.tail === n ? e.head : e.tail);
}

// ---------------------------------------------------------------------------
// Fixtures: a path, a balanced tree, and a tree mixing in/out tree edges
// ---------------------------------------------------------------------------

const TREES: Record<string, { n: number; edges: [number, number][] }> = {
  path5: { n: 5, edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  fanout: { n: 7, edges: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]] },
  mixed: { n: 6, edges: [[1, 0], [0, 2], [3, 2], [2, 4], [4, 5]] },
};

describe('dfsRangeInit — flat stack equals recursive reference', () => {
  for (const [name, spec] of Object.entries(TREES)) {
    it(`matches low/lim/par on ${name}`, () => {
      const ref = buildTree(spec.n, spec.edges);
      const refRet = refRangeInit(ref[0], undefined, 1);
      const refSnap = snapshot(ref, ['low', 'lim']);
      const refPar = ref.map((n) => parentIdx(ref, n));

      const got = buildTree(spec.n, spec.edges);
      const gotRet = dfsRangeInit(got[0]);
      expect(gotRet).toBe(refRet);
      expect(snapshot(got, ['low', 'lim'])).toEqual(refSnap);
      expect(got.map((n) => parentIdx(got, n))).toEqual(refPar);
    });
  }
});

describe('dfsRange — idempotent re-range after init equals init', () => {
  for (const [name, spec] of Object.entries(TREES)) {
    it(`re-ranging the root reproduces low/lim on ${name}`, () => {
      const nodes = buildTree(spec.n, spec.edges);
      const ret1 = dfsRangeInit(nodes[0]);
      const snap1 = snapshot(nodes, ['low', 'lim']);
      // dfsRange from the root with the same (par, low) must early-return the
      // identical lim+1 and leave low/lim unchanged.
      const ret2 = dfsRange(nodes[0], undefined, 1);
      expect(ret2).toBe(ret1);
      expect(snapshot(nodes, ['low', 'lim'])).toEqual(snap1);
    });
  }
});

describe('rerank — iterative equals recursive reference', () => {
  for (const [name, spec] of Object.entries(TREES)) {
    it(`decrements every subtree rank identically on ${name}`, () => {
      const ref = buildTree(spec.n, spec.edges);
      refRangeInit(ref[0], undefined, 1);
      ref.forEach((nd, i) => { nd.info.rank = i * 3 + 1; });
      refRerank(ref[0], 4);
      const refSnap = snapshot(ref, ['rank']);

      const got = buildTree(spec.n, spec.edges);
      dfsRangeInit(got[0]);
      got.forEach((nd, i) => { nd.info.rank = i * 3 + 1; });
      rerank(got[0], 4);
      expect(snapshot(got, ['rank'])).toEqual(refSnap);
    });
  }
});

/** @see lib/common/ns.c:tree_adjust (recursive). */
function refTreeAdjust(v: Node, from: Node | undefined, delta: number): void {
  v.info.rank = (v.info.rank ?? 0) + delta;
  const ti = v.info.tree_in;
  if (ti) for (let i = 0; i < ti.size; i++) {
    const w = ti.list[i].tail;
    if (w !== from) refTreeAdjust(w, v, delta);
  }
  const to = v.info.tree_out;
  if (to) for (let i = 0; i < to.size; i++) {
    const w = to.list[i].head;
    if (w !== from) refTreeAdjust(w, v, delta);
  }
}

describe('treeAdjust — iterative equals recursive reference', () => {
  for (const [name, spec] of Object.entries(TREES)) {
    it(`adds delta to every tight-tree node identically on ${name}`, () => {
      const ref = buildTree(spec.n, spec.edges);
      ref.forEach((nd, i) => { nd.info.rank = i * 2 + 1; });
      refTreeAdjust(ref[0], undefined, 5);
      const refSnap = snapshot(ref, ['rank']);

      const got = buildTree(spec.n, spec.edges);
      got.forEach((nd, i) => { nd.info.rank = i * 2 + 1; });
      treeAdjust(got[0], undefined, 5);
      expect(snapshot(got, ['rank'])).toEqual(refSnap);
    });
  }
});

describe('treeAdjust — deep tight tree does not overflow the stack', () => {
  it('walks a 50k-deep chain iteratively (regression: corpus 2646)', () => {
    // A recursive tree_adjust overflows the JS call stack here; the iterative
    // port must add delta to all 50000 nodes. @see ns.c:tree_adjust
    const n = 50000;
    const edges: [number, number][] = [];
    for (let i = 0; i + 1 < n; i++) edges.push([i, i + 1]);
    const nodes = buildTree(n, edges);
    nodes.forEach((nd) => { nd.info.rank = 0; });
    expect(() => treeAdjust(nodes[0], undefined, 3)).not.toThrow();
    expect(nodes[0].info.rank).toBe(3);
    expect(nodes[n - 1].info.rank).toBe(3);
  });
});
