// SPDX-License-Identifier: EPL-2.0
//
// swapEdgeSpline regression (mission fix-b15-record-ports): a spline swap must
// swap the edge's precomputed arrow-op SLOTS along with each bezier's
// sflag/eflag, or the per-bezier arrow interleave (svg-helpers) finds no ops
// on the flagged bezier and the arrow falls to the group end — b15's
// LandVertical/Fall/HoverStrafeToStop groups emitted [path, path, arrow]
// where C emits [path, arrow, path]. C has no ops slots (arrows regenerate
// from bz.sp/ep at emit), so the slot swap is the port-model complement of
// C's swap_bezier flag swap. @see lib/dotgen/dotsplines.c:swap_bezier

import { describe, it, expect } from 'vitest';
import { swapEdgeSpline } from './splines.js';
import type { Edge } from '../../model/edge.js';

function mkEdgeWithSpline(): Edge {
  const bz0 = { list: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], size: 4, sflag: 0, eflag: 1, sp: { x: 0, y: 0 }, ep: { x: 3, y: 3 } };
  const bz1 = { list: [{ x: 3, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 6 }], size: 4, sflag: 0, eflag: 0, sp: { x: 3, y: 3 }, ep: { x: 6, y: 6 } };
  return {
    info: {
      spl: { list: [bz0, bz1], size: 2 },
      headArrowOps: [{ op: 'poly' }],
      tailArrowOps: undefined,
    },
  } as unknown as Edge;
}

describe('swapEdgeSpline (b15 multi-bezier reversed edges)', () => {
  it('swaps arrow-op slots together with bezier order and flags', () => {
    const e = mkEdgeWithSpline();
    swapEdgeSpline(e);
    // bezier order reversed; flags swapped per bezier (eflag→sflag)
    expect(e.info.spl!.list[0].list[0]).toEqual({ x: 6, y: 6 });
    expect(e.info.spl!.list[1].sflag).toBe(1);
    expect(e.info.spl!.list[1].eflag).toBe(0);
    // ops slots swapped: the head arrow now lives on the tail slot,
    // matching the bezier that now carries sflag.
    expect(e.info.tailArrowOps).toEqual([{ op: 'poly' }]);
    expect(e.info.headArrowOps).toBeUndefined();
  });

  it('is a no-op on edges without a spline', () => {
    const e = { info: { headArrowOps: [{ op: 'poly' }] } } as unknown as Edge;
    swapEdgeSpline(e);
    expect(e.info.headArrowOps).toEqual([{ op: 'poly' }]);
  });
});
