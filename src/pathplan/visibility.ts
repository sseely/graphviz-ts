// SPDX-License-Identifier: EPL-2.0
/** @see lib/pathplan/visibility.c */

import type { Point, VConfig } from './types.js';

export const POLYID_NONE = -1111;
export const POLYID_UNKNOWN = -2222;

class VisHelper {
  static wind(a: Point, b: Point, c: Point): number {
    const w = (a.y - b.y) * (c.x - b.x) - (c.y - b.y) * (a.x - b.x);
    return w > 0.0001 ? 1 : (w < -0.0001 ? -1 : 0);
  }

  static dist2(a: Point, b: Point): number {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  static dist(a: Point, b: Point): number {
    return Math.sqrt(VisHelper.dist2(a, b));
  }

  static inBetween(a: Point, b: Point, c: Point): boolean {
    if (a.x !== b.x)
      return (a.x < c.x && c.x < b.x) || (b.x < c.x && c.x < a.x);
    return (a.y < c.y && c.y < b.y) || (b.y < c.y && c.y < a.y);
  }

  static intersect(a: Point, b: Point, c: Point, d: Point): boolean {
    const w = VisHelper.wind;
    const a_abc = w(a, b, c);
    if (a_abc === 0 && VisHelper.inBetween(a, b, c)) return true;
    const a_abd = w(a, b, d);
    if (a_abd === 0 && VisHelper.inBetween(a, b, d)) return true;
    const a_cda = w(c, d, a);
    const a_cdb = w(c, d, b);
    return a_abc * a_abd < 0 && a_cda * a_cdb < 0;
  }

  static inCone(a0: Point, a1: Point, a2: Point, b: Point): boolean {
    const m = VisHelper.wind(b, a0, a1);
    const p = VisHelper.wind(b, a1, a2);
    if (VisHelper.wind(a0, a1, a2) > 0) return m >= 0 && p >= 0;
    return m >= 0 || p >= 0;
  }

  static clear(pti: Point, ptj: Point, start: number, end: number, conf: VConfig): boolean {
    const pts = conf.P, nextPt = conf.next, V = conf.N;
    for (let k = 0; k < start; k++) {
      if (VisHelper.intersect(pti, ptj, pts[k], pts[nextPt[k]])) return false;
    }
    for (let k = end; k < V; k++) {
      if (VisHelper.intersect(pti, ptj, pts[k], pts[nextPt[k]])) return false;
    }
    return true;
  }

  static compVis(conf: VConfig): void {
    const V = conf.N, pts = conf.P, nextPt = conf.next, prevPt = conf.prev;
    const wadj = conf.vis;
    for (let i = 0; i < V; i++) {
      const previ = prevPt[i];
      const d = VisHelper.dist(pts[i], pts[previ]);
      wadj[i][previ] = d; wadj[previ][i] = d;
      const jstart = previ === i - 1 ? i - 2 : i - 1;
      for (let j = jstart; j >= 0; j--) {
        if (VisHelper.inCone(pts[prevPt[i]], pts[i], pts[nextPt[i]], pts[j]) &&
            VisHelper.inCone(pts[prevPt[j]], pts[j], pts[nextPt[j]], pts[i]) &&
            VisHelper.clear(pts[i], pts[j], V, V, conf)) {
          const dij = VisHelper.dist(pts[i], pts[j]);
          wadj[i][j] = dij; wadj[j][i] = dij;
        }
      }
    }
  }

  static allocVis(N: number): number[][] {
    const vis: number[][] = [];
    for (let i = 0; i < N; i++) vis.push(new Array<number>(N).fill(0));
    vis.push(null as unknown as number[]);
    vis.push(null as unknown as number[]);
    return vis;
  }

  static polyhit(conf: VConfig, p: Point): number {
    for (let i = 0; i < conf.Npoly; i++) {
      const s = conf.start[i], e = conf.start[i + 1];
      if (inPolyHelper(conf.P.slice(s, e), p)) return i;
    }
    return POLYID_NONE;
  }

  static ptVisRange(conf: VConfig, p: Point, start: number, end: number, vadj: number[]): void {
    const pts = conf.P, nextPt = conf.next, prevPt = conf.prev, V = conf.N;
    for (let k = 0; k < V; k++) {
      if (k >= start && k < end) { vadj[k] = 0; continue; }
      const pk = pts[k];
      if (VisHelper.inCone(pts[prevPt[k]], pk, pts[nextPt[k]], p) &&
          VisHelper.clear(p, pk, start, end, conf)) {
        vadj[k] = VisHelper.dist(p, pk);
      } else {
        vadj[k] = 0;
      }
    }
    vadj[V] = 0; vadj[V + 1] = 0;
  }

  static computeRanges(pp: number, qp: number, conf: VConfig): [number, number, number, number] {
    if (pp < 0) {
      if (qp < 0) return [0, 0, 0, 0];
      return [0, 0, conf.start[qp], conf.start[qp + 1]];
    }
    if (qp < 0) return [0, 0, conf.start[pp], conf.start[pp + 1]];
    if (pp <= qp)
      return [conf.start[pp], conf.start[pp+1], conf.start[qp], conf.start[qp+1]];
    return [conf.start[qp], conf.start[qp+1], conf.start[pp], conf.start[pp+1]];
  }
}

function inPolyHelper(ps: Point[], q: Point): boolean {
  const n = ps.length;
  for (let i = 0; i < n; i++) {
    const i1 = (i + n - 1) % n;
    if (VisHelper.wind(ps[i1], ps[i], q) === 1) return false;
  }
  return true;
}

export function wind(a: Point, b: Point, c: Point): number {
  return VisHelper.wind(a, b, c);
}

export function inPoly(ps: Point[], q: Point): boolean {
  return inPolyHelper(ps, q);
}

/** @see lib/pathplan/visibility.c:visibility */
export function visibility(conf: VConfig): void {
  conf.vis = VisHelper.allocVis(conf.N);
  VisHelper.compVis(conf);
}

/** @see lib/pathplan/visibility.c:ptVis */
export function ptVis(conf: VConfig, pp: number, p: Point): number[] {
  const V = conf.N;
  const vadj = new Array<number>(V + 2).fill(0);
  let start: number, end: number;
  if (pp === POLYID_UNKNOWN) pp = VisHelper.polyhit(conf, p);
  if (pp >= 0) {
    start = conf.start[pp]; end = conf.start[pp + 1];
  } else {
    start = V; end = V;
  }
  VisHelper.ptVisRange(conf, p, start, end, vadj);
  return vadj;
}

/** @see lib/pathplan/visibility.c:directVis */
export function directVis(p: Point, pp: number, q: Point, qp: number, conf: VConfig): boolean {
  const [s1, e1, s2, e2] = VisHelper.computeRanges(pp, qp, conf);
  const V = conf.N, pts = conf.P, nextPt = conf.next;
  for (let k = 0; k < s1; k++)
    if (VisHelper.intersect(p, q, pts[k], pts[nextPt[k]])) return false;
  for (let k = e1; k < s2; k++)
    if (VisHelper.intersect(p, q, pts[k], pts[nextPt[k]])) return false;
  for (let k = e2; k < V; k++)
    if (VisHelper.intersect(p, q, pts[k], pts[nextPt[k]])) return false;
  return true;
}
