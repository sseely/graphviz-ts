// SPDX-License-Identifier: EPL-2.0
/**
 * Neighbour-grid intersection recording and xladjust position search.
 * Internal — consumed only by xlabels.ts.
 * @see lib/label/xlabels.c
 */

import { type Rect } from './rectangle.js';
import {
  type RTree,
  type Leaf,
  rTreeSearch,
  rTreeLeafListFree,
} from './index.js';
import { type ObjectT, type XLabelT } from './xlabels.js';
import {
  aabbaabb,
  objp2rect,
  objplp2rect,
  lblenclosing,
} from './xlabels-geom.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** @see lib/label/xlabels.h:XLXDENOM */
export const XLXDENOM = 8;
/** @see lib/label/xlabels.h:XLYDENOM */
export const XLYDENOM = 2;
/** 9-neighbour grid size. @see lib/label/xlabels.h:XLNBR */
export const XLNBR = 9;

const XLPXPY = 0;
const XLCXPY = 1;
const XLNXPY = 2;
const XLPXCY = 3;
// XLCXCY = 4 (unused in switching logic; default slot)
const XLNXCY = 5;
const XLPXNY = 6;
const XLCXNY = 7;
const XLNXNY = 8;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Best-position accumulator.
 * @see lib/label/xlabels.h:BestPos_t
 */
export interface BestPosT {
  n: number;
  area: number;
  pos: { x: number; y: number };
}

/**
 * XLabels state bundle (forward-declared interface; full type in xlabels.ts).
 */
export interface XLabelsState {
  objs: ObjectT[];
  nObjs: number;
  spdx: RTree;
}

// ---------------------------------------------------------------------------
// Neighbour-grid helpers
// ---------------------------------------------------------------------------

/** Map x-delta to column index: -1→prev, 0→center, +1→next. */
function xcol(opx: number, cpx: number): -1 | 0 | 1 {
  if (cpx < opx) return -1;
  if (cpx > opx) return  1;
  return 0;
}

/**
 * Grid index for cp in the same row (cp.y === op.y) or return -1 if same pos.
 * @see lib/label/xlabels.c:getintrsxi (y-equal branch)
 */
function intrsxiSameRow(opx: number, cpx: number): number {
  if (cpx < opx) return XLPXCY;
  if (cpx > opx) return XLNXCY;
  return -1;
}

/**
 * Grid index for cp when cp.y < op.y (positive-y neighbour in screen coords).
 * @see lib/label/xlabels.c:getintrsxi (cp.pos.y < op.pos.y branch)
 */
function intrsxiPosY(col: -1 | 0 | 1): number {
  if (col === -1) return XLPXPY;
  if (col ===  1) return XLNXPY;
  return XLCXPY;
}

/**
 * Grid index for cp when cp.y > op.y (negative-y neighbour in screen coords).
 * @see lib/label/xlabels.c:getintrsxi (cp.pos.y > op.pos.y branch)
 */
function intrsxiNegY(col: -1 | 0 | 1): number {
  if (col === -1) return XLPXNY;
  if (col ===  1) return XLNXNY;
  return XLCXNY;
}

/**
 * Map candidate object cp to its 9-cell neighbour-grid index relative to op.
 * Returns -1 when either label is unset or either object is at the origin.
 * @see lib/label/xlabels.c:getintrsxi
 */
function getintrsxi(op: ObjectT, cp: ObjectT): number {
  const lp  = op.lbl as XLabelT;
  const clp = cp.lbl as XLabelT;
  if (lp.set === 0 || clp.set === 0) return -1;
  if (
    (op.pos.x === 0.0 && op.pos.y === 0.0) ||
    (cp.pos.x === 0.0 && cp.pos.y === 0.0)
  ) return -1;

  if (cp.pos.y < op.pos.y) return intrsxiPosY(xcol(op.pos.x, cp.pos.x));
  if (cp.pos.y > op.pos.y) return intrsxiNegY(xcol(op.pos.x, cp.pos.x));
  return intrsxiSameRow(op.pos.x, cp.pos.x);
}

/**
 * Compute max overlap area comparing existing slot against new candidate.
 * Returns {maxa, replace}: replace=true means slot should be overwritten.
 * @see lib/label/xlabels.c:recordointrsx / recordlintrsx (shared logic)
 */
function maxOverlapArea(
  existing: ObjectT,
  rp: Rect,
  a: number,
): { maxa: number; replace: boolean } {
  let maxa = 0.0;
  const sa1 = aabbaabb(rp, objp2rect(existing));
  if (sa1 > a) maxa = sa1;
  if (existing.lbl) {
    const sa2 = aabbaabb(rp, objplp2rect(existing));
    if (sa2 > a) maxa = Math.max(sa2, maxa);
  }
  return { maxa, replace: maxa === 0.0 };
}

/**
 * Record intersecting object in neighbour grid.
 * @see lib/label/xlabels.c:recordointrsx
 */
export function recordointrsx(
  op: ObjectT, cp: ObjectT, rp: Rect, a: number,
  intrsx: (ObjectT | null)[],
): number {
  let i = getintrsxi(op, cp);
  if (i < 0) i = XLNXCY;
  if (intrsx[i] !== null) {
    const { maxa, replace } = maxOverlapArea(intrsx[i]!, rp, a);
    if (!replace) return maxa;
    intrsx[i] = cp;
    return a;
  }
  intrsx[i] = cp;
  return a;
}

/**
 * Record intersecting label in neighbour grid.
 * @see lib/label/xlabels.c:recordlintrsx
 */
export function recordlintrsx(
  op: ObjectT, cp: ObjectT, rp: Rect, a: number,
  intrsx: (ObjectT | null)[],
): number {
  let i = getintrsxi(op, cp);
  if (i < 0) i = XLNXCY;
  if (intrsx[i] !== null) {
    const { maxa, replace } = maxOverlapArea(intrsx[i]!, rp, a);
    if (!replace) return maxa;
    intrsx[i] = cp;
    return a;
  }
  intrsx[i] = cp;
  return a;
}

// ---------------------------------------------------------------------------
// Intersection scoring
// ---------------------------------------------------------------------------

/**
 * Process one R-tree leaf hit: record object and label intersections.
 * @see lib/label/xlabels.c:xlintersections (leaf loop body)
 */
function processLeafHit(
  objp: ObjectT, rect: Rect, cp: ObjectT,
  bp: BestPosT, intrsx: (ObjectT | null)[],
): void {
  if (cp === objp) return;
  const a = aabbaabb(rect, objp2rect(cp));
  if (a > 0.0) { bp.n++; bp.area += recordointrsx(objp, cp, rect, a, intrsx); }
  if (!cp.lbl || !(cp.lbl as XLabelT).set) return;
  const a2 = aabbaabb(rect, objplp2rect(cp));
  if (a2 > 0.0) { bp.n++; bp.area += recordlintrsx(objp, cp, rect, a2, intrsx); }
}

/**
 * Find all objects/labels intersecting objp's current label position.
 * @see lib/label/xlabels.c:xlintersections
 */
export function xlintersections(
  xlp: XLabelsState, objp: ObjectT,
  intrsx: (ObjectT | null)[],
): BestPosT {
  const bp: BestPosT = { n: 0, area: 0, pos: { ...(objp.lbl as XLabelT).pos } };
  for (let i = 0; i < xlp.nObjs; i++) {
    const oi = xlp.objs[i];
    // C: skip only when BOTH dimensions are positive (sz.x > 0 && sz.y > 0),
    // so an object with one zero dimension still participates.
    if (oi === objp || (oi.sz.x > 0 && oi.sz.y > 0)) continue;
    if (lblenclosing(objp, oi)) bp.n++;
  }
  const rect = objplp2rect(objp);
  const leaves: Leaf[] = rTreeSearch(xlp.spdx, xlp.spdx.root!, rect);
  for (const leaf of leaves) processLeafHit(objp, rect, leaf.data as ObjectT, bp, intrsx);
  rTreeLeafListFree(leaves);
  return bp;
}

// ---------------------------------------------------------------------------
// Candidate position probes
// ---------------------------------------------------------------------------

/**
 * Try one (px,py) candidate; return updated bp and whether zero-intersection
 * was achieved (done=true → caller should return immediately).
 */
function tryPos(
  xlp: XLabelsState, objp: ObjectT, px: number, py: number,
  bp: BestPosT, intrsx: (ObjectT | null)[],
): { bp: BestPosT; done: boolean } {
  const lp = objp.lbl as XLabelT;
  lp.pos.x = px; lp.pos.y = py;
  const nbp = xlintersections(xlp, objp, intrsx);
  if (nbp.n === 0) return { bp: nbp, done: true };
  return { bp: nbp.area < bp.area ? nbp : bp, done: false };
}

/**
 * Slide along top edge (left→right). @see lib/label/xlabels.c:xladjust
 */
function slideTopEdge(
  xlp: XLabelsState, objp: ObjectT, xincr: number,
  bp: BestPosT, intrsx: (ObjectT | null)[],
): { bp: BestPosT; done: boolean } {
  const lp = objp.lbl as XLabelT;
  const yT = objp.pos.y + objp.sz.y;
  for (let px = objp.pos.x - lp.sz.x; px <= objp.pos.x + objp.sz.x; px += xincr) {
    const r = tryPos(xlp, objp, px, yT, bp, intrsx);
    bp = r.bp; if (r.done) return { bp, done: true };
  }
  return { bp, done: false };
}

/**
 * Slide down left edge (top→bottom). @see lib/label/xlabels.c:xladjust
 */
function slideLeftEdge(
  xlp: XLabelsState, objp: ObjectT, yincr: number,
  bp: BestPosT, intrsx: (ObjectT | null)[],
): { bp: BestPosT; done: boolean } {
  const lp = objp.lbl as XLabelT;
  const xL = objp.pos.x - lp.sz.x;
  for (let py = objp.pos.y + objp.sz.y; py >= objp.pos.y - lp.sz.y; py -= yincr) {
    const r = tryPos(xlp, objp, xL, py, bp, intrsx);
    bp = r.bp; if (r.done) return { bp, done: true };
  }
  return { bp, done: false };
}

/**
 * Slide along bottom edge (right→left). @see lib/label/xlabels.c:xladjust
 */
function slideBottomEdge(
  xlp: XLabelsState, objp: ObjectT, xincr: number,
  bp: BestPosT, intrsx: (ObjectT | null)[],
): { bp: BestPosT; done: boolean } {
  const lp = objp.lbl as XLabelT;
  const yB = objp.pos.y - lp.sz.y;
  for (let px = objp.pos.x + objp.sz.x; px >= objp.pos.x - lp.sz.x; px -= xincr) {
    const r = tryPos(xlp, objp, px, yB, bp, intrsx);
    bp = r.bp; if (r.done) return { bp, done: true };
  }
  return { bp, done: false };
}

/**
 * Slide up right edge (bottom→top). @see lib/label/xlabels.c:xladjust
 */
function slideRightEdge(
  xlp: XLabelsState, objp: ObjectT, yincr: number,
  bp: BestPosT, intrsx: (ObjectT | null)[],
): { bp: BestPosT; done: boolean } {
  const lp = objp.lbl as XLabelT;
  const xR = objp.pos.x + objp.sz.x;
  for (let py = objp.pos.y - lp.sz.y; py <= objp.pos.y + objp.sz.y; py += yincr) {
    const r = tryPos(xlp, objp, xR, py, bp, intrsx);
    bp = r.bp; if (r.done) return { bp, done: true };
  }
  return { bp, done: false };
}

/**
 * Top-left sliding pass (along top edge then down left edge).
 * @see lib/label/xlabels.c:xladjust (sliding from top left)
 */
export function slideFromTopLeft(
  xlp: XLabelsState, objp: ObjectT, xincr: number, yincr: number,
  bp: BestPosT, intrsx: (ObjectT | null)[],
): { bp: BestPosT; done: boolean } {
  if (!intrsx[XLCXNY] && !intrsx[XLNXNY]) {
    const r = slideTopEdge(xlp, objp, xincr, bp, intrsx);
    bp = r.bp; if (r.done) return { bp, done: true };
  }
  if (!intrsx[XLPXCY] && !intrsx[XLPXPY]) {
    const r = slideLeftEdge(xlp, objp, yincr, bp, intrsx);
    bp = r.bp; if (r.done) return { bp, done: true };
  }
  return { bp, done: false };
}

/**
 * Bottom-right sliding pass (along bottom edge then up right edge).
 * @see lib/label/xlabels.c:xladjust (sliding from bottom right)
 */
export function slideFromBottomRight(
  xlp: XLabelsState, objp: ObjectT, xincr: number, yincr: number,
  bp: BestPosT, intrsx: (ObjectT | null)[],
): { bp: BestPosT; done: boolean } {
  if (!intrsx[XLCXPY] && !intrsx[XLPXPY]) {
    const r = slideBottomEdge(xlp, objp, xincr, bp, intrsx);
    bp = r.bp; if (r.done) return { bp, done: true };
  }
  if (!intrsx[XLNXCY] && !intrsx[XLNXNY]) {
    const r = slideRightEdge(xlp, objp, yincr, bp, intrsx);
    bp = r.bp; if (r.done) return { bp, done: true };
  }
  return { bp, done: false };
}

/**
 * Try the 7 remaining fixed candidate positions after the initial top-left probe.
 * @see lib/label/xlabels.c:xladjust (fixed position probes)
 */
export function tryFixedPositions(
  xlp: XLabelsState, objp: ObjectT,
  bp: BestPosT, intrsx: (ObjectT | null)[],
): { bp: BestPosT; done: boolean } {
  const lp = objp.lbl as XLabelT;
  const xL = objp.pos.x - lp.sz.x;
  const xM = objp.pos.x;
  const xR = objp.pos.x + objp.sz.x;
  const yT = objp.pos.y + objp.sz.y;
  const yM = objp.pos.y;
  const yB = objp.pos.y - lp.sz.y;
  const candidates: [number, number][] = [
    [xL, yM], [xL, yB],
    [xM, yT], [xM, yB],
    [xR, yT], [xR, yM], [xR, yB],
  ];
  for (const [px, py] of candidates) {
    const r = tryPos(xlp, objp, px, py, bp, intrsx);
    bp = r.bp; if (r.done) return { bp, done: true };
  }
  return { bp, done: false };
}

// ---------------------------------------------------------------------------
// xladjust
// ---------------------------------------------------------------------------

/**
 * Find the best label position for objp using the 9-candidate + sliding search.
 * @see lib/label/xlabels.c:xladjust
 */
export function xladjust(xlp: XLabelsState, objp: ObjectT): BestPosT {
  const lp = objp.lbl as XLabelT;
  const xincr = (2 * lp.sz.x + objp.sz.x) / XLXDENOM;
  const yincr = (2 * lp.sz.y + objp.sz.y) / XLYDENOM;
  const intrsx: (ObjectT | null)[] = new Array(XLNBR).fill(null);

  // Initial probe: x-left, top
  lp.pos.x = objp.pos.x - lp.sz.x;
  lp.pos.y = objp.pos.y + objp.sz.y;
  let bp: BestPosT = xlintersections(xlp, objp, intrsx);
  if (bp.n === 0) return bp;

  { const r = tryFixedPositions(xlp, objp, bp, intrsx);
    bp = r.bp; if (r.done) return bp; }

  const needsTopLeft =
    intrsx[XLPXNY] || intrsx[XLCXNY] || intrsx[XLNXNY] ||
    intrsx[XLPXCY] || intrsx[XLPXPY];
  if (needsTopLeft) {
    const r = slideFromTopLeft(xlp, objp, xincr, yincr, bp, intrsx);
    bp = r.bp; if (r.done) return bp;
  }

  lp.pos.x = objp.pos.x + objp.sz.x;
  lp.pos.y = objp.pos.y - lp.sz.y;

  const needsBottomRight =
    intrsx[XLNXPY] || intrsx[XLCXPY] || intrsx[XLPXPY] ||
    intrsx[XLNXCY] || intrsx[XLNXNY];
  if (needsBottomRight) {
    const r = slideFromBottomRight(xlp, objp, xincr, yincr, bp, intrsx);
    bp = r.bp; if (r.done) return bp;
  }

  return bp;
}
