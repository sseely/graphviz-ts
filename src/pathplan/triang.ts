// SPDX-License-Identifier: EPL-2.0
/** @see lib/pathplan/triang.c */

import type { Point, Poly } from './types.js';

export const ISCCW = 1;
export const ISCW = 2;
export const ISON = 3;

class TriangHelper {
  static ccw(p1: Point, p2: Point, p3: Point): number {
    const d = (p1.y - p2.y) * (p3.x - p2.x) - (p3.y - p2.y) * (p1.x - p2.x);
    return d > 0 ? ISCW : (d < 0 ? ISCCW : ISON);
  }

  /** Is pc on segment [pa, pb]? */
  static between(pa: Point, pb: Point, pc: Point): boolean {
    if (TriangHelper.ccw(pa, pb, pc) !== ISON) return false;
    const pba = { x: pb.x - pa.x, y: pb.y - pa.y };
    const pca = { x: pc.x - pa.x, y: pc.y - pa.y };
    return pca.x * pba.x + pca.y * pba.y >= 0 &&
      pca.x * pca.x + pca.y * pca.y <= pba.x * pba.x + pba.y * pba.y;
  }

  static anyCollinear(pa: Point, pb: Point, pc: Point, pd: Point): boolean {
    const c = TriangHelper.ccw;
    return c(pa,pb,pc)===ISON || c(pa,pb,pd)===ISON ||
           c(pc,pd,pa)===ISON || c(pc,pd,pb)===ISON;
  }

  static collinearIntersects(pa: Point, pb: Point, pc: Point, pd: Point): boolean {
    const b = TriangHelper.between;
    return b(pa,pb,pc) || b(pa,pb,pd) || b(pc,pd,pa) || b(pc,pd,pb);
  }

  static crossIntersects(pa: Point, pb: Point, pc: Point, pd: Point): boolean {
    const c = TriangHelper.ccw;
    const c1 = c(pa,pb,pc)===ISCCW ? 1 : 0;
    const c2 = c(pa,pb,pd)===ISCCW ? 1 : 0;
    const c3 = c(pc,pd,pa)===ISCCW ? 1 : 0;
    const c4 = c(pc,pd,pb)===ISCCW ? 1 : 0;
    return (c1^c2) !== 0 && (c3^c4) !== 0;
  }

  static intersects(pa: Point, pb: Point, pc: Point, pd: Point): boolean {
    if (TriangHelper.anyCollinear(pa, pb, pc, pd))
      return TriangHelper.collinearIntersects(pa, pb, pc, pd);
    return TriangHelper.crossIntersects(pa, pb, pc, pd);
  }

  static isdiagNeighborhood(i: number, ip2: number, get: (n: number) => Point, pointn: number): boolean {
    const ip1 = (i + 1) % pointn;
    const im1 = (i + pointn - 1) % pointn;
    const c = TriangHelper.ccw;
    if (c(get(im1), get(i), get(ip1)) === ISCCW) {
      return c(get(i), get(ip2), get(im1)) === ISCCW &&
             c(get(ip2), get(i), get(ip1)) === ISCCW;
    }
    return c(get(i), get(ip2), get(ip1)) === ISCW;
  }

  static isdiagonal(i: number, ip2: number, get: (n: number) => Point, pointn: number): boolean {
    if (!TriangHelper.isdiagNeighborhood(i, ip2, get, pointn)) return false;
    for (let j = 0; j < pointn; j++) {
      const jp1 = (j + 1) % pointn;
      if (j !== i && jp1 !== i && j !== ip2 && jp1 !== ip2) {
        if (TriangHelper.intersects(get(i), get(ip2), get(j), get(jp1)))
          return false;
      }
    }
    return true;
  }

  static triangulateInner(pts: Point[], fn: (t: [Point,Point,Point]) => void): boolean {
    const n = pts.length;
    if (n > 3) {
      for (let i = 0; i < n; i++) {
        const ip2 = (i + 2) % n;
        if (TriangHelper.isdiagonal(i, ip2, k => pts[k], n)) {
          fn([pts[i], pts[(i+1)%n], pts[ip2]]);
          return TriangHelper.triangulateInner(pts.filter((_,idx) => idx !== (i+1)%n), fn);
        }
      }
      return false;
    }
    fn([pts[0], pts[1], pts[2]]);
    return true;
  }
}

export { TriangHelper };

/** @see lib/pathplan/triang.c:Ptriangulate */
export function triangulate(poly: Poly, fn: (t: [Point,Point,Point]) => void): number {
  if (!TriangHelper.triangulateInner(poly.ps.slice(), fn)) return 1;
  return 0;
}

/** @see lib/pathplan/triang.c:ccw */
export function ccw(p1: Point, p2: Point, p3: Point): number {
  return TriangHelper.ccw(p1, p2, p3);
}

/** @see lib/pathplan/tri.h:isdiagonal */
export function isdiagonal(i: number, ip2: number, get: (n: number) => Point, pointn: number): boolean {
  return TriangHelper.isdiagonal(i, ip2, get, pointn);
}
