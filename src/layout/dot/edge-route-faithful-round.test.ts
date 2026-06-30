// SPDX-License-Identifier: EPL-2.0

/**
 * Regression: `maximal_bbox` box walls must round with C `round()` semantics
 * (half **away from zero**), not JS `Math.round` (half toward +∞).
 *
 * On `nshare/root_twopi` the dot router runs in a frame with large negative
 * x-coordinates, so wall values land on negative half-integers (e.g.
 * `-30823.5`, `-46708.5`). `Math.round` rounds those to `-30823`/`-46708`
 * (1 unit too high), which shifted the begin-box and a vnode box by 1px and
 * perturbed the `Pshortestpath` corridor / `Proutespline` fit — the
 * `311E->312E` 21pt control-point delta and the `280->586E` 4-vs-7 piece-count
 * delta. The fix (`roundCoord` in edge-route-faithful.ts) mirrors C's
 * `round(b)`. These cases exercise `maximalBbox`'s left wall on the exact
 * root_twopi values; they fail on the pre-fix `Math.round`.
 *
 * @see lib/dotgen/dotsplines.c:maximal_bbox (round(b))
 */

import { describe, it, expect } from 'vitest';
import type { Node } from '../../model/node.js';
import type { Graph } from '../../model/graph.js';
import { maximalBbox, type BboxCtx, type SplineBounds } from './edge-route-faithful.js';

/** Minimal single-node rank so `neighbor` finds no left/right neighbor and the
 *  wall takes the `roundCoord(b)` branch (clamped only by left/right bound). */
function ctxFor(vn: Node): BboxCtx {
  const rank = { n: 1, v: [vn], ht1: 10, ht2: 10 };
  const sp: SplineBounds = { leftBound: 1e9, rightBound: -1e9, splinesep: 4 };
  return { g: { info: { rank: [rank] } } as unknown as Graph, sp };
}

/** A NORMAL node at rank 0, order 0, with the given center-x and half-width. */
function nodeAt(x: number, lw: number, rw = 0): Node {
  return {
    info: {
      coord: { x, y: 0 }, lw, rw, ht: 20,
      rank: 0, order: 0, node_type: 0, label: undefined,
    },
  } as unknown as Node;
}

describe('maximal_bbox wall rounding (C round, half away from zero)', () => {
  // b = coord.x - lw - FUDGE(4). Values chosen so b is the exact root_twopi
  // negative half-integer; C round(b) → the more-negative integer.
  it('311E box wall: -30823.5 rounds to -30824 (not -30823)', () => {
    // -30815 - 4.5 - 4 = -30823.5
    const ll = maximalBbox(ctxFor(nodeAt(-30815, 4.5)), nodeAt(-30815, 4.5), undefined, undefined).ll.x;
    expect(ll).toBe(-30824);
    // Guard: plain Math.round would give the pre-fix (wrong) value.
    expect(Math.round(-30823.5)).toBe(-30823);
  });

  it('586E box wall: -46708.5 rounds to -46709 (not -46708)', () => {
    // -46700 - 4.5 - 4 = -46708.5
    const ll = maximalBbox(ctxFor(nodeAt(-46700, 4.5)), nodeAt(-46700, 4.5), undefined, undefined).ll.x;
    expect(ll).toBe(-46709);
  });

  it('positive half-integer wall is unaffected (fix is targeted to negatives)', () => {
    // 112.5 - 4.5 - 4 = 104.0 is integral; use lw=4 so b=104.5 (positive .5):
    // C round and Math.round agree (both 105) — proves the fix changes only the
    // negative-tie case.
    const ll = maximalBbox(ctxFor(nodeAt(112.5, 4)), nodeAt(112.5, 4), undefined, undefined).ll.x;
    expect(ll).toBe(105);
    expect(Math.round(104.5)).toBe(105);
  });
});
