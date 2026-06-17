// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for fixLabelOrder (DOT-5).
 *
 * The reorder fires only for rare infeasible flat-label orderings (0/300
 * graphviz corpus graphs; only tests/2471.dot). There is no TS-renderable
 * end-to-end trigger, so the algorithm is pinned against C ground truth dumped
 * from the instrumented binary for tests/2471.dot rank 9 (the 7 LabelNodes and
 * the exact position←original-order reassignment).
 *
 * @see lib/dotgen/mincross.c:fixLabelOrder
 */

import { describe, it, expect } from 'vitest';
import { fixLabelOrder, checkLabelOrder, type LabelNode } from './label-order.js';
import type { Node } from '../../model/node.js';
import type { Graph } from '../../model/graph.js';
import type { Edge } from '../../model/edge.js';
import type { RankEntry } from '../../model/rankEntry.js';

/** A label vnode: posAlg set + two out-edges to endpoints at orders lo/hi. */
function vnode(order: number, lo: number, hi: number, label = true): Node {
  const e = (h: number) => ({ head: { info: { order: h } } } as unknown as Edge);
  return {
    info: {
      order, _orig: order,
      posAlg: label ? ({} as Edge) : undefined,
      out: { list: [e(lo), e(hi)], size: 2 },
    },
  } as unknown as Node;
}
const ord = (n: Node): number => n.info.order!;

/** Build label nodes + a rank from [idx, lo, hi] triples; np tagged with _orig. */
function fixture(rows: [number, number, number][]): { lns: LabelNode[]; rank: RankEntry } {
  const v: Node[] = [];
  const lns: LabelNode[] = [];
  for (const [idx, lo, hi] of rows) {
    const np = { info: { order: idx }, _orig: idx } as unknown as Node;
    v[idx] = np;
    lns.push({ lo, hi, np, idx, x: 0, out: [], in: [] });
  }
  const n = Math.max(...rows.map((r) => r[0])) + 1;
  return { lns, rank: { n, v } as unknown as RankEntry };
}

const origAt = (rank: RankEntry, pos: number): number =>
  (rank.v[pos] as unknown as { _orig: number })._orig;

// C ground truth — tests/2471.dot rank 9 (idx, lo, hi).
const GT_2471: [number, number, number][] = [
  [159, 104, 190], [178, 190, 239], [179, 190, 307], [180, 190, 312],
  [194, 141, 190], [260, 190, 202], [261, 159, 190],
];
// C reorder result: position ← original order.
const GT_RESULT: Record<number, number> = {
  159: 159, 178: 194, 179: 261, 180: 178, 194: 179, 260: 180, 261: 260,
};

describe('fixLabelOrder — C parity (2471.dot rank 9)', () => {
  it('reproduces the C reorder exactly', () => {
    const { lns, rank } = fixture(GT_2471);
    fixLabelOrder(lns, rank);
    for (const [pos, orig] of Object.entries(GT_RESULT)) {
      expect(origAt(rank, Number(pos))).toBe(orig);
      expect(rank.v[Number(pos)]!.info.order).toBe(Number(pos));
    }
  });
});

describe('fixLabelOrder — no conflict', () => {
  it('leaves an interval-consistent rank unchanged', () => {
    // node at order 0 has the left interval, node at order 1 the right one.
    const { lns, rank } = fixture([[0, 0, 1], [1, 2, 3]]);
    fixLabelOrder(lns, rank);
    expect(origAt(rank, 0)).toBe(0);
    expect(origAt(rank, 1)).toBe(1);
  });
});

describe('checkLabelOrder — entry point', () => {
  it('collects posAlg vnodes, skips others, and runs without change when consistent', () => {
    // dense label rank: two label vnodes (consistent intervals) + a non-label node.
    const a = vnode(0, 0, 1); // left
    const plain = vnode(1, 5, 6, false); // not a label (posAlg undefined) — skipped
    const b = vnode(2, 3, 4); // right
    const rank = { n: 3, v: [a, plain, b] } as unknown as RankEntry;
    const g = { info: { rank: [rank], minrank: 0, maxrank: 0 } } as unknown as Graph;
    checkLabelOrder(g);
    expect([ord(rank.v[0]!), ord(rank.v[1]!), ord(rank.v[2]!)]).toEqual([0, 1, 2]);
  });

  it('extracts lo/hi swapped so a reversed endpoint pair is normalized', () => {
    // vnode whose out-edges are (hi, lo) order — checkLabelOrder must swap.
    const a = vnode(0, 3, 0); // endpoints at 3 then 0 → interval [0,3]
    const b = vnode(1, 4, 5);
    const rank = { n: 2, v: [a, b] } as unknown as RankEntry;
    const g = { info: { rank: [rank], minrank: 0, maxrank: 0 } } as unknown as Graph;
    expect(() => checkLabelOrder(g)).not.toThrow();
    expect([ord(rank.v[0]!), ord(rank.v[1]!)]).toEqual([0, 1]); // [0,3] before [4,5], consistent
  });
});
