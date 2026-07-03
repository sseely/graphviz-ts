// SPDX-License-Identifier: EPL-2.0

/**
 * Port of compassPort and poly_port from lib/common/shapes.c.
 *
 * compassPort maps a compass string to a Port (p, theta, side, clip, dyna,
 * defined, constrained, order).  poly_port is the portfn for all polygon
 * shapes — it delegates to compassPort after checking the HTML label branch
 * (the HTML branch calls htmlPort, which is not ported until T7; the stub
 * returns null and yields a zero/default port).
 *
 * @see lib/common/shapes.c:compassPort (line 2698)
 * @see lib/common/shapes.c:poly_port (line 2880)
 */

import type { Point, Box } from '../model/geom.js';
import type { Port } from '../model/geom.js';
import type { Node } from '../model/node.js';
import { ccwrotatepf } from '../model/geom.js';
import { makePort } from '../model/edgeInfo.js';
import { BOTTOM, RIGHT, TOP, LEFT } from './splines-constants.js';
import { MC_SCALE } from '../layout/dot/fastgr.js';
import { RANKDIR_LR, RANKDIR_BT, RANKDIR_RL } from '../layout/dot/init.js';
import { bezierClip } from './splines-geom.js';
import type { InsideContext } from './splines-geom.js';
import { portToTbl } from './htmltable-port.js';
import type { PlacedHtml } from './htmltable-pos.js';
import { P_BOX } from './shapeData.js';

/** Node shape inside-function (poly_inside / record_inside). @see inside_t */
type ShapeHost = {
  shape?: {
    fns?: { insidefn?: ((c: InsideContext, p: Point) => boolean) | null } | null;
    /** The shape's polygon struct; box/rect/rectangle all share P_BOX. */
    polygon?: unknown;
  } | null;
};

/**
 * IS_BOX(n): the node's shape is box/rect/rectangle — the three that share the
 * single `p_box` polygon struct. C skips the compass ray-cast for these and uses
 * the exact bbox corner (poly_port sets ictxtp = NULL); every other shape,
 * including `square` (a distinct p_square struct), ray-casts.
 * @see lib/common/shapes.c:206 IS_BOX / shapes.c:2902-2903 poly_port
 */
function isBox(n: Node): boolean {
  return (n.info as unknown as ShapeHost).shape?.polygon === P_BOX;
}

// ---------------------------------------------------------------------------
// RANKDIR helpers
// ---------------------------------------------------------------------------

/** GD_rankdir(g): effective rank direction. @see lib/common/types.h:GD_rankdir */
function gdRankdir(n: Node): number { return n.root.info.rankdir & 0x3; }

/** GD_flip(g): LR or RL layout. @see lib/common/types.h:GD_flip */
function gdFlip(n: Node): boolean { return (gdRankdir(n) & 1) !== 0; }

// ---------------------------------------------------------------------------
// cwrotatepf — clockwise rotation
// @see lib/common/geom.c:cwrotatepf
// ---------------------------------------------------------------------------

/** Clockwise rotate point by cwrot degrees. @see lib/common/geom.c:cwrotatepf */
function cwrotatepf(p: Point, cwrot: number): Point {
  switch (cwrot) {
    case 90:  return { x: p.y, y: -p.x };
    case 180: return { x: p.x, y: -p.y };
    case 270: return { x: p.y, y: p.x };
    default:  return p;
  }
}

// ---------------------------------------------------------------------------
// invflipSide helpers
// @see lib/common/shapes.c:invflip_side (line 2548)
// ---------------------------------------------------------------------------

function invflipSideBT(side: number): number {
  if (side === TOP)    return BOTTOM;
  if (side === BOTTOM) return TOP;
  return side;
}

function invflipSideLR(side: number): number {
  if (side === TOP)    return RIGHT;
  if (side === BOTTOM) return LEFT;
  if (side === LEFT)   return TOP;
  if (side === RIGHT)  return BOTTOM;
  return side;
}

function invflipSideRL(side: number): number {
  if (side === TOP)    return RIGHT;
  if (side === BOTTOM) return LEFT;
  if (side === LEFT)   return BOTTOM;
  if (side === RIGHT)  return TOP;
  return side;
}

/** Adjust port side bitmask for rankdir. @see lib/common/shapes.c:invflip_side (line 2548) */
function invflipSide(side: number, rankdir: number): number {
  switch (rankdir) {
    case RANKDIR_BT: return invflipSideBT(side);
    case RANKDIR_LR: return invflipSideLR(side);
    case RANKDIR_RL: return invflipSideRL(side);
    default:         return side; // RANKDIR_TB: identity
  }
}

// ---------------------------------------------------------------------------
// invflipAngle helpers
// @see lib/common/shapes.c:invflip_angle (line 2606)
// ---------------------------------------------------------------------------

function invflipAngleRL(angle: number): number {
  if (angle === Math.PI)         return -0.5 * Math.PI;
  if (angle === Math.PI * 0.75)  return -0.25 * Math.PI;
  if (angle === Math.PI * 0.5)   return 0;
  if (angle === 0)               return Math.PI * 0.5;
  if (angle === Math.PI * -0.25) return Math.PI * 0.75;
  if (angle === Math.PI * -0.5)  return Math.PI;
  return angle;
}

/** Adjust theta for rankdir. @see lib/common/shapes.c:invflip_angle (line 2606) */
function invflipAngle(angle: number, rankdir: number): number {
  switch (rankdir) {
    case RANKDIR_BT: return -angle;
    case RANKDIR_LR: return angle - Math.PI * 0.5;
    case RANKDIR_RL: return invflipAngleRL(angle);
    default:         return angle; // RANKDIR_TB: identity
  }
}

// ---------------------------------------------------------------------------
// compassBbox — compute bbox from bp or node dims
// @see lib/common/shapes.c:2711-2731
// ---------------------------------------------------------------------------

type BboxResult = { b: Box; p: Point; defined: boolean };

/** Node bbox for non-flipped (TB/BT) rankdir. */
function bboxTB(n: Node): Box {
  return { ur: { x: n.info.lw, y: n.info.ht / 2 }, ll: { x: -n.info.lw, y: -(n.info.ht / 2) } };
}

/** Node bbox for flipped (LR/RL) rankdir. */
function bboxLR(n: Node): Box {
  return { ur: { x: n.info.ht / 2, y: n.info.lw }, ll: { x: -(n.info.ht / 2), y: -n.info.lw } };
}

/** Compute reference bbox for compassPort. @see lib/common/shapes.c:compassPort (lines 2711-2731) */
function compassBbox(n: Node, bp: Box | null): BboxResult {
  if (bp !== null) {
    const p: Point = { x: (bp.ll.x + bp.ur.x) / 2, y: (bp.ll.y + bp.ur.y) / 2 };
    return { b: bp, p, defined: true };
  }
  return { b: gdFlip(n) ? bboxLR(n) : bboxTB(n), p: { x: 0, y: 0 }, defined: false };
}

// ---------------------------------------------------------------------------
// DirectionResult — output from compassDirection sub-helpers
// ---------------------------------------------------------------------------

type DirectionResult = {
  p: Point; theta: number; side: number;
  constrain: boolean; clip: boolean; dyna: boolean;
  defined: boolean; rv: number;
};

/** Default/center result (no recognized compass point). */
function dirDefault(p: Point): DirectionResult {
  return { p, theta: 0, side: 0, constrain: false, clip: true, dyna: false, defined: false, rv: 0 };
}

/** Unrecognized compass string result. */
function dirUnrecognized(p: Point): DirectionResult {
  return { p, theta: 0, side: 0, constrain: false, clip: true, dyna: false, defined: false, rv: 1 };
}

// ---------------------------------------------------------------------------
// Per-direction helpers
// @see lib/common/shapes.c:compassPort (lines 2733-2840)
// ---------------------------------------------------------------------------

function dirN(rest: string, b: Box, ctr: Point, sides: number): DirectionResult {
  const base = { constrain: true, clip: false, dyna: false };
  switch (rest) {
    case '':  return { ...base, p: { x: ctr.x,  y: b.ur.y }, theta: Math.PI * 0.5,  side: sides & TOP,           defined: true, rv: 0 };
    case 'e': return { ...base, p: { x: b.ur.x, y: b.ur.y }, theta: Math.PI * 0.25, side: sides & (TOP | RIGHT), defined: true, rv: 0 };
    case 'w': return { ...base, p: { x: b.ll.x, y: b.ur.y }, theta: Math.PI * 0.75, side: sides & (TOP | LEFT),  defined: true, rv: 0 };
    default:  return dirUnrecognized({ x: ctr.x, y: ctr.y });
  }
}

function dirS(rest: string, b: Box, ctr: Point, sides: number): DirectionResult {
  const base = { constrain: true, clip: false, dyna: false };
  switch (rest) {
    case '':  return { ...base, p: { x: ctr.x,  y: b.ll.y }, theta: -Math.PI * 0.5,  side: sides & BOTTOM,           defined: true, rv: 0 };
    case 'e': return { ...base, p: { x: b.ur.x, y: b.ll.y }, theta: -Math.PI * 0.25, side: sides & (BOTTOM | RIGHT), defined: true, rv: 0 };
    case 'w': return { ...base, p: { x: b.ll.x, y: b.ll.y }, theta: -Math.PI * 0.75, side: sides & (BOTTOM | LEFT),  defined: true, rv: 0 };
    default:  return dirUnrecognized({ x: ctr.x, y: ctr.y });
  }
}

function dirE(rest: string, b: Box, ctr: Point, sides: number): DirectionResult {
  if (rest.length > 0) return dirUnrecognized(ctr);
  return { p: { x: b.ur.x, y: ctr.y }, theta: 0, side: sides & RIGHT, constrain: true, clip: false, dyna: false, defined: true, rv: 0 };
}

function dirW(rest: string, b: Box, ctr: Point, sides: number): DirectionResult {
  if (rest.length > 0) return dirUnrecognized(ctr);
  return { p: { x: b.ll.x, y: ctr.y }, theta: Math.PI, side: sides & LEFT, constrain: true, clip: false, dyna: false, defined: true, rv: 0 };
}

// ---------------------------------------------------------------------------
// compassDirection — dispatch on first compass character
// @see lib/common/shapes.c:compassPort (lines 2733-2840)
// ---------------------------------------------------------------------------

/** Map compass string to direction fields. C NULL → TS ''; both yield center. @see lib/common/shapes.c:compassPort (lines 2733-2840) */
function compassDirection(compass: string, b: Box, ctr: Point, sides: number): DirectionResult {
  if (compass.length === 0) return dirDefault(ctr);
  const rest = compass.slice(1);
  switch (compass[0]) {
    case 'n': return dirN(rest, b, ctr, sides);
    case 's': return dirS(rest, b, ctr, sides);
    case 'e': return dirE(rest, b, ctr, sides);
    case 'w': return dirW(rest, b, ctr, sides);
    case '_': return { p: { ...ctr }, theta: 0, side: sides, constrain: false, clip: true, dyna: true,  defined: false, rv: 0 };
    case 'c': return dirDefault(ctr);
    default:  return dirUnrecognized(ctr);
  }
}

// ---------------------------------------------------------------------------
// compassPort — orchestrator
// @see lib/common/shapes.c:compassPort (line 2698)
// ---------------------------------------------------------------------------

/**
 * Arguments to compassPort, bundled to satisfy the ≤4 param limit.
 * Mirrors C `compassPort(n, bp, pp, compass, sides, ictxt)` where ictxt=null (AD2).
 * @see lib/common/shapes.c:compassPort (line 2698)
 */
export type CompassArgs = {
  /** Subfield bbox (record/HTML cell), or null to use node dims. */
  bp: Box | null;
  /** Compass direction: 'n','ne','e','se','s','sw','w','nw','c','_',''. */
  compass: string;
  /** Exposed sides bitmask (BOTTOM|RIGHT|TOP|LEFT). @see lib/common/const.h */
  sides: number;
};

/** Set mincross order on pp from the rotated point. */
function setOrder(pp: Port, q: Point): void {
  if (q.x === 0 && q.y === 0) { pp.order = (MC_SCALE / 2) | 0; return; }
  let a = Math.atan2(q.y, q.x) + 1.5 * Math.PI;
  if (a >= 2 * Math.PI) a -= 2 * Math.PI;
  pp.order = (MC_SCALE * a / (2 * Math.PI)) | 0;
}

/** Write all direction fields onto pp. */
function applyDir(pp: Port, bp: Box | null, dir: DirectionResult, rd: number, definedFinal: boolean): void {
  const q = cwrotatepf(dir.p, 90 * rd);
  pp.p = q; pp.bp = bp;
  pp.side = dir.dyna ? dir.side : invflipSide(dir.side, rd);
  pp.theta = invflipAngle(dir.theta, rd);
  setOrder(pp, q);
  pp.constrained = dir.constrain; pp.defined = definedFinal;
  pp.clip = dir.clip; pp.dyna = dir.dyna;
}

/** Node shape inside-function, or null. @see inside_t.s.n / ND_shape(n)->fns->insidefn */
function nodeInsideFn(n: Node): ((c: InsideContext, p: Point) => boolean) | null {
  return (n.info as unknown as ShapeHost).shape?.fns?.insidefn ?? null;
}

/**
 * Find the point on the node's shape boundary along the ray from the node
 * centre toward (xArg, yArg) by clipping a straight Bézier against the shape's
 * inside-function. The C `ictxt` path; without it, compassPort falls back to
 * bbox corners (wrong for diagonal compass points on non-box shapes).
 * @see lib/common/shapes.c:compassPoint
 */
function compassPoint(
  n: Node, insideFn: (c: InsideContext, p: Point) => boolean,
  yArg: number, xArg: number, rd: number,
): Point {
  let p: Point = { x: xArg, y: yArg };
  if (rd) p = cwrotatepf(p, 90 * rd);
  // Straight (degenerate) Bézier from centre (inside) to the far target.
  const curve: Point[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: p.x, y: p.y }, { x: p.x, y: p.y }];
  const ctx: InsideContext = { nodeCoord: n.info.coord, rw: n.info.rw, bp: null, node: n };
  bezierClip(ctx, insideFn, curve, true);
  return rd ? ccwrotatepf(curve[0], 90 * rd) : curve[0];
}

/**
 * For a directional compass on a shaped node (whole-node, bp=null), replace the
 * bbox-corner point with the actual shape-boundary point. C derives the
 * compassPoint target from the same per-direction axes the bbox point uses;
 * dir.p.x/y were assigned literally from b.ur/b.ll/ctr, so === is exact.
 * @see lib/common/shapes.c:compassPort (ictxt branch)
 */
function applyIctxt(n: Node, dir: DirectionResult, b: Box, ctr: Point): void {
  if (dir.rv !== 0 || !dir.constrain) return;
  const insideFn = nodeInsideFn(n);
  if (insideFn === null) return;
  const maxv = 4 * Math.max(b.ur.x, b.ur.y);
  const xArg = dir.p.x === b.ur.x ? maxv : dir.p.x === b.ll.x ? -maxv : ctr.x;
  const yArg = dir.p.y === b.ur.y ? maxv : dir.p.y === b.ll.y ? -maxv : ctr.y;
  dir.p = compassPoint(n, insideFn, yArg, xArg, gdRankdir(n));
}

/** Attach compass point to pp. Returns 1 if compass unrecognized. @see lib/common/shapes.c:compassPort (line 2698) */
export function compassPort(n: Node, args: CompassArgs, pp: Port): number {
  const { bp, compass, sides } = args;
  const { b, p, defined: defBp } = compassBbox(n, bp);
  const dir = compassDirection(compass, b, p, sides);
  // ictxt path: whole-node compass on a shaped node uses the real boundary via
  // ray-cast — EXCEPT box/rect/rectangle, for which C sets ictxt=NULL and keeps
  // the exact bbox corner (bezierClip can't converge onto a rectangle corner).
  // @see lib/common/shapes.c:2902-2903 poly_port (IS_BOX(n) ⇒ ictxtp = NULL)
  if (bp === null && !isBox(n)) applyIctxt(n, dir, b, p);
  const defFinal = dir.rv === 1 ? defBp : (dir.defined || defBp);
  applyDir(pp, bp, dir, gdRankdir(n), defFinal);
  return dir.rv;
}

// ---------------------------------------------------------------------------
// htmlPort stub — T7 dependency
// @see lib/common/htmltable.c:html_port (line 916)
// ---------------------------------------------------------------------------

/**
 * Resolve an HTML node port name to its node-relative box, walking the placed
 * table tree (portToTbl/portToCell). Sets `sides.value` to the matched
 * element's boundary mask. Returns null when the label is plain text or no port
 * matches. @see lib/common/htmltable.c:html_port
 */
function htmlPort(n: Node, portname: string, sides: { value: number }): Box | null {
  const label = n.info.label as { u?: { kind?: string; html?: PlacedHtml } } | undefined;
  const placed = label?.u?.kind === 'html' ? label.u.html : undefined;
  if (placed === undefined) return null;
  const hit = portToTbl(placed, portname);
  if (hit === null) return null;
  sides.value = hit.sides;
  return hit.box;
}

// ---------------------------------------------------------------------------
// poly_port
// @see lib/common/shapes.c:poly_port (line 2880)
// ---------------------------------------------------------------------------

/**
 * portfn for all polygon shapes. @see lib/common/shapes.c:poly_port (line 2880)
 *
 * Empty portname → makePort() (byte-stability: unported edges must be unchanged).
 * Compass '' → '_' (C: `if (compass == NULL) compass = "_"`).
 * HTML branch: stub always null (T7). Non-HTML: portname IS the compass string.
 */
export function polyPort(n: Node, portname: string, compass: string): Port {
  if (portname.length === 0) return makePort(); // C: return Center
  const compassStr = compass.length === 0 ? '_' : compass; // C: NULL → "_"
  const sides = BOTTOM | RIGHT | TOP | LEFT;
  const rv = makePort();
  const label = n.info.label as { html?: boolean } | undefined;
  if (label?.html === true) {
    const sidesRef = { value: sides };
    const bp = htmlPort(n, portname, sidesRef);
    if (bp !== null) {
      compassPort(n, { bp, compass: compassStr, sides: sidesRef.value }, rv);
      rv.name = null; return rv;
    }
  }
  // ictxt=null always (AD2 — inside_t clipping path deferred)
  compassPort(n, { bp: null, compass: portname, sides }, rv);
  rv.name = null;
  return rv;
}
