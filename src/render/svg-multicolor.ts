// SPDX-License-Identifier: EPL-2.0

/**
 * Multicolor region fills: stripedBox and wedgedEllipse.
 *
 * Ports the REGION-fill functions from lib/common/emit.c and the
 * arc-to-Bézier machinery from lib/common/ellipse.c.  These are called
 * from poly-gencode (S1) for style=striped polygon nodes and style=wedged
 * ellipse nodes when fillcolor is a multi-segment color list.
 *
 * @see lib/common/emit.c:595  stripedBox
 * @see lib/common/emit.c:549  wedgedEllipse
 * @see lib/common/ellipse.c:274 ellipticWedge
 */

import type { Point } from '../model/geom.js';
import type { RenderJob } from '../gvc/job.js';
import type { RendererPlugin } from '../gvc/context.js';
import { parseSegs } from '../common/multicolor.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Thin-line pen width used for multicolor band/wedge outlines.
 * @see lib/common/emit.c:538 #define THIN_LINE 0.5
 */
export const THIN_LINE = 0.5;

// ---------------------------------------------------------------------------
// ellipticWedge — arc-to-Bézier approximation
// @see lib/common/ellipse.c:274
// ---------------------------------------------------------------------------

/** Rational function (x*(x*c[0]+c[1])+c[2]) / (x+c[3]). */
function rationalFunction(x: number, c: readonly number[]): number {
  return (x * (x * c[0]! + c[1]!) + c[2]!) / (x + c[3]!);
}

/** Error coefficients for b/a < 0.25. @see lib/common/ellipse.c:97 */
const COEFFS3LOW: readonly (readonly number[])[][] = [
  [
    [3.85268, -21.229, -0.330434, 0.0127842],
    [-1.61486, 0.706564, 0.225945, 0.263682],
    [-0.910164, 0.388383, 0.00551445, 0.00671814],
    [-0.630184, 0.192402, 0.0098871, 0.0102527],
  ],
  [
    [-0.162211, 9.94329, 0.13723, 0.0124084],
    [-0.253135, 0.00187735, 0.0230286, 0.01264],
    [-0.0695069, -0.0437594, 0.0120636, 0.0163087],
    [-0.0328856, -0.00926032, -0.00173573, 0.00527385],
  ],
];

/** Error coefficients for 0.25 <= b/a <= 1. @see lib/common/ellipse.c:110 */
const COEFFS3HIGH: readonly (readonly number[])[][] = [
  [
    [0.0899116, -19.2349, -4.11711, 0.183362],
    [0.138148, -1.45804, 1.32044, 1.38474],
    [0.230903, -0.450262, 0.219963, 0.414038],
    [0.0590565, -0.101062, 0.0430592, 0.0204699],
  ],
  [
    [0.0164649, 9.89394, 0.0919496, 0.00760802],
    [0.0191603, -0.0322058, 0.0134667, -0.0825018],
    [0.0156192, -0.017535, 0.00326508, -0.228157],
    [-0.0236752, 0.0405821, -0.0173086, 0.176187],
  ],
];

/** Safety factors for error bound. @see lib/common/ellipse.c:122 */
const SAFETY3 = [0.001, 4.98, 0.207, 0.0067] as const;

/** Estimate maximum Bézier approximation error for a sub-arc. */
function estimateError(
  a: number, b: number, etaA: number, etaB: number,
): number {
  const eta = 0.5 * (etaA + etaB);
  const x = b / a;
  const dEta = etaB - etaA;
  const cos2 = Math.cos(2 * eta);
  const cos4 = Math.cos(4 * eta);
  const cos6 = Math.cos(6 * eta);
  const c = x < 0.25 ? COEFFS3LOW : COEFFS3HIGH;
  const c0 = rationalFunction(x, c[0]![0]!) +
    cos2 * rationalFunction(x, c[0]![1]!) +
    cos4 * rationalFunction(x, c[0]![2]!) +
    cos6 * rationalFunction(x, c[0]![3]!);
  const c1 = rationalFunction(x, c[1]![0]!) +
    cos2 * rationalFunction(x, c[1]![1]!) +
    cos4 * rationalFunction(x, c[1]![2]!) +
    cos6 * rationalFunction(x, c[1]![3]!);
  return rationalFunction(x, SAFETY3) * a * Math.exp(c0 + c1 * dEta);
}

/** Scan n subdivisions; return true if all satisfy the error threshold. */
function allSubdivsBelowThreshold(
  a: number, b: number, eta1: number, n: number, dEta: number,
): boolean {
  let etaA = eta1;
  for (let i = 0; i < n; i++) {
    if (estimateError(a, b, etaA, etaA + dEta) > 0.00001) return false;
    etaA += dEta;
  }
  return true;
}

/**
 * Return the number of Bézier curves needed to approximate the arc.
 * @see lib/common/ellipse.c:genEllipticPath (subdivision loop)
 */
function numSubdivisions(
  a: number, b: number, eta1: number, eta2: number,
): number {
  let n = 1;
  while (n < 1024) {
    const dEta = (eta2 - eta1) / n;
    if (dEta <= 0.5 * Math.PI && allSubdivsBelowThreshold(a, b, eta1, n, dEta)) break;
    n <<= 1;
  }
  return n;
}

/** Ellipse geometry parameters. */
interface EllipseParams { cx: number; cy: number; xsemi: number; ysemi: number; }

/** Mutable arc tangent+position state for the genEllipticPath loop. */
interface ArcState { xB: number; yB: number; xBDot: number; yBDot: number; }

/**
 * Build the initial path prefix and return arc state.
 * @see lib/common/ellipse.c:220-233
 */
function initArcPath(pts: Point[], e: EllipseParams, eta1: number): ArcState {
  const cosE = Math.cos(eta1); const sinE = Math.sin(eta1);
  const xB = e.cx + e.xsemi * cosE; const yB = e.cy + e.ysemi * sinE;
  pts.push({ x: e.cx, y: e.cy }, { x: e.cx, y: e.cy },
    { x: xB, y: yB }, { x: xB, y: yB });
  return { xB, yB, xBDot: -e.xsemi * sinE, yBDot: e.ysemi * cosE };
}

/** Step parameters for one Bézier arc segment. */
interface StepParams { etaB: number; dEta: number; alpha: number; }

/**
 * Append one cubic Bézier step; advance arc state. Returns new etaB.
 * @see lib/common/ellipse.c:238-258
 */
function stepBezier(
  pts: Point[], state: ArcState, e: EllipseParams, sp: StepParams,
): number {
  const xA = state.xB; const yA = state.yB;
  const xADot = state.xBDot; const yADot = state.yBDot;
  const newEta = sp.etaB + sp.dEta;
  const cosE = Math.cos(newEta); const sinE = Math.sin(newEta);
  state.xB = e.cx + e.xsemi * cosE; state.yB = e.cy + e.ysemi * sinE;
  state.xBDot = -e.xsemi * sinE; state.yBDot = e.ysemi * cosE;
  pts.push({ x: xA + sp.alpha * xADot, y: yA + sp.alpha * yADot });
  pts.push({ x: state.xB - sp.alpha * state.xBDot, y: state.yB - sp.alpha * state.yBDot });
  pts.push({ x: state.xB, y: state.yB });
  return newEta;
}

/**
 * Return cubic Bézier path points approximating an elliptic wedge sector.
 * Coordinates are in graphviz y-UP space — caller negates y for SVG.
 *
 * @see lib/common/ellipse.c:195 genEllipticPath
 * @see lib/common/ellipse.c:274 ellipticWedge
 */
export function ellipticWedge(
  e: EllipseParams, angle0: number, angle1: number,
): Point[] {
  const TWOPI = 2 * Math.PI;
  const eta1 = Math.atan2(Math.sin(angle0) / e.ysemi, Math.cos(angle0) / e.xsemi);
  let eta2 = Math.atan2(Math.sin(angle1) / e.ysemi, Math.cos(angle1) / e.xsemi);
  eta2 -= TWOPI * Math.floor((eta2 - eta1) / TWOPI);
  if (angle1 - angle0 > Math.PI && eta2 - eta1 < Math.PI) eta2 += TWOPI;
  const n = numSubdivisions(e.xsemi, e.ysemi, eta1, eta2);
  const dEta = (eta2 - eta1) / n;
  const t = Math.tan(0.5 * dEta);
  const alpha = Math.sin(dEta) * (Math.sqrt(4 + 3 * t * t) - 1) / 3;
  const pts: Point[] = [];
  const state = initArcPath(pts, e, eta1);
  let sp: StepParams = { etaB: eta1, dEta, alpha };
  for (let i = 0; i < n; i++) sp = { ...sp, etaB: stepBezier(pts, state, e, sp) };
  pts.push({ x: state.xB, y: state.yB }, { x: e.cx, y: e.cy }, { x: e.cx, y: e.cy });
  return pts;
}

// ---------------------------------------------------------------------------
// Shared render context
// ---------------------------------------------------------------------------

/** Render job + plugin pair threaded through helpers. */
interface RenderCtx { job: RenderJob; renderer: RendererPlugin; }

// ---------------------------------------------------------------------------
// wedgedEllipse
// @see lib/common/emit.c:549
// ---------------------------------------------------------------------------

/** One wedge segment descriptor. */
interface WedgeSeg { angle0: number; t: number; isLast: boolean; color: string; }

/** Draw one wedge; return updated angle0. */
function drawWedge(seg: WedgeSeg, e: EllipseParams, ctx: RenderCtx): number {
  const TWOPI = 2 * Math.PI;
  const angle1 = seg.isLast ? TWOPI : seg.angle0 + TWOPI * seg.t;
  const obj = ctx.job.obj;
  if (obj !== null) obj.fillColor = { type: 'string', s: seg.color };
  const ptsUp = ellipticWedge(e, seg.angle0, angle1);
  ctx.renderer.bezier(ptsUp.map((p) => ({ x: p.x, y: -p.y })), true, ctx.job);
  return angle1;
}

/**
 * Fill an ellipse with multiple pie-wedge sectors, one per color segment.
 *
 * `pf` is a 2-point bounding-box array in SVG y-DOWN device coordinates.
 * Thin pen (THIN_LINE) for each wedge; caller draws boundary unfilled after.
 *
 * Returns 0 → ok; 1 or 2 → parse error.
 *
 * @see lib/common/emit.c:549 wedgedEllipse
 */
export function wedgedEllipse(
  job: RenderJob, pf: Point[], clrs: string, renderer: RendererPlugin,
): number {
  const { segs, error } = parseSegs(clrs);
  if (error === 1 || error === 2) return error;
  const ctrX = (pf[0]!.x + pf[1]!.x) / 2;
  const ctrY = (pf[0]!.y + pf[1]!.y) / 2;
  const e: EllipseParams = {
    cx: ctrX, cy: -ctrY,
    xsemi: pf[1]!.x - ctrX, ysemi: Math.abs(pf[1]!.y - ctrY),
  };
  const ctx: RenderCtx = { job, renderer };
  const obj = job.obj;
  const saved = obj !== null ? obj.penWidth : 1.0;
  if (obj !== null && saved > THIN_LINE) obj.penWidth = THIN_LINE;
  let angle0 = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    if (s.color === null) break;
    if (s.t > 0) {
      angle0 = drawWedge({ angle0, t: s.t, isLast: i + 1 === segs.length, color: s.color }, e, ctx);
    }
  }
  if (obj !== null && saved > THIN_LINE) obj.penWidth = saved;
  return error;
}

// ---------------------------------------------------------------------------
// stripedBox
// @see lib/common/emit.c:595
// ---------------------------------------------------------------------------

/** One stripe band descriptor. */
interface BandSeg { color: string; isLast: boolean; segWidth: number; lastx: number; }

/** Draw one stripe band; advance p[0].x and p[3].x in place. */
function drawBand(p: Point[], seg: BandSeg, ctx: RenderCtx): void {
  const obj = ctx.job.obj;
  if (obj !== null) obj.fillColor = { type: 'string', s: seg.color };
  p[1]!.x = p[2]!.x = seg.isLast ? seg.lastx : p[0]!.x + seg.segWidth;
  ctx.renderer.polygon([...p], true, ctx.job);
  p[0]!.x = p[3]!.x = p[1]!.x;
}

/**
 * Fill a rectangular box with vertical color stripes.
 *
 * `pts` is a 4-point array in SVG y-DOWN device coordinates.
 * `rotate` swaps corner order (true = vertical stripes, C default).
 * Thin pen; caller draws boundary polygon unfilled after.
 *
 * Returns 0 → ok; 1 or 2 → parse error.
 *
 * @see lib/common/emit.c:595 stripedBox
 */
export function stripedBox(
  job: RenderJob, pts: Point[], clrs: string,
  rotate: boolean, renderer: RendererPlugin,
): number {
  const { segs, error } = parseSegs(clrs);
  if (error === 1 || error === 2) return error;
  // @see lib/common/emit.c:605-615 rotate swap
  const p: Point[] = rotate
    ? [{ ...pts[2]! }, { ...pts[3]! }, { ...pts[0]! }, { ...pts[1]! }]
    : [{ ...pts[0]! }, { ...pts[1]! }, { ...pts[2]! }, { ...pts[3]! }];
  const lastx = p[1]!.x;
  const xdelta = p[1]!.x - p[0]!.x;
  p[1]!.x = p[2]!.x = p[0]!.x;
  const ctx: RenderCtx = { job, renderer };
  const obj = job.obj;
  const saved = obj !== null ? obj.penWidth : 1.0;
  if (obj !== null && saved > THIN_LINE) obj.penWidth = THIN_LINE;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    if (s.color === null) break;
    if (s.t > 0) {
      drawBand(p, { color: s.color, isLast: i + 1 === segs.length, segWidth: xdelta * s.t, lastx }, ctx);
    }
  }
  if (obj !== null && saved > THIN_LINE) obj.penWidth = saved;
  return error;
}
