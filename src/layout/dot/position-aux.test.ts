// SPDX-License-Identifier: EPL-2.0
//
// Pins the integer-truncation of make_LR_constraints' running position.
// @see lib/dotgen/position.c:make_LR_constraints
// @see plans/xcoord-ns-degeneracy (honda-tokoro x-coord NS degeneracy)

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { lrRankPair } from './position-aux.js';

function mkNode(g: Graph, id: number, rw: number, lw: number): Node {
  const n = new Node(id, `n${id}`, g);
  n.info = makeNodeInfo();
  n.info.rw = rw;
  n.info.lw = lw;
  return n;
}

describe('lrRankPair — make_LR_constraints integer position (honda x-coord NS)', () => {
  it('truncates last + width to an integer (C ND_rank is int)', () => {
    const g = new Graph('t', 'directed');
    g.info.nodesep = 0;
    const u = mkNode(g, 0, 7.5, 0); // rw(u) = 7.5
    const v = mkNode(g, 1, 0, 3.2); // lw(v) = 3.2  -> width = 10.7
    const next = lrRankPair(g, 0, u, v, 5); // 5 + 10.7 = 15.7 -> 15
    expect(next).toBe(15);
    expect(v.info.rank).toBe(15);
    expect(Number.isInteger(v.info.rank)).toBe(true);
  });

  it('accumulates as integers each step (truncate-then-feed-back, not float drift)', () => {
    // C: `last = (ND_rank(v) = last + width)` truncates each step and the
    // truncated int is what the next step adds to. Float accumulation would
    // carry the fractions forward and drift; integer accumulation matches C.
    const g = new Graph('t', 'directed');
    g.info.nodesep = 0;
    const widths = [10.7, 10.7, 10.7]; // rw(u)+lw(v) per pair
    let last = 0;
    const ranks: number[] = [];
    for (const w of widths) {
      const u = mkNode(g, ranks.length * 2, w, 0);
      const v = mkNode(g, ranks.length * 2 + 1, 0, 0);
      last = lrRankPair(g, 0, u, v, last);
      ranks.push(v.info.rank ?? NaN);
    }
    // trunc(0+10.7)=10, trunc(10+10.7)=20, trunc(20+10.7)=30 — every value integer.
    expect(ranks).toEqual([10, 20, 30]);
    // Float accumulation would have given 10.7, 21.4, 32.1 -> trunc 10,21,32.
    expect(ranks).not.toEqual([10, 21, 32]);
  });

  it('includes nodesep in the width before truncation', () => {
    const g = new Graph('t', 'directed');
    g.info.nodesep = 4;
    const u = mkNode(g, 0, 2.9, 0);
    const v = mkNode(g, 1, 0, 1.4); // width = 2.9 + 1.4 + 4 = 8.3
    const next = lrRankPair(g, 0, u, v, 0);
    expect(next).toBe(8); // trunc(8.3)
  });
});
