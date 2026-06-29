// SPDX-License-Identifier: EPL-2.0

/**
 * Characterization tests for the ns-subtree.ts STset union-find and the subtree
 * min-heap — the stable primitives the feasibleTree tight-tree merge is built on.
 * These lock the behavior the x-NS Tree_edge-order fix
 * (plans/fix-xns-tree-order) must NOT change; the order-determining merge logic
 * (findTightSubtree / interTreeEdgeSearch / mergeSubtrees) is asserted separately
 * by that mission once the C add-order is matched.
 *
 * @see lib/common/ns.c:STsetFind, STsetUnion, STheapify, STextractmin
 */

import { describe, it, expect } from 'vitest';
import type { Node } from '../../model/node.js';
import {
  stSetFind, stSetUnion, onHeap, stBuildHeap, stExtractMin,
  type Subtree,
} from './ns-subtree.js';

function mkNode(): Node {
  return { info: {} } as unknown as Node;
}

/** A subtree with the given size; heapIndex >= 0 means "on heap". */
function mkSubtree(size: number, heapIndex = -1): Subtree {
  return { rep: mkNode(), size, heapIndex };
}

// ---------------------------------------------------------------------------
// STset union-find (STsetFind / STsetUnion)
// ---------------------------------------------------------------------------

describe('STset union-find', () => {
  it('find returns the singleton itself when it has no parent', () => {
    const n = mkNode();
    const s = mkSubtree(1);
    expect(stSetFind(n, new Map([[n, s]]))).toBe(s);
  });

  it('union merges two singletons and accumulates size', () => {
    const n0 = mkNode(), n1 = mkNode();
    const s0 = mkSubtree(1, 0), s1 = mkSubtree(1, 1);
    const r = stSetUnion(s0, s1);
    expect(r.size).toBe(2);
    const map = new Map([[n0, s0], [n1, s1]]);
    expect(stSetFind(n0, map)).toBe(r);
    expect(stSetFind(n1, map)).toBe(r);
  });

  it('union picks the larger on-heap subtree as root, regardless of arg order', () => {
    const big = mkSubtree(3, 0), small = mkSubtree(1, 1);
    expect(stSetUnion(small, big)).toBe(big);
    const big2 = mkSubtree(3, 0), small2 = mkSubtree(1, 1);
    expect(stSetUnion(big2, small2)).toBe(big2);
  });

  it('never chooses an off-heap root over an on-heap root, even if larger', () => {
    const onH = mkSubtree(1, 0);     // on heap, small
    const offH = mkSubtree(99, -1);  // off heap, large
    expect(stSetUnion(onH, offH)).toBe(onH);
    expect(stSetUnion(offH, onH)).toBe(onH);
  });

  it('find halves the path toward the root (path compression)', () => {
    // chain: s2.par -> s1.par -> s0 (root, no parent)
    const n2 = mkNode();
    const s0 = mkSubtree(3), s1 = mkSubtree(1), s2 = mkSubtree(1);
    s1.par = s0;
    s2.par = s1;
    const map = new Map<Node, Subtree>([[n2, s2]]);
    expect(stSetFind(n2, map)).toBe(s0);
    expect(s2.par).toBe(s0); // s2 now points nearer the root than before
  });
});

// ---------------------------------------------------------------------------
// Subtree min-heap (STbuildheap / STextractmin / STheapify), keyed by size
// ---------------------------------------------------------------------------

describe('subtree min-heap (keyed by size)', () => {
  it('extractMin returns subtrees in non-decreasing size order', () => {
    const elt = [5, 1, 4, 2, 8, 3].map((s) => mkSubtree(s));
    const heap = stBuildHeap(elt, elt.length);
    const out: number[] = [];
    while (heap.size > 0) out.push(stExtractMin(heap).size);
    expect(out).toEqual([1, 2, 3, 4, 5, 8]);
  });

  it('extractMin marks the extracted subtree off-heap', () => {
    const elt = [3, 1, 2].map((s) => mkSubtree(s));
    const heap = stBuildHeap(elt, elt.length);
    const min = stExtractMin(heap);
    expect(min.size).toBe(1);
    expect(onHeap(min)).toBe(false);
  });

  it('keeps the minimum at the root through repeated extraction', () => {
    const elt = [9, 4, 7, 1, 6, 2].map((s) => mkSubtree(s));
    const heap = stBuildHeap(elt, elt.length);
    let prev = -Infinity;
    while (heap.size > 0) {
      const m = stExtractMin(heap).size;
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });
});
