// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for the per-op optimization of the reorder helpers (mission
 * mincross-perf-derisk, X1). The rewrites of reorderFindLp/reorderFindRp read
 * each `node.info.mval` once (was twice via the `?:` ternary) and reuse a
 * shared result object instead of allocating one per call (~1.6e9 allocations
 * removed on 2108). These tests pin the exact `(mval ?? -1)` boundary semantics
 * and the shared-scratch safety — output is byte-sacred (decisions.md AD-3).
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { reorderFindLp, reorderFindRp } from './mincross-order.js';
import type { RankEntry } from '../../model/rankEntry.js';

function makeNode(g: Graph, id: number, name = `n${id}`): Node {
  const n = new Node(id, name, g);
  g.nodes.set(n.name, n);
  return n;
}

function makeRankEntry(nodes: Node[]): RankEntry {
  return {
    n: nodes.length, v: nodes, an: nodes.length, av: nodes,
    ht1: 0, ht2: 0, pht1: 0, pht2: 0,
    candidate: false, valid: false, cache_nc: 0,
  };
}

describe('reorderFindLp mval boundary', () => {
  it('treats undefined mval as -1 (advances past it)', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(g, 0, 'a'); // mval undefined -> -1 -> advance
    const b = makeNode(g, 1, 'b');
    b.info.mval = 0; // exactly 0 is comparable (>=0) -> stop here
    expect(reorderFindLp([a, b], 0, 2)).toBe(1);
  });

  it('stops at mval exactly 0, advances past negative', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    a.info.mval = -0.001; // <0 -> advance past
    b.info.mval = 0;      // >=0 -> stop
    expect(reorderFindLp([a, b], 0, 2)).toBe(1);
  });
});

describe('reorderFindRp shared scratch + boundary', () => {
  it('consecutive calls each report correctly despite result reuse', () => {
    const g = new Graph('g', 'directed');
    g.info.rank = [makeRankEntry([])];
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    const c = makeNode(g, 2, 'c');
    a.info.rank = 0; b.info.rank = 0; c.info.rank = 0;
    a.info.order = 0; b.info.order = 1; c.info.order = 2;
    a.info.mval = 0; b.info.mval = -1; c.info.mval = 5;
    const r1 = reorderFindRp(g, [a, b, c], 0, 3);
    const rp1 = r1.rp;          // capture before the next call mutates scratch
    const ms1 = r1.muststay;
    expect(rp1).toBe(2);
    expect(ms1).toBe(false);
    const r2 = reorderFindRp(g, [a, b, c], 1, 3);
    expect(r2.rp).toBe(2);
    expect(r2.muststay).toBe(false);
    expect(rp1).toBe(2);        // captured primitives unaffected by reuse
    expect(ms1).toBe(false);
  });

  it('treats undefined rp mval as -1 (keeps scanning to the next valid)', () => {
    const g = new Graph('g', 'directed');
    g.info.rank = [makeRankEntry([])];
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b'); // mval undefined -> -1 -> skip
    const c = makeNode(g, 2, 'c');
    a.info.rank = 0; b.info.rank = 0; c.info.rank = 0;
    a.info.order = 0; b.info.order = 1; c.info.order = 2;
    a.info.mval = 0; c.info.mval = 0; // b undefined
    const result = reorderFindRp(g, [a, b, c], 0, 3);
    expect(result.rp).toBe(2);
    expect(result.muststay).toBe(false);
  });

  it('returns ep with muststay=false when no comparable rp exists', () => {
    const g = new Graph('g', 'directed');
    g.info.rank = [makeRankEntry([])];
    const a = makeNode(g, 0, 'a');
    const b = makeNode(g, 1, 'b');
    a.info.rank = 0; b.info.rank = 0;
    a.info.order = 0; b.info.order = 1;
    a.info.mval = 0; b.info.mval = -1; // b never comparable
    const result = reorderFindRp(g, [a, b], 0, 2);
    expect(result.rp).toBe(2);
    expect(result.muststay).toBe(false);
  });
});
