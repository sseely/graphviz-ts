// SPDX-License-Identifier: EPL-2.0

/**
 * Bezier subdivision and node-boundary clipping for edge spline routing.
 *
 * @see lib/common/utils.c:Bezier
 * @see lib/common/splines.c:bezier_clip
 * @see lib/common/splines.c:shape_clip0
 */

import type { Point } from '../../model/geom.js';

// ---------------------------------------------------------------------------
// De Casteljau subdivision
// @see lib/common/utils.c:Bezier
// ---------------------------------------------------------------------------

/**
 * Build the De Casteljau triangle for a cubic Bezier at parameter t.
 * v[i][j] = (1-t)*v[i-1][j] + t*v[i-1][j+1].
 * @see lib/common/utils.c:Bezier (triangle computation section)
 */
function deCasteljauTriangle(sp: Point[], t: number): Point[][] {
  const u = 1 - t;
  const v: Point[][] = [
    [sp[0], sp[1], sp[2], sp[3]],
    [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
    [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
    [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
  ];
  for (let i = 1; i <= 3; i++) {
    for (let j = 0; j <= 3 - i; j++) {
      v[i][j] = {
        x: u * v[i - 1][j].x + t * v[i - 1][j + 1].x,
        y: u * v[i - 1][j].y + t * v[i - 1][j + 1].y,
      };
    }
  }
  return v;
}

/**
 * De Casteljau subdivision of a cubic Bezier at parameter t.
 * Returns [left4, right4, midpoint].
 * @see lib/common/utils.c:Bezier
 */
export function bezierSubdivide(
  sp: Point[],
  t: number,
): [Point[], Point[], Point] {
  const v = deCasteljauTriangle(sp, t);
  const left: Point[] = [v[0][0], v[1][0], v[2][0], v[3][0]];
  const right: Point[] = [v[3][0], v[2][1], v[1][2], v[0][3]];
  return [left, right, v[3][0]];
}

// ---------------------------------------------------------------------------
// bezierClipNode
// @see lib/common/splines.c:bezier_clip
// @see lib/common/splines.c:shape_clip0
// ---------------------------------------------------------------------------

/** State carried through one bisection iteration. */
interface BisectState {
  low: number;
  high: number;
  best: Point[];
  found: boolean;
  pt: Point;
}

/** Perform one bisection step; returns updated state. */
function bisectStep(
  c: Point[],
  insideFn: (lx: number, ly: number) => boolean,
  leftInside: boolean,
  s: BisectState,
): BisectState {
  const t = (s.high + s.low) / 2;
  const [left, right, mid] = bezierSubdivide(c, t);
  if (insideFn(mid.x, mid.y)) {
    return leftInside
      ? { low: t, high: s.high, best: right, found: true, pt: mid }
      : { low: s.low, high: t, best: left, found: true, pt: mid };
  }
  return leftInside
    ? { ...s, high: t, pt: mid }
    : { ...s, low: t, pt: mid };
}

/**
 * Binary-search clip of a Bezier in node-local coords.
 * @see lib/common/splines.c:bezier_clip
 */
function bezierClipLocal(
  c: Point[],
  insideFn: (lx: number, ly: number) => boolean,
  leftInside: boolean,
): Point[] {
  let s: BisectState = {
    low: 0, high: 1, best: c.slice(), found: false,
    pt: leftInside ? c[0] : c[3],
  };
  let opt: Point;
  do {
    opt = s.pt;
    s = bisectStep(c, insideFn, leftInside, s);
  } while (Math.abs(opt.x - s.pt.x) > 0.5 || Math.abs(opt.y - s.pt.y) > 0.5);
  if (s.found) return s.best;
  const [left, right] = bezierSubdivide(c, (s.high + s.low) / 2);
  return leftInside ? right : left;
}

/**
 * Clip Bezier to node boundary using binary search.
 *
 * sp is in global coords. insideFn receives node-local coords (center
 * subtracted). leftInside=true: sp[0] is inside node (tail clip).
 * leftInside=false: sp[3] is inside node (head clip).
 *
 * @see lib/common/splines.c:bezier_clip
 * @see lib/common/splines.c:shape_clip0
 */
export function bezierClipNode(
  sp: Point[],
  cx: number,
  cy: number,
  insideFn: (lx: number, ly: number) => boolean,
  leftInside: boolean,
): Point[] {
  const c: Point[] = sp.map(p => ({ x: p.x - cx, y: p.y - cy }));
  return bezierClipLocal(c, insideFn, leftInside).map(p => ({
    x: p.x + cx,
    y: p.y + cy,
  }));
}

/**
 * Clip the path endpoint to the arrowhead BASE (not node boundary).
 *
 * Ports lib/common/arrows.c:arrowEndClip.
 * The path ends at arrowhead-BASE (arrowTip + elen toward tail), not at the
 * node boundary. The arrowTip (spl.ep) is the node-boundary clip result.
 *
 * Steps (matching C arrowEndClip):
 * 1. Reverse the last Bezier segment: sp[0]=arrowTip, sp[1..3]=reversed path
 * 2. inside = DIST(p, arrowTip) <= elen (arrowhead sphere)
 * 3. bezierClip with left_inside=true (sp[0]=arrowTip is "inside" the sphere)
 * 4. Un-reverse the clipped right subdivision → path ends at arrowhead BASE
 *
 * @see lib/common/arrows.c:arrowEndClip
 */
export function arrowEndClip(
  path4: Point[],
  arrowTip: Point,
  elen: number,
): Point[] {
  if (elen <= 0) return path4;
  // Reverse: sp[0]=tip (inside sphere), sp[1..3]=reversed last 3 path points
  const sp: Point[] = [arrowTip, path4[2]!, path4[1]!, path4[0]!];
  const insideSphere = (lx: number, ly: number): boolean =>
    Math.hypot(lx, ly) <= elen;
  // bezierClipLocal with sp in RELATIVE coords (tip=origin)
  const spRel: Point[] = sp.map(p => ({ x: p.x - arrowTip.x, y: p.y - arrowTip.y }));
  const clippedRel = bezierClipLocal(spRel, insideSphere, true);
  const clipped = clippedRel.map(p => ({ x: p.x + arrowTip.x, y: p.y + arrowTip.y }));
  // Un-reverse: the clipped right subdivision = [arrowBase, ..., arrowTip]
  // The path endpoint becomes arrowBase = clipped[0]
  return [path4[0]!, path4[1]!, path4[2]!, clipped[0]!];
}

/**
 * Default node pen width. @see lib/common/const.h:DEFAULT_NODEPENWIDTH
 */
export const DEFAULT_NODEPENWIDTH = 1.0;

/**
 * Returns a box-shape inside function for use with bezierClipNode.
 *
 * Matches C's poly_inside bounding-box test which uses the OUTLINE boundary
 * (node + penwidth/2) rather than the geometric boundary:
 *   box_URx = (lw + rw + penwidth) / 2
 *   box_URy = (ht + penwidth) / 2
 *
 * @see lib/common/shapes.c:poly_inside (box_URx/box_URy computation)
 */
export function makeBoxInsideFn(
  halfW: number,
  halfH: number,
  penwidth = DEFAULT_NODEPENWIDTH,
): (lx: number, ly: number) => boolean {
  const uw = halfW + penwidth / 2;
  const uh = halfH + penwidth / 2;
  return (lx: number, ly: number): boolean =>
    Math.abs(lx) <= uw && Math.abs(ly) <= uh;
}
