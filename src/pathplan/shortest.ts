// SPDX-License-Identifier: EPL-2.0
/** @see lib/pathplan/shortest.c */

import type { Point, Poly } from './types.js';
import { ccw, isdiagonal, ISCCW, ISCW } from './triang.js';

const NO_TRI = -1;
const DQ_FRONT = 1;
const DQ_BACK = 2;

interface PNL { pp: Point; link: PNL | null; }
interface TEdge { pnl0: PNL; pnl1: PNL; rightIndex: number; }
interface Triangle { mark: number; e: [TEdge, TEdge, TEdge]; }
interface Deque { pnlps: PNL[]; pnlpn: number; fpnlpi: number; lpnlpi: number; apex: number; }

class ShortestHelper {
  static buildTri(a: PNL, b: PNL, c: PNL): Triangle {
    const mk = (p0: PNL, p1: PNL): TEdge => ({ pnl0: p0, pnl1: p1, rightIndex: NO_TRI });
    return { mark: 0, e: [mk(a, b), mk(b, c), mk(c, a)] };
  }

  static triInner(pnlps: PNL[], tris: Triangle[]): boolean {
    // C triangulate() is tail-recursive: `return triangulate(points, n-1)` after
    // storing one ear triangle (shortest.c). The recursion depth equals the
    // polygon vertex count, so a large routing polygon (a long edge spanning many
    // ranks) overflows V8's stack, which has no TCO. Faithful loop form per the
    // AD-3 recursion->iteration pattern: same ear per pass, same store order,
    // same return value.
    let pts = pnlps;
    while (pts.length > 3) {
      const n = pts.length;
      let cut = -1;
      for (let i = 0; i < n; i++) {
        const ip2 = (i + 2) % n;
        if (isdiagonal(i, ip2, k => pts[k].pp, n)) {
          tris.push(ShortestHelper.buildTri(pts[i], pts[(i+1)%n], pts[ip2]));
          cut = (i + 1) % n;
          break;
        }
      }
      if (cut === -1) return false; // C: prerror("triangulation failed"); return 0
      pts = pts.filter((_, j) => j !== cut);
    }
    tris.push(ShortestHelper.buildTri(pts[0], pts[1], pts[2]));
    return true;
  }

  static connectTri(i: number, j: number, tris: Triangle[]): void {
    const t1 = tris[i], t2 = tris[j];
    for (let ei = 0; ei < 3; ei++) {
      for (let ej = 0; ej < 3; ej++) {
        const e1 = t1.e[ei], e2 = t2.e[ej];
        if ((e1.pnl0 === e2.pnl0 && e1.pnl1 === e2.pnl1) ||
            (e1.pnl0 === e2.pnl1 && e1.pnl1 === e2.pnl0))
          e1.rightIndex = j, e2.rightIndex = i;
      }
    }
  }

  static connectAll(tris: Triangle[]): void {
    for (let i = 0; i < tris.length; i++)
      for (let j = i + 1; j < tris.length; j++)
        ShortestHelper.connectTri(i, j, tris);
  }

  static pointInTri(tri: Triangle, p: Point): boolean {
    let sum = 0;
    for (let ei = 0; ei < 3; ei++)
      if (ccw(tri.e[ei].pnl0.pp, tri.e[ei].pnl1.pp, p) !== ISCW) sum++;
    return sum === 3 || sum === 0;
  }

  static markPath(tris: Triangle[], trii: number, trij: number): boolean {
    if (tris[trii].mark) return false;
    tris[trii].mark = 1;
    if (trii === trij) return true;
    for (let ei = 0; ei < 3; ei++) {
      const ri = tris[trii].e[ei].rightIndex;
      if (ri !== NO_TRI && ShortestHelper.markPath(tris, ri, trij)) return true;
    }
    tris[trii].mark = 0;
    return false;
  }

  static findTri(tris: Triangle[], p: Point): number {
    for (let i = 0; i < tris.length; i++)
      if (ShortestHelper.pointInTri(tris[i], p)) return i;
    return NO_TRI;
  }

  static findMinX(ps: Point[]): number {
    let minx = Infinity, minpi = 0;
    for (let i = 0; i < ps.length; i++)
      if (ps[i].x < minx) { minx = ps[i].x; minpi = i; }
    return minpi;
  }

  static isPolyCW(ps: Point[], minpi: number): boolean {
    const pn = ps.length;
    const p2 = ps[minpi];
    const p1 = ps[minpi === 0 ? pn - 1 : minpi - 1];
    const p3 = ps[(minpi + 1) % pn];
    if (p1.x === p2.x && p2.x === p3.x && p3.y > p2.y) return true;
    return ccw(p1, p2, p3) !== ISCCW;
  }

  static loadForward(ps: Point[]): PNL[] {
    const r: PNL[] = [];
    for (let i = 0; i < ps.length; i++) {
      if (i > 0 && ps[i].x === ps[i-1].x && ps[i].y === ps[i-1].y) continue;
      r.push({ pp: ps[i], link: null });
    }
    return r;
  }

  static loadReverse(ps: Point[]): PNL[] {
    const r: PNL[] = [];
    for (let i = ps.length - 1; i >= 0; i--) {
      if (i < ps.length-1 && ps[i].x === ps[i+1].x && ps[i].y === ps[i+1].y) continue;
      r.push({ pp: ps[i], link: null });
    }
    return r;
  }

  static loadPoints(poly: Poly): PNL[] {
    const ps = poly.ps;
    return ShortestHelper.isPolyCW(ps, ShortestHelper.findMinX(ps))
      ? ShortestHelper.loadReverse(ps)
      : ShortestHelper.loadForward(ps);
  }

  static initDeque(pnll: number): Deque {
    const pnlpn = pnll * 2;
    const pnlps = new Array<PNL>(pnlpn).fill(null as unknown as PNL);
    const fpnlpi = Math.floor(pnlpn / 2);
    return { pnlps, pnlpn, fpnlpi, lpnlpi: fpnlpi - 1, apex: 0 };
  }

  static add2dq(dq: Deque, side: number, pnl: PNL): void {
    if (side === DQ_FRONT) {
      if (dq.lpnlpi >= dq.fpnlpi) pnl.link = dq.pnlps[dq.fpnlpi];
      dq.fpnlpi--;
      dq.pnlps[dq.fpnlpi] = pnl;
    } else {
      if (dq.lpnlpi >= dq.fpnlpi) pnl.link = dq.pnlps[dq.lpnlpi];
      dq.lpnlpi++;
      dq.pnlps[dq.lpnlpi] = pnl;
    }
  }

  static splitdq(dq: Deque, side: number, index: number): void {
    if (side === DQ_FRONT) dq.lpnlpi = index;
    else dq.fpnlpi = index;
  }

  static finddqsplit(dq: Deque, pnl: PNL): number {
    for (let idx = dq.fpnlpi; idx < dq.apex; idx++)
      if (ccw(dq.pnlps[idx+1].pp, dq.pnlps[idx].pp, pnl.pp) === ISCCW) return idx;
    for (let idx = dq.lpnlpi; idx > dq.apex; idx--)
      if (ccw(dq.pnlps[idx-1].pp, dq.pnlps[idx].pp, pnl.pp) === ISCW) return idx;
    return dq.apex;
  }

  static fuFindEi(trip: Triangle, tris: Triangle[]): number {
    for (let ei = 0; ei < 3; ei++) {
      const ri = trip.e[ei].rightIndex;
      if (ri !== NO_TRI && tris[ri].mark === 1) return ei;
    }
    return 3;
  }

  static fuNextTri(trip: Triangle, tris: Triangle[]): number {
    for (let ei = 0; ei < 3; ei++) {
      const ri = trip.e[ei].rightIndex;
      if (ri !== NO_TRI && tris[ri].mark === 1) return ri;
    }
    return NO_TRI;
  }

  static fuGetPairLast(epnl1: PNL, dq: Deque): [PNL, PNL] {
    if (ccw(epnl1.pp, dq.pnlps[dq.fpnlpi].pp, dq.pnlps[dq.lpnlpi].pp) === ISCCW)
      return [dq.pnlps[dq.lpnlpi], epnl1];
    return [epnl1, dq.pnlps[dq.lpnlpi]];
  }

  static fuGetPairNormal(trip: Triangle, ei: number): [PNL, PNL] {
    const e = trip.e[ei];
    const pnl = trip.e[(ei + 1) % 3].pnl1;
    if (ccw(e.pnl0.pp, pnl.pp, e.pnl1.pp) === ISCCW) return [e.pnl1, e.pnl0];
    return [e.pnl0, e.pnl1];
  }

  static fuUpdateRight(dq: Deque, r: PNL): void {
    const si = ShortestHelper.finddqsplit(dq, r);
    ShortestHelper.splitdq(dq, DQ_BACK, si);
    ShortestHelper.add2dq(dq, DQ_FRONT, r);
    if (si > dq.apex) dq.apex = si;
  }

  static fuUpdateLeft(dq: Deque, l: PNL): void {
    const si = ShortestHelper.finddqsplit(dq, l);
    ShortestHelper.splitdq(dq, DQ_FRONT, si);
    ShortestHelper.add2dq(dq, DQ_BACK, l);
    if (si < dq.apex) dq.apex = si;
  }

  static fuUpdate(dq: Deque, l: PNL, r: PNL, isFirst: boolean): void {
    if (isFirst) {
      ShortestHelper.add2dq(dq, DQ_BACK, l);
      ShortestHelper.add2dq(dq, DQ_FRONT, r);
      return;
    }
    if (dq.pnlps[dq.fpnlpi] !== r && dq.pnlps[dq.lpnlpi] !== r)
      ShortestHelper.fuUpdateRight(dq, r);
    else
      ShortestHelper.fuUpdateLeft(dq, l);
  }

  static fuLoop(tris: Triangle[], dq: Deque, epnls: [PNL, PNL], ftrii: number): void {
    let trii: number = ftrii;
    while (trii !== NO_TRI) {
      const trip = tris[trii]; trip.mark = 2;
      const ei = ShortestHelper.fuFindEi(trip, tris);
      const [l, r] = ei === 3
        ? ShortestHelper.fuGetPairLast(epnls[1], dq)
        : ShortestHelper.fuGetPairNormal(trip, ei);
      ShortestHelper.fuUpdate(dq, l, r, trii === ftrii);
      trii = ShortestHelper.fuNextTri(trip, tris);
    }
  }

  static extractPath(epnl1: PNL): Point[] {
    const pts: Point[] = [];
    for (let p: PNL | null = epnl1; p !== null; p = p.link) pts.push(p.pp);
    pts.reverse();
    return pts;
  }

  static run(poly: Poly, eps: [Point, Point]): Point[] | null {
    const pnlps = ShortestHelper.loadPoints(poly);
    const tris: Triangle[] = [];
    // C's triangulate() treats an ear-clip dead end as a WARNING and returns
    // success with the triangles loaded so far; Pshortestpath continues on the
    // partial triangulation (and typically ends in marktripath's straight-line
    // fallback below). Treating it as fatal loses edges C keeps (corpus 1435,
    // edge 8->10). @see lib/pathplan/shortest.c:333
    if (!ShortestHelper.triInner(pnlps.slice(), tris)) {
      console.warn('triangulation failed');
    }
    ShortestHelper.connectAll(tris);
    const ftrii = ShortestHelper.findTri(tris, eps[0]);
    const ltrii = ShortestHelper.findTri(tris, eps[1]);
    if (ftrii === NO_TRI || ltrii === NO_TRI) return null;
    if (ftrii === ltrii) return [eps[0], eps[1]];
    if (!ShortestHelper.markPath(tris, ftrii, ltrii)) return [eps[0], eps[1]];
    const epnls: [PNL, PNL] = [{ pp: eps[0], link: null }, { pp: eps[1], link: null }];
    const dq = ShortestHelper.initDeque(pnlps.length);
    ShortestHelper.add2dq(dq, DQ_FRONT, epnls[0]);
    dq.apex = dq.fpnlpi;
    ShortestHelper.fuLoop(tris, dq, epnls, ftrii);
    return ShortestHelper.extractPath(epnls[1]);
  }
}

/** @see lib/pathplan/shortest.c:Pshortestpath */
export function shortestPath(poly: Poly, eps: [Point, Point]): Point[] | null {
  return ShortestHelper.run(poly, eps);
}
