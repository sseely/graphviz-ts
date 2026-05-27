// SPDX-License-Identifier: EPL-2.0
/**
 * Trapezoid update logic — updateTrapezoid and its helpers.
 *
 * @see lib/ortho/trapezoid.c:update_trapezoid
 */

import {
  S_LEFT, TRAP_MAX, isValidTrap,
} from "./trap-types.js";
import type { SegmentT, TrapT } from "./trap-types.js";
import { isLeftOf } from "./trap-query.js";

/**
 * Update upper-neighbour pointers when threading a segment through t and tn.
 * @see lib/ortho/trapezoid.c:update_trapezoid
 */
export function updateTrapezoid(
  s: SegmentT,
  seg: SegmentT[],
  tr: TrapT[],
  t: number,
  tn: number,
): void {
  if (isValidTrap(tr[t].u0) && isValidTrap(tr[t].u1)) {
    updateContinuation(tr, t, tn);
  } else {
    updateFreshOrCusp(s, seg, tr, t, tn);
  }
}

function updateContinuation(tr: TrapT[], t: number, tn: number): void {
  if (isValidTrap(tr[t].usave)) {
    applyUsave(tr, t, tn);
  } else {
    tr[tn].u0 = tr[t].u1;
    tr[t].u1 = TRAP_MAX;
    tr[tn].u1 = TRAP_MAX;
    tr[tr[tn].u0].d0 = tn;
  }
}

function applyUsave(tr: TrapT[], t: number, tn: number): void {
  if (tr[t].uside === S_LEFT) {
    tr[tn].u0 = tr[t].u1;
    tr[t].u1 = TRAP_MAX;
    tr[tn].u1 = tr[t].usave;
    tr[tr[t].u0].d0 = t;
    tr[tr[tn].u0].d0 = tn;
    tr[tr[tn].u1].d0 = tn;
  } else {
    tr[tn].u1 = TRAP_MAX;
    tr[tn].u0 = tr[t].u1;
    tr[t].u1 = tr[t].u0;
    tr[t].u0 = tr[t].usave;
    tr[tr[t].u0].d0 = t;
    tr[tr[t].u1].d0 = t;
    tr[tr[tn].u0].d0 = tn;
  }
  tr[t].usave = 0;
  tr[tn].usave = 0;
}

function updateFreshOrCusp(
  s: SegmentT,
  seg: SegmentT[],
  tr: TrapT[],
  t: number,
  tn: number,
): void {
  const tmpU = tr[t].u0;
  const td0 = tr[tmpU].d0;
  if (isValidTrap(td0) && isValidTrap(tr[tmpU].d1)) {
    if (tr[td0].rseg > 0 && !isLeftOf(tr[td0].rseg, seg, s.v1)) {
      tr[t].u0 = TRAP_MAX;
      tr[t].u1 = TRAP_MAX;
      tr[tn].u1 = TRAP_MAX;
      tr[tr[tn].u0].d1 = tn;
    } else {
      tr[tn].u0 = TRAP_MAX;
      tr[tn].u1 = TRAP_MAX;
      tr[t].u1 = TRAP_MAX;
      tr[tr[t].u0].d0 = t;
    }
  } else {
    tr[tr[t].u0].d0 = t;
    tr[tr[t].u0].d1 = tn;
  }
}
