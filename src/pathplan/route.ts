// SPDX-License-Identifier: EPL-2.0
/** @see lib/pathplan/route.c, lib/pathplan/util.c */

import type { Point, Poly, Edge } from './types.js';
import { solve3 } from './solvers.js';

const EPSILON1 = 1e-3;
const EPSILON2 = 1e-6;

interface Tna { t: number; a: [Point, Point]; }
interface SplineEndpoints { p0: Point; v0: Point; p1: Point; v1: Point; }
interface LineCoeff { xc0: number; xc1: number; yc0: number; yc1: number; }
interface RootAccum { roots: number[]; n: number; }
interface RouteState { ops: Point[]; barriers: Edge[]; }

class RouteHelper {
  static B0(t: number): number { const u = 1-t; return u*u*u; }
  static B1(t: number): number { const u = 1-t; return 3*t*u*u; }
  static B2(t: number): number { const u = 1-t; return 3*t*t*u; }
  static B3(t: number): number { return t*t*t; }
  static B01(t: number): number { const u = 1-t; return u*u*(u+3*t); }
  static B23(t: number): number { const u = 1-t; return t*t*(3*u+t); }

  static normv(v: Point): Point {
    const d = v.x*v.x + v.y*v.y;
    if (d > 1e-6) { const s = Math.sqrt(d); return { x: v.x/s, y: v.y/s }; }
    return v;
  }
  static ptAdd(a: Point, b: Point): Point { return { x: a.x+b.x, y: a.y+b.y }; }
  static ptSub(a: Point, b: Point): Point { return { x: a.x-b.x, y: a.y-b.y }; }
  static ptScale(p: Point, c: number): Point { return { x: p.x*c, y: p.y*c }; }
  static ptDot(a: Point, b: Point): number { return a.x*b.x + a.y*b.y; }
  static ptDist(a: Point, b: Point): number { return Math.hypot(a.x-b.x, a.y-b.y); }
  static distN(pts: Point[]): number {
    let rv = 0;
    for (let i = 1; i < pts.length; i++) rv += RouteHelper.ptDist(pts[i], pts[i-1]);
    return rv;
  }

  static points2coeff(v0: number, v1: number, v2: number, v3: number, c: number[]): void {
    c[3] = v3 + 3*v1 - (v0 + 3*v2);
    c[2] = 3*v0 + 3*v2 - 6*v1;
    c[1] = 3*(v1 - v0);
    c[0] = v0;
  }

  static addRoot(root: number, acc: RootAccum): void {
    if (root >= 0 && root <= 1) { acc.roots[acc.n] = root; acc.n++; }
  }

  static silBothZero(sps: Point[], lc: LineCoeff, acc: RootAccum): number {
    const sc = [0,0,0,0], xr = [0,0,0], yr = [0,0,0];
    RouteHelper.points2coeff(sps[0].x, sps[1].x, sps[2].x, sps[3].x, sc);
    sc[0] -= lc.xc0;
    const xn = solve3(sc, xr);
    RouteHelper.points2coeff(sps[0].y, sps[1].y, sps[2].y, sps[3].y, sc);
    sc[0] -= lc.yc0;
    const yn = solve3(sc, yr);
    if (xn === 4) {
      if (yn === 4) return 4;
      for (let j = 0; j < yn; j++) RouteHelper.addRoot(yr[j], acc);
    } else if (yn === 4) {
      for (let i = 0; i < xn; i++) RouteHelper.addRoot(xr[i], acc);
    } else {
      for (let i = 0; i < xn; i++)
        for (let j = 0; j < yn; j++)
          if (xr[i] === yr[j]) RouteHelper.addRoot(xr[i], acc);
    }
    return acc.n;
  }

  static silXzeroYnonzero(sps: Point[], lc: LineCoeff, acc: RootAccum): number {
    const sc = [0,0,0,0], xr = [0,0,0];
    RouteHelper.points2coeff(sps[0].x, sps[1].x, sps[2].x, sps[3].x, sc);
    sc[0] -= lc.xc0;
    const xn = solve3(sc, xr);
    if (xn === 4) return 4;
    for (let i = 0; i < xn; i++) {
      const tv = xr[i];
      if (tv >= 0 && tv <= 1) {
        RouteHelper.points2coeff(sps[0].y, sps[1].y, sps[2].y, sps[3].y, sc);
        const sv = (sc[0] + tv*(sc[1] + tv*(sc[2] + tv*sc[3])) - lc.yc0) / lc.yc1;
        if (sv >= 0 && sv <= 1) RouteHelper.addRoot(tv, acc);
      }
    }
    return acc.n;
  }

  static silGeneral(sps: Point[], lc: LineCoeff, acc: RootAccum): number {
    const sc = [0,0,0,0], xr = [0,0,0];
    const rat = lc.yc1 / lc.xc1;
    RouteHelper.points2coeff(
      sps[0].y - rat*sps[0].x, sps[1].y - rat*sps[1].x,
      sps[2].y - rat*sps[2].x, sps[3].y - rat*sps[3].x, sc);
    sc[0] += rat*lc.xc0 - lc.yc0;
    const xn = solve3(sc, xr);
    if (xn === 4) return 4;
    for (let i = 0; i < xn; i++) {
      const tv = xr[i];
      if (tv >= 0 && tv <= 1) {
        RouteHelper.points2coeff(sps[0].x, sps[1].x, sps[2].x, sps[3].x, sc);
        const sv = (sc[0] + tv*(sc[1] + tv*(sc[2] + tv*sc[3])) - lc.xc0) / lc.xc1;
        if (sv >= 0 && sv <= 1) RouteHelper.addRoot(tv, acc);
      }
    }
    return acc.n;
  }

  static splineIntersectsLine(sps: Point[], lps: Point[], roots: number[]): number {
    const lc: LineCoeff = {
      xc0: lps[0].x, xc1: lps[1].x - lps[0].x,
      yc0: lps[0].y, yc1: lps[1].y - lps[0].y,
    };
    const acc: RootAccum = { roots, n: 0 };
    if (lc.xc1 === 0) {
      if (lc.yc1 === 0) return RouteHelper.silBothZero(sps, lc, acc);
      return RouteHelper.silXzeroYnonzero(sps, lc, acc);
    }
    return RouteHelper.silGeneral(sps, lc, acc);
  }

  static splineIsInside(barriers: Edge[], sps: Point[]): boolean {
    const roots = [0,0,0,0];
    for (let ei = 0; ei < barriers.length; ei++) {
      const lps = [barriers[ei].a, barriers[ei].b];
      const rootn = RouteHelper.splineIntersectsLine(sps, lps, roots);
      if (rootn === 4) continue;
      for (let ri = 0; ri < rootn; ri++) {
        const t = roots[ri];
        if (t < EPSILON2 || t > 1 - EPSILON2) continue;
        const ta = (1-t)*(1-t)*(1-t), tb = 3*t*(1-t)*(1-t), tc = 3*t*t*(1-t), td = t*t*t;
        const ix = ta*sps[0].x + tb*sps[1].x + tc*sps[2].x + td*sps[3].x;
        const iy = ta*sps[0].y + tb*sps[1].y + tc*sps[2].y + td*sps[3].y;
        if ((ix-lps[0].x)**2+(iy-lps[0].y)**2 < EPSILON1) continue;
        if ((ix-lps[1].x)**2+(iy-lps[1].y)**2 < EPSILON1) continue;
        return false;
      }
    }
    return true;
  }

  static appendSps(ops: Point[], sps: Point[]): void {
    for (let pi = 1; pi < 4; pi++) ops.push({ x: sps[pi].x, y: sps[pi].y });
  }

  static mkspline(inps: Point[], tnas: Tna[], ev0: Point, ev1: Point): SplineEndpoints {
    const n = inps.length;
    let scale0 = 0, scale3 = 0, c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
    for (let i = 0; i < n; i++) {
      c00 += RouteHelper.ptDot(tnas[i].a[0], tnas[i].a[0]);
      c01 += RouteHelper.ptDot(tnas[i].a[0], tnas[i].a[1]);
      c11 += RouteHelper.ptDot(tnas[i].a[1], tnas[i].a[1]);
      const tmp = RouteHelper.ptSub(inps[i], RouteHelper.ptAdd(
        RouteHelper.ptScale(inps[0], RouteHelper.B01(tnas[i].t)),
        RouteHelper.ptScale(inps[n-1], RouteHelper.B23(tnas[i].t))));
      x0 += RouteHelper.ptDot(tnas[i].a[0], tmp);
      x1 += RouteHelper.ptDot(tnas[i].a[1], tmp);
    }
    const det01 = c00*c11 - c01*c01;
    const detX1 = x0*c11 - x1*c01, det0X = c00*x1 - c01*x0;
    if (Math.abs(det01) >= 1e-6) { scale0 = detX1/det01; scale3 = det0X/det01; }
    if (Math.abs(det01) < 1e-6 || scale0 <= 0 || scale3 <= 0) {
      const d = RouteHelper.ptDist(inps[0], inps[n-1]) / 3;
      scale0 = d; scale3 = d;
    }
    return { p0: inps[0], v0: RouteHelper.ptScale(ev0, scale0), p1: inps[n-1], v1: RouteHelper.ptScale(ev1, scale3) };
  }

  static initTnas(inps: Point[], ev0: Point, ev1: Point): Tna[] {
    const n = inps.length;
    const tnas: Tna[] = Array.from({ length: n }, () => ({ t: 0, a: [{ x:0,y:0 }, { x:0,y:0 }] as [Point,Point] }));
    for (let i = 1; i < n; i++) tnas[i].t = tnas[i-1].t + RouteHelper.ptDist(inps[i], inps[i-1]);
    const total = tnas[n-1].t;
    for (let i = 1; i < n; i++) tnas[i].t /= total;
    for (let i = 0; i < n; i++) {
      tnas[i].a[0] = RouteHelper.ptScale(ev0, RouteHelper.B1(tnas[i].t));
      tnas[i].a[1] = RouteHelper.ptScale(ev1, RouteHelper.B2(tnas[i].t));
    }
    return tnas;
  }

  static findMaxDev(inps: Point[], tnas: Tna[], ends: SplineEndpoints): number {
    const { p0, v0, p1, v1 } = ends;
    const cp1 = RouteHelper.ptAdd(p0, RouteHelper.ptScale(v0, 1/3));
    const cp2 = RouteHelper.ptSub(p1, RouteHelper.ptScale(v1, 1/3));
    let maxi = -1, maxd = -1;
    for (let i = 1; i < inps.length - 1; i++) {
      const t = tnas[i].t;
      const px = RouteHelper.B0(t)*p0.x + RouteHelper.B1(t)*cp1.x + RouteHelper.B2(t)*cp2.x + RouteHelper.B3(t)*p1.x;
      const py = RouteHelper.B0(t)*p0.y + RouteHelper.B1(t)*cp1.y + RouteHelper.B2(t)*cp2.y + RouteHelper.B3(t)*p1.y;
      const d = RouteHelper.ptDist({ x: px, y: py }, inps[i]);
      // C `reallyroutespline` uses `if (d > maxd)` (strict): on equal deviations
      // the FIRST index wins. That tie-break is only translation-equivariant in
      // exact arithmetic — the absolute-coordinate bezier eval above carries
      // ~1e-14 cancellation noise whose sign depends on absolute position, which
      // flips a true geometric tie (e.g. #241_0 5:ne->8:nw). Absorb that noise so
      // a tie deterministically keeps the first index, matching C.
      // @see lib/pathplan/route.c:reallyroutespline (max-deviation split)
      if (d > maxd * (1 + 1e-10) + 1e-10) { maxd = d; maxi = i; }
    }
    return maxi;
  }

  static splineFits(state: RouteState, ends: SplineEndpoints, inps: Point[]): number {
    const { p0, v0, p1, v1 } = ends;
    const forceflag = inps.length === 2;
    let a = 4, first = true;
    for (;;) {
      const sps: Point[] = [
        p0,
        { x: p0.x + a*v0.x/3, y: p0.y + a*v0.y/3 },
        { x: p1.x - a*v1.x/3, y: p1.y - a*v1.y/3 },
        p1,
      ];
      if (first && RouteHelper.distN(sps) < RouteHelper.distN(inps) - EPSILON1) return 0;
      first = false;
      if (RouteHelper.splineIsInside(state.barriers, sps)) {
        RouteHelper.appendSps(state.ops, sps); return 1;
      }
      if (a < 0.005) {
        if (forceflag) { RouteHelper.appendSps(state.ops, sps); return 1; }
        break;
      }
      a = a > 0.01 ? a / 2 : 0;
    }
    return 0;
  }

  static reallyRoute(state: RouteState, inps: Point[], ev0: Point, ev1: Point): boolean {
    const tnas = RouteHelper.initTnas(inps, ev0, ev1);
    const ends = RouteHelper.mkspline(inps, tnas, ev0, ev1);
    if (RouteHelper.splineFits(state, ends, inps)) return true;
    const maxi = RouteHelper.findMaxDev(inps, tnas, ends);
    const sv1 = RouteHelper.normv(RouteHelper.ptSub(inps[maxi], inps[maxi - 1]));
    const sv2 = RouteHelper.normv(RouteHelper.ptSub(inps[maxi + 1], inps[maxi]));
    const splitv = RouteHelper.normv(RouteHelper.ptAdd(sv1, sv2));
    if (!RouteHelper.reallyRoute(state, inps.slice(0, maxi + 1), ev0, splitv)) return false;
    if (!RouteHelper.reallyRoute(state, inps.slice(maxi), splitv, ev1)) return false;
    return true;
  }

  static run(barriers: Edge[], route: Point[], slopes: [Point, Point]): Point[] {
    const state: RouteState = { ops: [], barriers };
    const ev0 = RouteHelper.normv(slopes[0]);
    const ev1 = RouteHelper.normv(slopes[1]);
    state.ops.push(route[0]);
    RouteHelper.reallyRoute(state, route, ev0, ev1);
    return state.ops;
  }
}

/** @see lib/pathplan/route.c:Proutespline */
export function routeSpline(barriers: Edge[], route: Point[], slopes: [Point, Point]): Point[] {
  return RouteHelper.run(barriers, route, slopes);
}

/** @see lib/pathplan/util.c:Ppolybarriers */
export function polyBarriers(polys: Poly[]): Edge[] {
  const out: Edge[] = [];
  for (const poly of polys) {
    const n = poly.ps.length;
    for (let j = 0; j < n; j++) out.push({ a: poly.ps[j], b: poly.ps[(j + 1) % n] });
  }
  return out;
}

/** @see lib/pathplan/util.c:make_polyline */
export function makePolyline(pts: Point[]): Point[] {
  const out: Point[] = [];
  out.push(pts[0], pts[0]);
  for (let i = 1; i + 1 < pts.length; i++) out.push(pts[i], pts[i], pts[i]);
  out.push(pts[pts.length - 1], pts[pts.length - 1]);
  return out;
}
