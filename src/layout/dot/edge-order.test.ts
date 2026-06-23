// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import type { Edge } from '../../model/edge.js';
import { edgeRouteCmp } from './edge-order.js';

/**
 * Build a minimal mock edge exposing only the fields `edgeRouteCmp` reads:
 * tail/head rank + coord.x and the AGSEQ `seq`. @see edge-order.ts:edgeRouteCmp
 */
function mkEdge(opts: {
  seq: number; tRank: number; hRank: number; tx?: number; hx?: number;
}): Edge {
  const { seq, tRank, hRank, tx = 0, hx = 0 } = opts;
  return {
    seq,
    tail: { info: { rank: tRank, coord: { x: tx, y: 0 } } },
    head: { info: { rank: hRank, coord: { x: hx, y: 0 } } },
  } as unknown as Edge;
}

/** Sort a copy and return the seqs in routed order. */
function order(edges: Edge[]): number[] {
  return [...edges].sort(edgeRouteCmp).map(e => e.seq);
}

describe('edgeRouteCmp — C dot_splines_ / edgecmp order', () => {
  it('flat (same-rank) edges route before regular edges, even longer-spanning', () => {
    const flat = mkEdge({ seq: 2, tRank: 5, hRank: 5 });    // span 0, FLATEDGE
    const regular = mkEdge({ seq: 1, tRank: 0, hRank: 1 }); // span 1, REGULAREDGE
    expect(order([regular, flat])).toEqual([2, 1]);
  });

  it('among regular edges, shorter rank-span routes first', () => {
    const long = mkEdge({ seq: 1, tRank: 0, hRank: 5 });   // span 5
    const short = mkEdge({ seq: 2, tRank: 2, hRank: 4 });  // span 2
    expect(order([long, short])).toEqual([2, 1]);
  });

  it('rank-span is absolute (back edge span 3 == forward span 3)', () => {
    const back = mkEdge({ seq: 1, tRank: 5, hRank: 2 });   // |span| 3, tie -> seq
    const fwd = mkEdge({ seq: 2, tRank: 1, hRank: 4 });    // |span| 3
    expect(order([fwd, back])).toEqual([1, 2]);
  });

  it('equal type+span: smaller |tail.x - head.x| routes first', () => {
    const wide = mkEdge({ seq: 1, tRank: 0, hRank: 2, tx: 0, hx: 100 });
    const narrow = mkEdge({ seq: 2, tRank: 0, hRank: 2, tx: 0, hx: 10 });
    expect(order([wide, narrow])).toEqual([2, 1]);
  });

  it('all keys equal: AGSEQ (seq) ascending is the total-order tiebreak', () => {
    const a = mkEdge({ seq: 7, tRank: 0, hRank: 2, tx: 0, hx: 5 });
    const b = mkEdge({ seq: 3, tRank: 0, hRank: 2, tx: 0, hx: 5 });
    expect(order([a, b])).toEqual([3, 7]);
  });
});
