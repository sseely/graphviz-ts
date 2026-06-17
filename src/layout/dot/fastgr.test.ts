// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for removeFromRank (inverse of install_in_rank).
 * @see lib/dotgen/dotinit.c:remove_from_rank
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { removeFromRank } from './fastgr.js';
import { installInRank } from './mincross-build.js';
import type { MincrossContext } from './mincross-utils.js';
import type { RankEntry } from '../../model/rankEntry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(g: Graph, id: number, rank: number): Node {
  const n = new Node(id, `n${id}`, g);
  n.info.rank = rank;
  g.nodes.set(n.name, n);
  return n;
}

function emptyRankEntry(an: number): RankEntry {
  return {
    n: 0, v: new Array<Node>(an), an, av: [],
    ht1: 0, ht2: 0, pht1: 0, pht2: 0,
    candidate: false, valid: false, cache_nc: 0,
  };
}

function makeGraphWithRank(rank: number, an: number): Graph {
  const g = new Graph('G', 'directed');
  g.info.minrank = 0;
  g.info.maxrank = rank;
  const table: RankEntry[] = [];
  for (let r = 0; r <= rank; r++) table.push(emptyRankEntry(an));
  g.info.rank = table;
  return g;
}

function makeCtx(g: Graph): MincrossContext {
  return {
    root: g,
    globalMinRank: g.info.minrank ?? 0,
    globalMaxRank: g.info.maxrank ?? 0,
    teList: [], tiList: [],
    reMincross: false, minQuit: 8, maxIter: 24,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('removeFromRank removes an installed node', () => {
  it('decrements rank.n by exactly 1 and drops the node', () => {
    const r = 2;
    const g = makeGraphWithRank(r, 4);
    const n = makeNode(g, 0, r);
    expect(installInRank(makeCtx(g), g, n)).toBe(0);
    const rk = g.info.rank![r];
    expect(rk.n).toBe(1);
    removeFromRank(g, n);
    expect(rk.n).toBe(0);
    expect(rk.v.slice(0, rk.n)).not.toContain(n);
  });
});

describe('removeFromRank inverts installInRank', () => {
  it('returns rank.n to its pre-install value', () => {
    const r = 1;
    const g = makeGraphWithRank(r, 4);
    const n = makeNode(g, 0, r);
    const rk = g.info.rank![r];
    const before = rk.n;
    installInRank(makeCtx(g), g, n);
    expect(n.info.order ?? 0).toBe(0);
    removeFromRank(g, n);
    expect(rk.n).toBe(before);
    expect(rk.v.slice(0, rk.n)).not.toContain(n);
  });
});

describe('removeFromRank compacts the middle element', () => {
  it('shifts later nodes down one, preserving order', () => {
    const r = 0;
    const g = makeGraphWithRank(r, 4);
    const ctx = makeCtx(g);
    const a = makeNode(g, 0, r);
    const b = makeNode(g, 1, r);
    const c = makeNode(g, 2, r);
    installInRank(ctx, g, a);
    installInRank(ctx, g, b);
    installInRank(ctx, g, c);
    const rk = g.info.rank![r];
    expect(rk.v.slice(0, 3)).toEqual([a, b, c]);
    removeFromRank(g, b);
    expect(rk.n).toBe(2);
    expect(rk.v.slice(0, 2)).toEqual([a, c]);
    expect(rk.v.slice(0, rk.n)).not.toContain(b);
  });
});

describe('removeFromRank with an absent node', () => {
  it('is a no-op when the node is not present', () => {
    const r = 0;
    const g = makeGraphWithRank(r, 4);
    const a = makeNode(g, 0, r);
    const stranger = makeNode(g, 1, r);
    installInRank(makeCtx(g), g, a);
    const rk = g.info.rank![r];
    removeFromRank(g, stranger);
    expect(rk.n).toBe(1);
    expect(rk.v[0]).toBe(a);
  });
});
