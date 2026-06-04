// SPDX-License-Identifier: EPL-2.0

/**
 * Block-tree positioning orchestration for the circo layout engine.
 *
 * Ports getInfo, setInfo, positionChildren, position, doBlock, circPos
 * from lib/circogen/circpos.c. All functions are exported so lizard
 * counts each one independently.
 *
 * @see lib/circogen/circpos.c
 */

import type { Node } from '../../model/node.js';
import type { Block, SubGraph, CircState } from './blocks.js';
import { blkParent, setCoalesced, FLAGS_ISPARENT } from './blocks.js';
import { applyDelta, getRotation } from './position-helpers.js';
import { layoutBlock } from './blockpath.js';

export type PosState = {
  radius: number; subtreeR: number; nodeAngle: number;
  firstAngle: number; lastAngle: number;
  cp: Block | null; neighbor: Node | null;
};

export type PosInfo = {
  n: Node; theta: number; minRadius: number; maxRadius: number;
  diameter: number; scale: number; childCount: number;
};

/** Context bundle for placeChild — keeps param count ≤5. */
export type PlaceCtx = { childRadius: number; incAngle: number; mindistAngle: number; length: number };

/** Collect child blocks attached at node n. */
export function childrenAtNode(stp: PosState, n: Node): Block[] {
  const result: Block[] = [];
  for (let c = stp.cp; c !== null; c = c.children[0] ?? null) {
    if (blkParent(c) === n && c.circleList.length > 0) result.push(c);
  }
  return result;
}

/** @see lib/circogen/circpos.c:getInfo */
export function getInfo(pi: PosInfo, stp: PosState, minDist: number): number {
  let maxR = 0; let diam = 0; let cnt = 0;
  for (let c = stp.cp; c !== null; c = c.children[0] ?? null) {
    if (blkParent(c) !== pi.n) continue;
    cnt++; maxR = Math.max(maxR, c.radius); diam += 2 * c.radius + minDist;
  }
  pi.diameter = diam; pi.childCount = cnt;
  pi.minRadius = stp.radius + minDist + maxR; pi.maxRadius = maxR;
  return maxR;
}

/** @see lib/circogen/circpos.c:setInfo */
export function setInfo(p0: PosInfo, p1: PosInfo, delta: number): void {
  const t = Math.max(
    (p0.diameter * p1.minRadius + p1.diameter * p0.minRadius)
      / (2 * delta * p0.minRadius * p1.minRadius), 1,
  );
  p0.scale = Math.max(p0.scale, t);
  p1.scale = Math.max(p1.scale, t);
}

/** Rotate and translate one child block; return advanced angle. */
export function placeChild(child: Block, ca: number, ctx: PlaceCtx): number {
  const dx = ctx.childRadius * Math.cos(ca);
  const dy = ctx.childRadius * Math.sin(ca);
  applyDelta(child, dx, dy, getRotation(child, dx, dy, ca));
  return ctx.length === 1
    ? ca + ctx.incAngle + ctx.mindistAngle
    : ca + ctx.incAngle + ctx.mindistAngle / 2;
}

/** Advance child angle for length===1 blocks; updates firstAngle/lastAngle. */
export function advanceAngleL1(
  ca: number, inc: number, total: number, cnt: number, stp: PosState,
): number {
  const next = cnt === 0 ? 0 : (total === 2 ? Math.PI : ca + inc);
  if (stp.firstAngle < 0) stp.firstAngle = next;
  stp.lastAngle = next;
  return next;
}

/** Advance child angle for multi-node blocks. */
export function advanceAngleLN(ca: number, inc: number, mda: number, total: number, theta: number): number {
  if (total === 1) return theta;
  return ca + inc + mda / 2;
}

/** Write psi midpoint angle to node alg when conditions are met. */
export function maybeWritePsi(n: Node, stp: PosState, ca: number, isMid: boolean): void {
  if (isMid && n === stp.neighbor) {
    const alg = n.info.alg as Record<string, unknown> | undefined;
    if (alg) alg['psi'] = ca;
  }
}

/** @see lib/circogen/circpos.c:positionChildren */
export function positionChildren(pi: PosInfo, stp: PosState, length: number, minDist: number): void {
  const children = childrenAtNode(stp, pi.n);
  if (children.length === 0) return;
  let cr = pi.scale * pi.minRadius;
  if (length === 1) cr = Math.max(cr, pi.diameter / (2 * Math.PI));
  stp.subtreeR = Math.max(stp.subtreeR, cr + pi.maxRadius);
  const mda = minDist / cr;
  let ca = length === 1 ? 0 : pi.theta - pi.diameter / (2 * cr);
  const mid = Math.floor((pi.childCount + 1) / 2);
  const ctx: PlaceCtx = { childRadius: cr, incAngle: 0, mindistAngle: mda, length };
  let cnt = 0;
  for (const child of children) {
    ctx.incAngle = child.radius / cr;
    ca = length === 1
      ? advanceAngleL1(ca, ctx.incAngle, children.length, cnt, stp)
      : advanceAngleLN(ca, ctx.incAngle, mda, children.length, pi.theta);
    ca = placeChild(child, ca, ctx);
    cnt++;
    maybeWritePsi(pi.n, stp, ca, cnt === mid && length > 1);
  }
}

/** Build PosInfo array for all articulation nodes in the circle path. */
export function buildParents(nodepath: Node[], stp: PosState, minDist: number): PosInfo[] {
  const parents: PosInfo[] = [];
  for (let i = 0; i < nodepath.length; i++) {
    const n = nodepath[i]!;
    const flags = (n.info.alg as { flags?: number } | undefined)?.flags ?? 0;
    if (!(flags & FLAGS_ISPARENT)) continue;
    const pi: PosInfo = { n, theta: i * stp.nodeAngle, minRadius: 0, maxRadius: 0, diameter: 0, scale: 1.0, childCount: 0 };
    getInfo(pi, stp, minDist);
    parents.push(pi);
  }
  return parents;
}

/** Apply pairwise setInfo scale factors. */
export function applyScaleFactors(parents: PosInfo[]): void {
  if (parents.length < 2) return;
  if (parents.length === 2) {
    let d = parents[1]!.theta - parents[0]!.theta;
    if (d > Math.PI) d = 2 * Math.PI - d;
    setInfo(parents[0]!, parents[1]!, d); return;
  }
  for (let i = 0; i < parents.length; i++) {
    const next = parents[(i + 1) % parents.length]!;
    let d = next.theta - parents[i]!.theta;
    if (d <= 0) d += 2 * Math.PI;
    setInfo(parents[i]!, next, d);
  }
}

/** Apply coalesce or expand radius after positioning children. */
export function finaliseRadius(sn: Block, maxR: number, minDist: number, stp: PosState, childCount: number): void {
  if (childCount === 1) {
    applyDelta(sn, -(maxR + minDist / 2), 0, 0);
    sn.radius += minDist / 2 + maxR;
    setCoalesced(sn);
  } else {
    sn.radius = stp.subtreeR;
  }
}

/** @see lib/circogen/circpos.c:position */
export function position(childCount: number, length: number, nodepath: Node[], sn: Block, minDist: number): number {
  const stp: PosState = {
    cp: sn.children[0] ?? null, subtreeR: sn.radius, radius: sn.radius,
    neighbor: blkParent(sn), nodeAngle: (2 * Math.PI) / length, firstAngle: -1, lastAngle: -1,
  };
  const parents = buildParents(nodepath, stp, minDist);
  applyScaleFactors(parents);
  let maxR = 0;
  for (const pi of parents) { maxR = Math.max(maxR, pi.maxRadius); positionChildren(pi, stp, length, minDist); }
  finaliseRadius(sn, maxR, minDist, stp, childCount);
  return (stp.firstAngle + stp.lastAngle) / 2 - Math.PI;
}

/** @see lib/circogen/circpos.c:doBlock */
export function doBlock(g: SubGraph, sn: Block, minDist: number, state: CircState): void {
  let cc = 0;
  for (const child of sn.children) { doBlock(g, child, minDist, state); cc++; }
  const longest = layoutBlock(g, sn, minDist, state);
  sn.circleList = longest;
  let ca = Math.PI;
  if (cc > 0) ca = position(cc, longest.length, longest, sn, minDist);
  if (longest.length === 1 && blkParent(sn)) {
    sn.parentPos = ca < 0 ? ca + 2 * Math.PI : ca;
  }
}

/** @see lib/circogen/circpos.c:circPos */
export function circPos(g: SubGraph, sn: Block, state: CircState): void {
  doBlock(g, sn, state.minDist, state);
}
