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
import { TOP, BOTTOM, REGULAREDGE, FLATEDGE } from './splines-constants.js';

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
 * Computes the concentrated slope at node n (mean of in/out angles).
 * @see lib/common/splines.c:conc_slope
 */
export function concSlope(n: Node, inEdges: Edge[], outEdges: Edge[]): number {
  let sIn = 0;
  let sOut = 0;
  for (const e of inEdges) sIn += e.tail.info.coord.x;
  for (const e of outEdges) sOut += e.head.info.coord.x;
  const cntIn = inEdges.length;
  const cntOut = outEdges.length;
  const x1 = n.info.coord.x - sIn / cntIn;
  const y1 = n.info.coord.y - inEdges[0].tail.info.coord.y;
  const x2 = sOut / cntOut - n.info.coord.x;
  const y2 = outEdges[0].head.info.coord.y - n.info.coord.y;
  return (Math.atan2(y1, x1) + Math.atan2(y2, x2)) / 2.0;
}

// ---------------------------------------------------------------------------
// resolvePort stub
// ---------------------------------------------------------------------------

/**
 * Returns a dynamically resolved port — stub until portfn is fully ported.
 * @see lib/common/splines.c:resolvePort
 */
export function resolvePort(
  _n: Node,
  _other: Node,
  port: Edge['info']['tail_port'],
): typeof port {
  return port;
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
 * Calls pboxfn if available; returns the mask (0 if not available/failed).
 */
export function invokePboxfn(
  pboxfn: ShapeDesc['fns'],
  n: Node,
  port: Edge['info']['tail_port'],
  side: number,
): number {
  if (!pboxfn?.pboxfn) return 0;
  const rv: Box[] = [];
  const kptr: number[] = [0];
  return pboxfn.pboxfn(n, port, side, rv, kptr);
}

// ---------------------------------------------------------------------------
// setStartTheta / setEndTheta
// ---------------------------------------------------------------------------

/** Configure P.start constrained/theta for the tail endpoint. */
export function setStartTheta(
  P: Path, e: Edge, merge: boolean, inEdges: Edge[], outEdges: Edge[],
): void {
  if (merge) {
    P.start.theta = concSlope(e.tail, inEdges, outEdges);
    P.start.constrained = true;
  } else if (e.info.tail_port.constrained) {
    P.start.theta = e.info.tail_port.theta;
    P.start.constrained = true;
  } else {
    P.start.constrained = false;
  }
}

/** Configure P.end constrained/theta for the head endpoint. */
export function setEndTheta(
  P: Path, e: Edge, merge: boolean, inEdges: Edge[], outEdges: Edge[],
): void {
  if (merge) {
    P.end.theta = concSlope(e.head, inEdges, outEdges) + Math.PI;
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
