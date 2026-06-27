// SPDX-License-Identifier: EPL-2.0
//
// Elliptic-wedge bezier tessellation — faithful port of lib/common/ellipse.c.
//
// Returns a cubic-Bézier approximation of an elliptical wedge (an arc plus the
// two line segments to the ellipse center), as an ordered list of control
// points matching C's `Ppolyline_t.ps` / `pn`. Used by the ortho rounded-corner
// edge emit, which slices out just the arc portion and draws it as a polyline.
//
// Derived (via C) from Luc Maisonobe's Java EllipticalArc implementation.
//
// @see lib/common/ellipse.c:ellipticWedge / genEllipticPath / initEllipse

import type { Point } from '../model/geom.js';

const TWOPI = 2 * Math.PI;

interface Ellipse {
  cx: number; cy: number; // center
  a: number; b: number;   // semi-major and -minor axes
  eta1: number; eta2: number; // start/end angles of the arc
}

/** @see lib/common/ellipse.c:initEllipse */
function initEllipse(
  cx: number, cy: number, a: number, b: number, lambda1: number, lambda2: number,
): Ellipse {
  let eta1 = Math.atan2(Math.sin(lambda1) / b, Math.cos(lambda1) / a);
  let eta2 = Math.atan2(Math.sin(lambda2) / b, Math.cos(lambda2) / a);
  // make sure we have eta1 <= eta2 <= eta1 + 2*PI
  eta2 -= TWOPI * Math.floor((eta2 - eta1) / TWOPI);
  // the preceding correction fails if we have exactly eta2 - eta1 = 2*PI;
  // it reduces the interval to zero length
  if (lambda2 - lambda1 > Math.PI && eta2 - eta1 < Math.PI) {
    eta2 += TWOPI;
  }
  return { cx, cy, a, b, eta1, eta2 };
}

// coefficients for error estimation while using cubic Bézier curves for
// approximation. erray_t = [2][4][4]. @see lib/common/ellipse.c
const coeffs3Low: number[][][] = [
  [[3.85268, -21.229, -0.330434, 0.0127842],
   [-1.61486, 0.706564, 0.225945, 0.263682],
   [-0.910164, 0.388383, 0.00551445, 0.00671814],
   [-0.630184, 0.192402, 0.0098871, 0.0102527]],
  [[-0.162211, 9.94329, 0.13723, 0.0124084],
   [-0.253135, 0.00187735, 0.0230286, 0.01264],
   [-0.0695069, -0.0437594, 0.0120636, 0.0163087],
   [-0.0328856, -0.00926032, -0.00173573, 0.00527385]],
];
const coeffs3High: number[][][] = [
  [[0.0899116, -19.2349, -4.11711, 0.183362],
   [0.138148, -1.45804, 1.32044, 1.38474],
   [0.230903, -0.450262, 0.219963, 0.414038],
   [0.0590565, -0.101062, 0.0430592, 0.0204699]],
  [[0.0164649, 9.89394, 0.0919496, 0.00760802],
   [0.0191603, -0.0322058, 0.0134667, -0.0825018],
   [0.0156192, -0.017535, 0.00326508, -0.228157],
   [-0.0236752, 0.0405821, -0.0173086, 0.176187]],
];
// safety factor to convert the "best" error approximation into a "max bound"
const safety3 = [0.001, 4.98, 0.207, 0.0067];

/** Rational function: quadratic numerator over linear denominator.
 *  @see lib/common/ellipse.c:RationalFunction */
function rationalFunction(x: number, c: readonly number[]): number {
  return (x * (x * c[0] + c[1]) + c[2]) / (x + c[3]);
}

/** Upper bound of the Bézier-vs-ellipse approximation error for a sub-arc.
 *  @see lib/common/ellipse.c:estimateError */
function estimateError(ep: Ellipse, etaA: number, etaB: number): number {
  const eta = 0.5 * (etaA + etaB);
  const x = ep.b / ep.a;
  const dEta = etaB - etaA;
  const cos2 = Math.cos(2 * eta);
  const cos4 = Math.cos(4 * eta);
  const cos6 = Math.cos(6 * eta);
  const coeffs = x < 0.25 ? coeffs3Low : coeffs3High;

  const c0 = rationalFunction(x, coeffs[0][0]) +
    cos2 * rationalFunction(x, coeffs[0][1]) +
    cos4 * rationalFunction(x, coeffs[0][2]) +
    cos6 * rationalFunction(x, coeffs[0][3]);
  const c1 = rationalFunction(x, coeffs[1][0]) +
    cos2 * rationalFunction(x, coeffs[1][1]) +
    cos4 * rationalFunction(x, coeffs[1][2]) +
    cos6 * rationalFunction(x, coeffs[1][3]);

  return rationalFunction(x, safety3) * ep.a * Math.exp(c0 + c1 * dEta);
}

// Bézier path builder — moveTo/lineTo/curveTo/endPath append control points,
// matching the C bezier_path_t (a flat list of pointf). @see ellipse.c
function curveTo(
  path: Point[], x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
): void {
  path.push({ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 });
}
function lineTo(path: Point[], x: number, y: number): void {
  const cur = path[path.length - 1];
  curveTo(path, cur.x, cur.y, x, y, x, y);
}

/** Approximate an elliptical arc via degree-3 Béziers; path begins and ends
 *  with line segments to the ellipse center. @see lib/common/ellipse.c:genEllipticPath */
function genEllipticPath(ep: Ellipse): Point[] {
  const THRESHOLD = 0.00001; // quality of approximation

  // find the number of Bézier curves needed
  let found = false;
  let n = 1;
  while (!found && n < 1024) {
    const diffEta = (ep.eta2 - ep.eta1) / n;
    if (diffEta <= 0.5 * Math.PI) {
      let etaOne = ep.eta1;
      found = true;
      for (let i = 0; found && i < n; ++i) {
        const etaA = etaOne;
        etaOne += diffEta;
        found = estimateError(ep, etaA, etaOne) <= THRESHOLD;
      }
    }
    n = n << 1;
  }

  const dEta = (ep.eta2 - ep.eta1) / n;
  let etaB = ep.eta1;

  let cosEtaB = Math.cos(etaB);
  let sinEtaB = Math.sin(etaB);
  let aCosEtaB = ep.a * cosEtaB;
  let bSinEtaB = ep.b * sinEtaB;
  let aSinEtaB = ep.a * sinEtaB;
  let bCosEtaB = ep.b * cosEtaB;
  let xB = ep.cx + aCosEtaB;
  let yB = ep.cy + bSinEtaB;
  let xBDot = -aSinEtaB;
  let yBDot = bCosEtaB;

  const path: Point[] = [];
  // moveTo(center); lineTo(arc start)
  path.push({ x: ep.cx, y: ep.cy });
  lineTo(path, xB, yB);

  const t = Math.tan(0.5 * dEta);
  const alpha = Math.sin(dEta) * (Math.sqrt(4 + 3 * t * t) - 1) / 3;

  for (let i = 0; i < n; ++i) {
    const xA = xB;
    const yA = yB;
    const xADot = xBDot;
    const yADot = yBDot;

    etaB += dEta;
    cosEtaB = Math.cos(etaB);
    sinEtaB = Math.sin(etaB);
    aCosEtaB = ep.a * cosEtaB;
    bSinEtaB = ep.b * sinEtaB;
    aSinEtaB = ep.a * sinEtaB;
    bCosEtaB = ep.b * cosEtaB;
    xB = ep.cx + aCosEtaB;
    yB = ep.cy + bSinEtaB;
    xBDot = -aSinEtaB;
    yBDot = bCosEtaB;

    curveTo(path, xA + alpha * xADot, yA + alpha * yADot,
      xB - alpha * xBDot, yB - alpha * yBDot, xB, yB);
  }

  // endPath: lineTo back to the first point (the center)
  lineTo(path, path[0].x, path[0].y);
  return path;
}

/**
 * Return a cubic-Bézier control-point list for an elliptical wedge, center
 * `ctr`, x/y semi-axes `xsemi`/`ysemi`, start angle `angle0`, end angle
 * `angle1`. Includes the beginning and ending line segments to the center.
 * Point order and count match C's `Ppolyline_t.ps` / `pn`.
 * @see lib/common/ellipse.c:ellipticWedge
 */
export function ellipticWedge(
  ctr: Point, xsemi: number, ysemi: number, angle0: number, angle1: number,
): Point[] {
  const ell = initEllipse(ctr.x, ctr.y, xsemi, ysemi, angle0, angle1);
  return genEllipticPath(ell);
}
