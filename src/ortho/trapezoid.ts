// SPDX-License-Identifier: EPL-2.0
/**
 * construct_trapezoids — main entry point for Seidel trapezoidation.
 * Also re-exports the public surface used by partition.ts.
 *
 * @see lib/ortho/trapezoid.c:construct_trapezoids
 */

import {
  mathLogstarN, mathN, newTrap, isValidTrap,
} from "./trap-types.js";
import type { SegmentT, TrapT, QNode } from "./trap-types.js";
import { addSegment, findNewRoots } from "./trap-segment.js";

export type { SegmentT, TrapT };
export { isValidTrap, mathLogstarN, mathN };
export type { QNode };

// re-export helpers needed by partition.ts
export {
  fpEqual, equalTo, greaterThan, dfpCmp, C_EPS,
} from "./trap-types.js";

/**
 * Build the trapezoidal decomposition of the polygon defined by seg[1..nseg].
 * @see lib/ortho/trapezoid.c:construct_trapezoids
 */
export function constructTrapezoids(
  nseg: number,
  seg: SegmentT[],
  permute: number[],
): TrapT[] {
  const qs: QNode[] = [];
  const tr: TrapT[] = [];
  // index 0 is a sentinel (invalid trap)
  tr.push({
    lseg: 0, rseg: 0,
    hi: { x: 0, y: 0 }, lo: { x: 0, y: 0 },
    u0: 0, u1: 0, d0: 0, d1: 0,
    sink: 0, usave: 0, uside: 0, isValid: false,
  });

  let segi = 0;
  const root = initQueryStructure(permute[segi++], seg, tr, qs);

  for (let i = 1; i <= nseg; i++) {
    seg[i].root0 = root;
    seg[i].root1 = root;
  }

  const logstar = mathLogstarN(nseg);
  for (let h = 1; h <= logstar; h++) {
    const lo = mathN(nseg, h - 1) + 1;
    const hi = mathN(nseg, h);
    for (let i = lo; i <= hi; i++) {
      addSegment(permute[segi++], seg, tr, qs);
    }
    for (let i = 1; i <= nseg; i++) {
      findNewRoots(i, seg, tr, qs);
    }
  }

  const remaining = mathN(nseg, logstar) + 1;
  for (let i = remaining; i <= nseg; i++) {
    addSegment(permute[segi++], seg, tr, qs);
  }

  return tr;
}

// ─── init_query_structure ─────────────────────────────────────────────────────

import {
  T_X, T_Y, T_SINK, maxPt, minPt, newQNode,
} from "./trap-types.js";

function initQueryStructure(
  segnum: number,
  seg: SegmentT[],
  tr: TrapT[],
  qs: QNode[],
): number {
  const s = seg[segnum];
  const i1 = newQNode(qs); qs[i1].nodetype = T_Y; qs[i1].yval = maxPt(s.v0, s.v1);
  const root = i1;
  const i2 = newQNode(qs); qs[i1].right = i2; qs[i2].nodetype = T_SINK; qs[i2].parent = i1;
  const i3 = newQNode(qs); qs[i1].left = i3; qs[i3].nodetype = T_Y; qs[i3].yval = minPt(s.v0, s.v1); qs[i3].parent = i1;
  const i4 = newQNode(qs); qs[i3].left = i4; qs[i4].nodetype = T_SINK; qs[i4].parent = i3;
  const i5 = newQNode(qs); qs[i3].right = i5; qs[i5].nodetype = T_X; qs[i5].segnum = segnum; qs[i5].parent = i3;
  const i6 = newQNode(qs); qs[i5].left = i6; qs[i6].nodetype = T_SINK; qs[i6].parent = i5;
  const i7 = newQNode(qs); qs[i5].right = i7; qs[i7].nodetype = T_SINK; qs[i7].parent = i5;

  const t1 = newTrap(tr); const t2 = newTrap(tr);
  const t3 = newTrap(tr); const t4 = newTrap(tr);

  wireInitTraps(tr, qs, t1, t2, t3, t4, i1, i2, i3, i4, i6, i7, segnum);
  seg[segnum].isInserted = true;
  return root;
}

function wireInitTraps(
  tr: TrapT[], qs: QNode[],
  t1: number, t2: number, t3: number, t4: number,
  i1: number, i2: number, i3: number, i4: number,
  i6: number, i7: number, segnum: number,
): void {
  tr[t1].hi = qs[i1].yval; tr[t2].hi = qs[i1].yval; tr[t4].lo = qs[i1].yval;
  tr[t1].lo = qs[i3].yval; tr[t2].lo = qs[i3].yval; tr[t3].hi = qs[i3].yval;
  tr[t4].hi = { y: Number.MAX_VALUE, x: Number.MAX_VALUE };
  tr[t3].lo = { y: -Number.MAX_VALUE, x: -Number.MAX_VALUE };
  tr[t1].rseg = segnum; tr[t2].lseg = segnum;
  tr[t1].u0 = t4; tr[t2].u0 = t4;
  tr[t1].d0 = t3; tr[t2].d0 = t3;
  tr[t4].d0 = t1; tr[t3].u0 = t1;
  tr[t4].d1 = t2; tr[t3].u1 = t2;
  tr[t1].sink = i6; tr[t2].sink = i7; tr[t3].sink = i4; tr[t4].sink = i2;
  tr[t1].isValid = true; tr[t2].isValid = true;
  tr[t3].isValid = true; tr[t4].isValid = true;
  qs[i2].trnum = t4; qs[i4].trnum = t3; qs[i6].trnum = t1; qs[i7].trnum = t2;
}
