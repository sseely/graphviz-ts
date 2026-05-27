// SPDX-License-Identifier: EPL-2.0

/**
 * Sweep-line constraint generation for VPSC overlap removal.
 *
 * @see lib/vpsc/generate-constraints.h
 * @see lib/vpsc/generate-constraints.cpp
 */

import { Variable } from "./Variable.js";
import { Constraint } from "./Constraint.js";
import { Rectangle } from "./Solver.js";
import { EvType, SweepNode, SweepEvent } from "./sweepTypes.js";

export function makeNode(v: Variable, r: Rectangle, pos: number): SweepNode {
  return {
    v, r, pos,
    firstAbove: null, firstBelow: null,
    leftNeighbours: new Set(), rightNeighbours: new Set(),
  };
}

export function compareEventsSameRect(ea: SweepEvent, eb: SweepEvent): number {
  if (ea.type === EvType.Open && eb.type !== EvType.Open) return -1;
  return 1;
}

export function compareEvents(ea: SweepEvent, eb: SweepEvent): number {
  if (ea.node.r === eb.node.r) return compareEventsSameRect(ea, eb);
  if (ea.pos < eb.pos) return -1;
  if (ea.pos > eb.pos) return 1;
  return 0;
}

export function nodePosLt(a: SweepNode, b: SweepNode): boolean {
  if (a.pos < b.pos) return true;
  if (b.pos < a.pos) return false;
  return a < b;
}

export function scanlineInsert(sl: SweepNode[], node: SweepNode): void {
  let lo = 0;
  let hi = sl.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (nodePosLt(sl[mid]!, node)) lo = mid + 1;
    else hi = mid;
  }
  sl.splice(lo, 0, node);
}

export function scanlineRemove(sl: SweepNode[], node: SweepNode): void {
  const i = sl.indexOf(node);
  if (i !== -1) sl.splice(i, 1);
}

export function getLeftNeighbours(sl: SweepNode[], v: SweepNode): Set<SweepNode> {
  const result = new Set<SweepNode>();
  const idx = sl.indexOf(v);
  for (let i = idx - 1; i >= 0; i--) {
    const u = sl[i]!;
    if (u.r.overlapX(v.r) <= 0) { result.add(u); return result; }
    if (u.r.overlapX(v.r) <= u.r.overlapY(v.r)) result.add(u);
  }
  return result;
}

export function getRightNeighbours(sl: SweepNode[], v: SweepNode): Set<SweepNode> {
  const result = new Set<SweepNode>();
  const idx = sl.indexOf(v);
  for (let i = idx + 1; i < sl.length; i++) {
    const u = sl[i]!;
    if (u.r.overlapX(v.r) <= 0) { result.add(u); return result; }
    if (u.r.overlapX(v.r) <= u.r.overlapY(v.r)) result.add(u);
  }
  return result;
}

export function xOpenNeighbour(sl: SweepNode[], v: SweepNode): void {
  const left = getLeftNeighbours(sl, v);
  const right = getRightNeighbours(sl, v);
  v.leftNeighbours = left;
  v.rightNeighbours = right;
  for (const n of left) n.rightNeighbours.add(v);
  for (const n of right) n.leftNeighbours.add(v);
}

export function openLinkChain(sl: SweepNode[], v: SweepNode): void {
  const idx = sl.indexOf(v);
  if (idx > 0) { const u = sl[idx - 1]!; v.firstAbove = u; u.firstBelow = v; }
  if (idx < sl.length - 1) { const u = sl[idx + 1]!; v.firstBelow = u; u.firstAbove = v; }
}

export function xCloseLeft(v: SweepNode, cs: Constraint[]): void {
  for (const u of v.leftNeighbours) {
    cs.push(new Constraint(u.v, v.v, (v.r.width() + u.r.width()) / 2.0));
    u.rightNeighbours.delete(v);
  }
}

export function xCloseRight(v: SweepNode, cs: Constraint[]): void {
  for (const u of v.rightNeighbours) {
    cs.push(new Constraint(v.v, u.v, (v.r.width() + u.r.width()) / 2.0));
    u.leftNeighbours.delete(v);
  }
}

export function xCloseNeighbour(v: SweepNode, cs: Constraint[]): void {
  xCloseLeft(v, cs);
  xCloseRight(v, cs);
}

export function xCloseSimple(v: SweepNode, cs: Constraint[]): void {
  const l = v.firstAbove;
  const r = v.firstBelow;
  if (l !== null) {
    cs.push(new Constraint(l.v, v.v, (v.r.width() + l.r.width()) / 2.0));
    l.firstBelow = v.firstBelow;
  }
  if (r !== null) {
    cs.push(new Constraint(v.v, r.v, (v.r.width() + r.r.width()) / 2.0));
    r.firstAbove = v.firstAbove;
  }
}

export function yClose(v: SweepNode, cs: Constraint[]): void {
  const l = v.firstAbove;
  const r = v.firstBelow;
  if (l !== null) {
    cs.push(new Constraint(l.v, v.v, (v.r.height() + l.r.height()) / 2.0));
    l.firstBelow = v.firstBelow;
  }
  if (r !== null) {
    cs.push(new Constraint(v.v, r.v, (v.r.height() + r.r.height()) / 2.0));
    r.firstAbove = v.firstAbove;
  }
}

export function buildXEvents(rects: Rectangle[], vs: Variable[]): SweepEvent[] {
  const events: SweepEvent[] = [];
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    vs[i]!.desiredPosition = r.getCentreX();
    const node = makeNode(vs[i]!, r, r.getCentreX());
    events.push({ type: EvType.Open, node, pos: r.getMinY() });
    events.push({ type: EvType.Close, node, pos: r.getMaxY() });
  }
  return events;
}

export function buildYEvents(rects: Rectangle[], vs: Variable[]): SweepEvent[] {
  const events: SweepEvent[] = [];
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    vs[i]!.desiredPosition = r.getCentreY();
    const node = makeNode(vs[i]!, r, r.getCentreY());
    events.push({ type: EvType.Open, node, pos: r.getMinX() });
    events.push({ type: EvType.Close, node, pos: r.getMaxX() });
  }
  return events;
}

/**
 * Prepares constraints to apply VPSC horizontally (X axis).
 * @see lib/vpsc/generate-constraints.cpp: generateXConstraints
 */
export function generateXConstraints(
  rects: Rectangle[],
  vs: Variable[],
  useNeighbourLists: boolean
): Constraint[] {
  const events = buildXEvents(rects, vs);
  events.sort(compareEvents);
  const sl: SweepNode[] = [];
  const cs: Constraint[] = [];
  for (const e of events) {
    const v = e.node;
    if (e.type === EvType.Open) {
      scanlineInsert(sl, v);
      if (useNeighbourLists) xOpenNeighbour(sl, v);
      else openLinkChain(sl, v);
    } else {
      if (useNeighbourLists) xCloseNeighbour(v, cs);
      else xCloseSimple(v, cs);
      scanlineRemove(sl, v);
    }
  }
  return cs;
}

/**
 * Prepares constraints to apply VPSC vertically (Y axis).
 * @see lib/vpsc/generate-constraints.cpp: generateYConstraints
 */
export function generateYConstraints(
  rects: Rectangle[],
  vs: Variable[]
): Constraint[] {
  const events = buildYEvents(rects, vs);
  events.sort(compareEvents);
  const sl: SweepNode[] = [];
  const cs: Constraint[] = [];
  for (const e of events) {
    const v = e.node;
    if (e.type === EvType.Open) {
      scanlineInsert(sl, v);
      openLinkChain(sl, v);
    } else {
      yClose(v, cs);
      scanlineRemove(sl, v);
    }
  }
  return cs;
}
