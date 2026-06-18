// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for the transpose swap decision (mincross-c-parity Batch 1).
 *
 * shouldSwap was the inverted-reverse bug: the TS swapped on `cross < 0`,
 * but C swaps on `c1 < c0 || (c0 > 0 && reverse && c1 == c0)`.
 * @see lib/dotgen/mincross.c:transpose_step
 */

import { describe, it, expect } from 'vitest';
import { shouldSwap, transposeCounts } from './mincross-cross.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';

describe('shouldSwap — forward', () => {
  it('swaps only on strict improvement (c1 < c0)', () => {
    expect(shouldSwap(5, 3, false)).toBe(true);
    expect(shouldSwap(3, 3, false)).toBe(false); // tie: no swap forward
    expect(shouldSwap(3, 5, false)).toBe(false); // worse
    expect(shouldSwap(0, 0, false)).toBe(false);
  });
});

describe('shouldSwap — reverse', () => {
  it('swaps on improvement, and on a tie only when crossings exist', () => {
    expect(shouldSwap(5, 3, true)).toBe(true); // improvement
    expect(shouldSwap(3, 3, true)).toBe(true); // tie with crossings → swap
    expect(shouldSwap(0, 0, true)).toBe(false); // tie, no crossings → no swap
    expect(shouldSwap(3, 5, true)).toBe(false); // worse: never swap
  });
});

/** Node carrying a single in-edge whose tail sits at `srcOrder`. */
function inNode(srcOrder: number): Node {
  const e = { tail: { info: { order: srcOrder } }, info: { tail_port: { order: 0 } } } as unknown as Edge;
  return { info: { in: { list: [e], size: 1 }, out: undefined } } as unknown as Node;
}

describe('transposeCounts', () => {
  it('counts c0 (current) when v sources right of w, c1 (swapped) otherwise', () => {
    // v's in-edge from order 5, w's from order 2: cross in current order (c0=1).
    expect(transposeCounts(inNode(5), inNode(2))).toEqual([1, 0]);
    // reversed sources: cross only if swapped (c1=1).
    expect(transposeCounts(inNode(2), inNode(5))).toEqual([0, 1]);
    // equal source order: no crossing either way.
    expect(transposeCounts(inNode(4), inNode(4))).toEqual([0, 0]);
  });
});
