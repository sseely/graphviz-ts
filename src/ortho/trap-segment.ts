// SPDX-License-Identifier: EPL-2.0
/**
 * add_segment and its helpers for Seidel trapezoidation.
 *
 * @see lib/ortho/trapezoid.c:add_segment
 */

import {
  TRAP_MAX, INVALID_TRAP, isValidTrap,
  fpEqual, equalTo, greaterThanOrEq,
  lessThan, newQNode, newTrap,
  T_X, T_SINK, T_Y,
  FIRSTPT, LASTPT, S_LEFT, S_RIGHT,
} from "./trap-types.js";
import type { SegPoint, SegmentT, TrapT, QNode } from "./trap-types.js";
import { isLeftOf, inserted, locateEndpoint, mergeTrapezoids } from "./trap-query.js";
import { updateTrapezoid } from "./trap-update.js";

// ─── Insert v0 endpoint ───────────────────────────────────────────────────────

export function insertV0(
  s: SegmentT,
  seg: SegmentT[],
  tr: TrapT[],
  qs: QNode[],
  segnum: number,
): number {
  const tu = locateEndpoint(s.v0, s.v1, s.root0, seg, qs);
  const tl = newTrap(tr);
  tr[tl] = { ...tr[tu] };
  tr[tu].lo = s.v0; tr[tl].hi = s.v0;
  tr[tu].d0 = tl;   tr[tu].d1 = INVALID_TRAP;
  tr[tl].u0 = tu;   tr[tl].u1 = INVALID_TRAP;
  patchLowerNeighbours(tr, tl, tu);
  wireV0QNodes(tr, qs, tu, tl, segnum, s.v0);
  return tl;
}

function patchLowerNeighbours(tr: TrapT[], tl: number, tu: number): void {
  let d = tr[tl].d0;
  if (isValidTrap(d) && tr[d].u0 === tu) tr[d].u0 = tl;
  if (isValidTrap(d) && tr[d].u1 === tu) tr[d].u1 = tl;
  d = tr[tl].d1;
  if (isValidTrap(d) && tr[d].u0 === tu) tr[d].u0 = tl;
  if (isValidTrap(d) && tr[d].u1 === tu) tr[d].u1 = tl;
}

function wireV0QNodes(
  tr: TrapT[], qs: QNode[],
  tu: number, tl: number,
  segnum: number, yval: SegPoint,
): void {
  const i1 = newQNode(qs); const i2 = newQNode(qs);
  const sk = tr[tu].sink;
  qs[sk].nodetype = T_Y; qs[sk].yval = yval;
  qs[sk].segnum = segnum; qs[sk].left = i2; qs[sk].right = i1;
  qs[i1].nodetype = T_SINK; qs[i1].trnum = tu; qs[i1].parent = sk;
  qs[i2].nodetype = T_SINK; qs[i2].trnum = tl; qs[i2].parent = sk;
  tr[tu].sink = i1; tr[tl].sink = i2;
}

// ─── Insert v1 endpoint ───────────────────────────────────────────────────────

export function insertV1(
  s: SegmentT,
  seg: SegmentT[],
  tr: TrapT[],
  qs: QNode[],
  segnum: number,
): number {
  const tu = locateEndpoint(s.v1, s.v0, s.root1, seg, qs);
  const tl = newTrap(tr);
  tr[tl] = { ...tr[tu] };
  tr[tu].lo = s.v1; tr[tl].hi = s.v1;
  tr[tu].d0 = tl;   tr[tu].d1 = INVALID_TRAP;
  tr[tl].u0 = tu;   tr[tl].u1 = INVALID_TRAP;
  patchLowerNeighbours(tr, tl, tu);
  wireV0QNodes(tr, qs, tu, tl, segnum, s.v1);
  return tu;
}

// ─── Tribot handlers ──────────────────────────────────────────────────────────

function tribotD0(
  tr: TrapT[], seg: SegmentT[], s: SegmentT,
  segnum: number, t: number, tn: number, isSwapped: boolean,
): void {
  const tmp = isSwapped ? seg[segnum].prev : seg[segnum].next;
  if (tmp > 0 && isLeftOf(tmp, seg, s.v0)) {
    tr[tr[t].d0].u0 = t; tr[tn].d0 = TRAP_MAX; tr[tn].d1 = TRAP_MAX;
  } else {
    tr[tr[tn].d0].u1 = tn; tr[t].d0 = TRAP_MAX; tr[t].d1 = TRAP_MAX;
  }
}

function tribotD1(
  tr: TrapT[], seg: SegmentT[], s: SegmentT,
  segnum: number, t: number, tn: number, isSwapped: boolean,
): void {
  const tmp = isSwapped ? seg[segnum].prev : seg[segnum].next;
  if (tmp > 0 && isLeftOf(tmp, seg, s.v0)) {
    tr[tr[t].d1].u0 = t; tr[tn].d0 = TRAP_MAX; tr[tn].d1 = TRAP_MAX;
  } else {
    tr[tr[tn].d1].u1 = tn; tr[t].d0 = TRAP_MAX; tr[t].d1 = TRAP_MAX;
  }
}

// ─── handleD0Only / handleD1Only ─────────────────────────────────────────────

export function handleD0Only(
  s: SegmentT, seg: SegmentT[], tr: TrapT[],
  t: number, tn: number, tlast: number,
  segnum: number, isSwapped: boolean, tribot: boolean,
): void {
  updateTrapezoid(s, seg, tr, t, tn);
  if (atBottom(tr, t, tlast) && tribot) {
    tribotD0(tr, seg, s, segnum, t, tn, isSwapped);
  } else {
    patchUsave(tr, tr[t].d0, t, tn);
    tr[tr[t].d0].u0 = t; tr[tr[t].d0].u1 = tn;
  }
}

export function handleD1Only(
  s: SegmentT, seg: SegmentT[], tr: TrapT[],
  t: number, tn: number, tlast: number,
  segnum: number, isSwapped: boolean, tribot: boolean,
): void {
  updateTrapezoid(s, seg, tr, t, tn);
  if (atBottom(tr, t, tlast) && tribot) {
    tribotD1(tr, seg, s, segnum, t, tn, isSwapped);
  } else {
    patchUsave(tr, tr[t].d1, t, tn);
    tr[tr[t].d1].u0 = t; tr[tr[t].d1].u1 = tn;
  }
}

function atBottom(tr: TrapT[], t: number, tlast: number): boolean {
  return fpEqual(tr[t].lo.y, tr[tlast].lo.y) &&
         fpEqual(tr[t].lo.x, tr[tlast].lo.x);
}

function patchUsave(tr: TrapT[], d: number, t: number, tn: number): void {
  if (isValidTrap(tr[d].u0) && isValidTrap(tr[d].u1)) {
    if (tr[d].u0 === t) { tr[d].usave = tr[d].u1; tr[d].uside = S_LEFT; }
    else { tr[d].usave = tr[d].u0; tr[d].uside = S_RIGHT; }
  }
}

// ─── handleBothD ─────────────────────────────────────────────────────────────

export function handleBothD(
  s: SegmentT, seg: SegmentT[], tr: TrapT[],
  t: number, tn: number, tlast: number, tribot: boolean,
): number {
  const i_d0 = computeID0(s, tr[t].lo);
  updateTrapezoid(s, seg, tr, t, tn);
  return routeBothD(tr, t, tn, tlast, tribot, i_d0);
}

function computeID0(s: SegmentT, lo: SegPoint): boolean {
  if (fpEqual(lo.y, s.v0.y)) return lo.x > s.v0.x;
  const yt = (lo.y - s.v0.y) / (s.v1.y - s.v0.y);
  const tmppt: SegPoint = { y: lo.y, x: s.v0.x + yt * (s.v1.x - s.v0.x) };
  return lessThan(tmppt, lo);
}

function routeBothD(
  tr: TrapT[], t: number, tn: number,
  tlast: number, tribot: boolean, i_d0: boolean,
): number {
  if (atBottom(tr, t, tlast) && tribot) {
    tr[tr[t].d0].u0 = t; tr[tr[t].d0].u1 = TRAP_MAX;
    tr[tr[t].d1].u0 = tn; tr[tr[t].d1].u1 = TRAP_MAX;
    tr[tn].d0 = tr[t].d1; tr[t].d1 = TRAP_MAX; tr[tn].d1 = TRAP_MAX;
    return tr[t].d1;
  } else if (i_d0) {
    tr[tr[t].d0].u0 = t; tr[tr[t].d0].u1 = tn;
    tr[tr[t].d1].u0 = tn; tr[tr[t].d1].u1 = TRAP_MAX;
    tr[t].d1 = TRAP_MAX;
    return tr[t].d0;
  } else {
    tr[tr[t].d0].u0 = t; tr[tr[t].d0].u1 = TRAP_MAX;
    tr[tr[t].d1].u0 = t; tr[tr[t].d1].u1 = tn;
    tr[tn].d0 = tr[t].d1; tr[tn].d1 = TRAP_MAX;
    return tr[t].d1;
  }
}

// ─── swapPt ───────────────────────────────────────────────────────────────────

export function swapSegEndpoints(s: SegmentT): void {
  const tv = s.v0; s.v0 = s.v1; s.v1 = tv;
  const tr = s.root0; s.root0 = s.root1; s.root1 = tr;
}

// ─── add_segment ─────────────────────────────────────────────────────────────

/**
 * Insert one segment into the trapezoidation.
 * @see lib/ortho/trapezoid.c:add_segment
 */
export function addSegment(
  segnum: number,
  seg: SegmentT[],
  tr: TrapT[],
  qs: QNode[],
): void {
  const s = { ...seg[segnum] };
  let isSwapped = false;
  if (greaterThanOrEq(s.v1, s.v0) && !equalTo(s.v1, s.v0)) {
    // C: if (greater_than(s.v1, s.v0)) — swap so v0 is higher
    swapSegEndpoints(s);
    isSwapped = true;
  }

  let tfirst: number;
  if (!inserted(segnum, seg, isSwapped ? LASTPT : FIRSTPT)) {
    tfirst = insertV0(s, seg, tr, qs, segnum);
  } else {
    tfirst = locateEndpoint(s.v0, s.v1, s.root0, seg, qs);
  }

  let tlast: number;
  let tribot = false;
  if (!inserted(segnum, seg, isSwapped ? FIRSTPT : LASTPT)) {
    tlast = insertV1(s, seg, tr, qs, segnum);
  } else {
    tlast = locateEndpoint(s.v1, s.v0, s.root1, seg, qs);
    tribot = true;
  }

  threadSegment(s, seg, tr, qs, segnum, tfirst, tlast, tribot, isSwapped);
  seg[segnum].isInserted = true;
}

function threadSegment(
  s: SegmentT, seg: SegmentT[], tr: TrapT[], qs: QNode[],
  segnum: number, tfirst: number, tlast: number,
  tribot: boolean, isSwapped: boolean,
): void {
  let tfirstr = INVALID_TRAP;
  let tlastr = INVALID_TRAP;
  let t = tfirst;

  while (isValidTrap(t) && greaterThanOrEq(tr[t].lo, tr[tlast].lo)) {
    const sk = tr[t].sink;
    const i1 = newQNode(qs); const i2 = newQNode(qs);
    qs[sk].nodetype = T_X; qs[sk].segnum = segnum;
    qs[sk].left = i1; qs[sk].right = i2;
    qs[i1].nodetype = T_SINK; qs[i1].trnum = t; qs[i1].parent = sk;
    const tn = newTrap(tr);
    tr[tn] = { ...tr[t] }; tr[tn].isValid = true;
    tr[t].sink = i1; tr[tn].sink = i2;
    qs[i2].nodetype = T_SINK; qs[i2].trnum = tn; qs[i2].parent = sk;

    if (t === tfirst) tfirstr = tn;
    if (equalTo(tr[t].lo, tr[tlast].lo)) tlastr = tn;

    const tSav = t; const tnSav = tn;
    t = advanceT(s, seg, tr, t, tn, tlast, segnum, isSwapped, tribot);
    tr[tSav].rseg = segnum; tr[tnSav].lseg = segnum;
  }

  mergeTrapezoids(segnum, tfirst, tlast, S_LEFT, tr, qs);
  mergeTrapezoids(segnum, tfirstr, tlastr, S_RIGHT, tr, qs);
}

function advanceT(
  s: SegmentT, seg: SegmentT[], tr: TrapT[],
  t: number, tn: number, tlast: number,
  segnum: number, isSwapped: boolean, tribot: boolean,
): number {
  if (!isValidTrap(tr[t].d0) && !isValidTrap(tr[t].d1)) {
    return INVALID_TRAP; // error
  } else if (isValidTrap(tr[t].d0) && !isValidTrap(tr[t].d1)) {
    handleD0Only(s, seg, tr, t, tn, tlast, segnum, isSwapped, tribot);
    return tr[t].d0;
  } else if (!isValidTrap(tr[t].d0) && isValidTrap(tr[t].d1)) {
    handleD1Only(s, seg, tr, t, tn, tlast, segnum, isSwapped, tribot);
    return tr[t].d1;
  } else {
    return handleBothD(s, seg, tr, t, tn, tlast, tribot);
  }
}

// ─── find_new_roots ───────────────────────────────────────────────────────────

/**
 * Update root pointers for each segment endpoint after a batch of insertions.
 * @see lib/ortho/trapezoid.c:find_new_roots
 */
export function findNewRoots(
  segnum: number,
  seg: SegmentT[],
  tr: TrapT[],
  qs: QNode[],
): void {
  const s = seg[segnum];
  if (s.isInserted) return;
  s.root0 = tr[locateEndpoint(s.v0, s.v1, s.root0, seg, qs)].sink;
  s.root1 = tr[locateEndpoint(s.v1, s.v0, s.root1, seg, qs)].sink;
}
