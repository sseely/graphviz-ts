// SPDX-License-Identifier: EPL-2.0
/**
 * Query-structure operations for Seidel trapezoidation:
 * locate_endpoint, is_left_of, inserted.
 *
 * @see lib/ortho/trapezoid.c
 */

import {
  T_X, T_Y, T_SINK, FIRSTPT, LASTPT,
  S_LEFT,
  fpEqual, equalTo, greaterThan, isValidTrap,
  cross, TRAP_MAX,
} from "./trap-types.js";
import type { SegPoint, SegmentT, TrapT, QNode } from "./trap-types.js";

/**
 * Test whether point v is to the left of segment segnum.
 * @see lib/ortho/trapezoid.c:is_left_of
 */
export function isLeftOf(
  segnum: number,
  seg: SegmentT[],
  v: SegPoint,
): boolean {
  const s = seg[segnum];
  let area: number;
  if (greaterThan(s.v1, s.v0)) {
    if (fpEqual(s.v1.y, v.y)) area = v.x < s.v1.x ? 1.0 : -1.0;
    else if (fpEqual(s.v0.y, v.y)) area = v.x < s.v0.x ? 1.0 : -1.0;
    else area = cross(s.v0, s.v1, v);
  } else {
    if (fpEqual(s.v1.y, v.y)) area = v.x < s.v1.x ? 1.0 : -1.0;
    else if (fpEqual(s.v0.y, v.y)) area = v.x < s.v0.x ? 1.0 : -1.0;
    else area = cross(s.v1, s.v0, v);
  }
  return area > 0.0;
}

/**
 * Whether the given endpoint of segnum is already inserted.
 * @see lib/ortho/trapezoid.c:inserted
 */
export function inserted(
  segnum: number,
  seg: SegmentT[],
  whichpt: number,
): boolean {
  if (whichpt === FIRSTPT) return seg[seg[segnum].prev].isInserted;
  return seg[seg[segnum].next].isInserted;
}

/** T_X branch of locateEndpoint. */
function locateX(
  v: SegPoint,
  vo: SegPoint,
  rptr: QNode,
  seg: SegmentT[],
  qs: QNode[],
): number {
  if (equalTo(v, seg[rptr.segnum].v0) || equalTo(v, seg[rptr.segnum].v1)) {
    if (fpEqual(v.y, vo.y)) {
      return vo.x < v.x
        ? locateEndpoint(v, vo, rptr.left, seg, qs)
        : locateEndpoint(v, vo, rptr.right, seg, qs);
    }
    return isLeftOf(rptr.segnum, seg, vo)
      ? locateEndpoint(v, vo, rptr.left, seg, qs)
      : locateEndpoint(v, vo, rptr.right, seg, qs);
  }
  return isLeftOf(rptr.segnum, seg, v)
    ? locateEndpoint(v, vo, rptr.left, seg, qs)
    : locateEndpoint(v, vo, rptr.right, seg, qs);
}

/**
 * Which trapezoid contains point v?
 * @see lib/ortho/trapezoid.c:locate_endpoint
 */
export function locateEndpoint(
  v: SegPoint,
  vo: SegPoint,
  r: number,
  seg: SegmentT[],
  qs: QNode[],
): number {
  const rptr = qs[r];
  switch (rptr.nodetype) {
    case T_SINK: return rptr.trnum;
    case T_Y:
      if (greaterThan(v, rptr.yval)) return locateEndpoint(v, vo, rptr.right, seg, qs);
      if (equalTo(v, rptr.yval)) {
        return greaterThan(vo, rptr.yval)
          ? locateEndpoint(v, vo, rptr.right, seg, qs)
          : locateEndpoint(v, vo, rptr.left, seg, qs);
      }
      return locateEndpoint(v, vo, rptr.left, seg, qs);
    case T_X: return locateX(v, vo, rptr, seg, qs);
    default: throw new Error("locateEndpoint: unreachable");
  }
}

/**
 * Merge trapezoids sharing common segments on one side.
 * @see lib/ortho/trapezoid.c:merge_trapezoids
 */
export function mergeTrapezoids(
  segnum: number,
  tfirst: number,
  tlast: number,
  side: number,
  tr: TrapT[],
  qs: QNode[],
): void {
  let t = tfirst;
  while (isValidTrap(t) && greaterThanOrEq(tr[t].lo, tr[tlast].lo)) {
    let tnext = 0;
    const cond = checkMergeCond(t, segnum, side, tr, tnext);
    tnext = cond.tnext;
    if (cond.match) {
      if (tr[t].lseg === tr[tnext].lseg && tr[t].rseg === tr[tnext].rseg) {
        doMerge(t, tnext, tr, qs);
      } else {
        t = tnext;
      }
    } else {
      t = tnext;
    }
  }
}

function checkMergeCond(
  t: number,
  segnum: number,
  side: number,
  tr: TrapT[],
  _tnext: number,
): { match: boolean; tnext: number } {
  let tnext = 0;
  let match = false;
  if (side === S_LEFT) {
    match =
      (isValidTrap((tnext = tr[t].d0)) && tr[tnext].rseg === segnum) ||
      (isValidTrap((tnext = tr[t].d1)) && tr[tnext].rseg === segnum);
  } else {
    match =
      (isValidTrap((tnext = tr[t].d0)) && tr[tnext].lseg === segnum) ||
      (isValidTrap((tnext = tr[t].d1)) && tr[tnext].lseg === segnum);
  }
  return { match, tnext };
}

function doMerge(t: number, tnext: number, tr: TrapT[], qs: QNode[]): void {
  const ptnext = qs[tr[tnext].sink].parent;
  if (qs[ptnext].left === tr[tnext].sink) qs[ptnext].left = tr[t].sink;
  else qs[ptnext].right = tr[t].sink;

  if (isValidTrap((tr[t].d0 = tr[tnext].d0))) {
    if (tr[tr[t].d0].u0 === tnext) tr[tr[t].d0].u0 = t;
    else if (tr[tr[t].d0].u1 === tnext) tr[tr[t].d0].u1 = t;
  }
  if (isValidTrap((tr[t].d1 = tr[tnext].d1))) {
    if (tr[tr[t].d1].u0 === tnext) tr[tr[t].d1].u0 = t;
    else if (tr[tr[t].d1].u1 === tnext) tr[tr[t].d1].u1 = t;
  }
  tr[t].lo = tr[tnext].lo;
  tr[tnext].isValid = false;
}

// re-export for use by trap-segment.ts
import { greaterThanOrEq } from "./trap-types.js";
export { greaterThanOrEq };

export { TRAP_MAX, isValidTrap };
