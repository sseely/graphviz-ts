// SPDX-License-Identifier: EPL-2.0

/**
 * Shared utilities for beginpath / endpath, ported from lib/common/splines.c.
 *
 * @see lib/common/splines.c:add_box
 * @see lib/common/splines.c:conc_slope
 */

import type { Point, Box } from '../model/geom.js';
import type { Path, PathendT, ShapeDesc } from './types.js';
import type { Edge } from '../model/edge.js';
import type { Node } from '../model/node.js';
import { TOP, BOTTOM, LEFT, RIGHT, REGULAREDGE, FLATEDGE } from './splines-constants.js';
import { BOTTOM_IX, RIGHT_IX, TOP_IX } from '../layout/dot/position-aux.js';
import { RANKDIR_LR, RANKDIR_RL, RANKDIR_BT } from '../layout/dot/init.js';
import { dist2 } from './spline-midpoint.js';
import { compassPort } from './compass-port.js';
import { makePort } from '../model/edgeInfo.js';

// ---------------------------------------------------------------------------
// add_box
// ---------------------------------------------------------------------------

/**
 * Appends box b to path P if it is non-degenerate.
 * @see lib/common/splines.c:add_box
 */
export function addBox(P: Path, b: Box): void {
  if (b.ll.x < b.ur.x && b.ll.y < b.ur.y) {
    P.boxes[P.nbox++] = b;
  }
}

// ---------------------------------------------------------------------------
// conc_slope
// ---------------------------------------------------------------------------

/**
 * Computes the concentrated slope at node n (mean of in/out angles). Reads the
 * node's own in/out fast-edge lists directly, as C conc_slope reads
 * ND_in(n)/ND_out(n) — only called for spline-merge (concentrator) nodes, which
 * always carry both lists. @see lib/common/splines.c:conc_slope
 */
export function concSlope(n: Node): number {
  const inE = n.info.in;
  const outE = n.info.out;
  const cntIn = inE?.size ?? 0;
  const cntOut = outE?.size ?? 0;
  let sIn = 0;
  let sOut = 0;
  for (let i = 0; i < cntIn; i++) sIn += inE!.list[i].tail.info.coord.x;
  for (let i = 0; i < cntOut; i++) sOut += outE!.list[i].head.info.coord.x;
  const x1 = n.info.coord.x - sIn / cntIn;
  const y1 = n.info.coord.y - inE!.list[0].tail.info.coord.y;
  const x2 = sOut / cntOut - n.info.coord.x;
  const y2 = outE!.list[0].head.info.coord.y - n.info.coord.y;
  return (Math.atan2(y1, x1) + Math.atan2(y2, x2)) / 2.0;
}

// ---------------------------------------------------------------------------
// resolvePort stub
// ---------------------------------------------------------------------------

/** Compass strings indexed by BOTTOM_IX, RIGHT_IX, TOP_IX, LEFT_IX. */
const SIDE_PORT = ['s', 'e', 'n', 'w'] as const;
const ALL_SIDES = TOP | BOTTOM | LEFT | RIGHT;

/** Convert a point to the rankdir frame. @see lib/common/shapes.c:cvtPt */
function cvtPt(p: Point, rankdir: number): Point {
  switch (rankdir) {
    case RANKDIR_BT: return { x: p.x, y: -p.y };
    case RANKDIR_LR: return { x: -p.y, y: p.x };
    case RANKDIR_RL: return { x: p.y, y: p.x };
    default: return { x: p.x, y: p.y }; // RANKDIR_TB
  }
}

/** Flip-aware node bbox in node-local coords. @see shapes.c:closestSide */
function nodeBoxLocal(n: Node, flip: boolean): Box {
  const lw = n.info.lw, ht2 = n.info.ht / 2;
  return flip
    ? { ll: { x: -ht2, y: -lw }, ur: { x: ht2, y: lw } }
    : { ll: { x: -lw, y: -ht2 }, ur: { x: lw, y: ht2 } };
}

/** Midpoint of face `ix` of box b (node-local). @see shapes.c:closestSide */
function faceMidpoint(b: Box, ix: number): Point {
  const cx = (b.ll.x + b.ur.x) / 2, cy = (b.ll.y + b.ur.y) / 2;
  if (ix === BOTTOM_IX) return { x: cx, y: b.ll.y };
  if (ix === RIGHT_IX) return { x: b.ur.x, y: cy };
  if (ix === TOP_IX) return { x: cx, y: b.ur.y };
  return { x: b.ll.x, y: cy }; // LEFT_IX
}

/**
 * Best available side for a dynamic port: the exposed face whose midpoint is
 * closest to the other endpoint. Null → use center.
 * @see lib/common/shapes.c:closestSide:4248
 */
function closestSide(n: Node, other: Node, port: Edge['info']['tail_port']): string | null {
  const sides = port.side;
  if (sides === 0 || sides === ALL_SIDES) return null;
  const rkd = (n.root.info.rankdir ?? 0) & 0x3;
  const pt = cvtPt(n.info.coord, rkd);
  const opt = cvtPt(other.info.coord, rkd);
  const b = port.bp ?? nodeBoxLocal(n, rkd === RANKDIR_LR || rkd === RANKDIR_RL);
  let rv: string | null = null;
  let mind = 0;
  for (let i = 0; i < 4; i++) {
    if ((sides & (1 << i)) === 0) continue;
    const m = faceMidpoint(b, i);
    const d = dist2({ x: m.x + pt.x, y: m.y + pt.y }, opt);
    if (rv === null || d < mind) { mind = d; rv = SIDE_PORT[i]!; }
  }
  return rv;
}

/**
 * Resolve a dynamic (`_`) port to a concrete compass point on the side nearest
 * the other endpoint, then re-run compassPort. Non-dyna ports pass through.
 * @see lib/common/splines.c:resolvePort:4322
 */
export function resolvePort(
  n: Node,
  other: Node,
  port: Edge['info']['tail_port'],
): typeof port {
  if (!port.dyna) return port;
  const compass = closestSide(n, other, port);
  const rv = makePort();
  rv.name = port.name;
  compassPort(n, { bp: port.bp, compass: compass ?? '', sides: port.side }, rv);
  return rv;
}

// ---------------------------------------------------------------------------
// walkToOrig
// ---------------------------------------------------------------------------

/** Walk to_orig chain until NORMAL (edge_type === 0) edge found. */
export function walkToOrig(e: Edge): Edge {
  let cur = e;
  while (cur.info.to_orig != null && cur.info.edge_type !== 0) {
    cur = cur.info.to_orig;
  }
  return cur;
}

// ---------------------------------------------------------------------------
// clearClipForOrig
// ---------------------------------------------------------------------------

/**
 * Clears the clip flag on the appropriate port of the original edge.
 * isTail=true means we're working from the tail side.
 */
export function clearClipForOrig(e: Edge, n: Node, isTail: boolean): void {
  const orig = walkToOrig(e);
  if (isTail) {
    if (n === orig.tail) orig.info.tail_port.clip = false;
    else orig.info.head_port.clip = false;
  } else {
    if (n === orig.head) orig.info.head_port.clip = false;
    else orig.info.tail_port.clip = false;
  }
}

// ---------------------------------------------------------------------------
// applyDefaultBoxes (tail side)
// ---------------------------------------------------------------------------

/** Apply default box adjustments for the tail endpoint. */
export function applyDefaultBoxes(P: Path, et: number, endp: PathendT): void {
  if (et === FLATEDGE) {
    if (endp.sidemask === TOP) endp.boxes[0].ll.y = P.start.p.y;
    else endp.boxes[0].ur.y = P.start.p.y;
  } else {
    endp.boxes[0].ur.y = P.start.p.y;
    endp.sidemask = BOTTOM;
    P.start.p.y -= 1;
  }
}

// ---------------------------------------------------------------------------
// applyEndDefaultBoxes (head side)
// ---------------------------------------------------------------------------

/** Apply default box adjustments for the head endpoint. */
export function applyEndDefaultBoxes(P: Path, et: number, endp: PathendT): void {
  if (et === FLATEDGE) {
    if (endp.sidemask === TOP) endp.boxes[0].ll.y = P.end.p.y;
    else endp.boxes[0].ur.y = P.end.p.y;
  } else {
    endp.boxes[0].ll.y = P.end.p.y;
    endp.sidemask = TOP;
    P.end.p.y += 1;
  }
}

// ---------------------------------------------------------------------------
// invokePboxfn helper (both sides)
// ---------------------------------------------------------------------------

/**
 * Call the node shape's pboxfn if defined, writing its boxes directly into
 * `endp.boxes`/`endp.boxn` (C passes `&endp->boxes[0], &endp->boxn`). Returns
 * the side mask (0 if no pboxfn or it declined). @see lib/common/splines.c
 * beginpath (line 544) / endpath (line 742).
 */
export function invokePboxfn(
  fns: ShapeDesc['fns'],
  n: Node,
  port: Edge['info']['tail_port'],
  side: number,
  endp: PathendT,
): number {
  if (!fns?.pboxfn) return 0;
  const kptr: number[] = [endp.boxn];
  const mask = fns.pboxfn(n, port, side, endp.boxes, kptr);
  endp.boxn = kptr[0];
  return mask;
}

// ---------------------------------------------------------------------------
// setStartTheta / setEndTheta
// ---------------------------------------------------------------------------

/** Configure P.start constrained/theta for the tail endpoint. */
export function setStartTheta(P: Path, e: Edge, merge: boolean): void {
  if (merge) {
    P.start.theta = concSlope(e.tail);
    P.start.constrained = true;
  } else if (e.info.tail_port.constrained) {
    P.start.theta = e.info.tail_port.theta;
    P.start.constrained = true;
  } else {
    P.start.constrained = false;
  }
}

/** Configure P.end constrained/theta for the head endpoint. */
export function setEndTheta(P: Path, e: Edge, merge: boolean): void {
  if (merge) {
    P.end.theta = concSlope(e.head) + Math.PI;
    P.end.constrained = true;
  } else if (e.info.head_port.constrained) {
    P.end.theta = e.info.head_port.theta;
    P.end.constrained = true;
  } else {
    P.end.constrained = false;
  }
}

// ---------------------------------------------------------------------------
// REGULAREDGE constant re-export (avoid importing from two places)
// ---------------------------------------------------------------------------
export { REGULAREDGE };
