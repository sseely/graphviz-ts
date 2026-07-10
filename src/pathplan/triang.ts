// SPDX-License-Identifier: EPL-2.0
/** @see lib/pathplan/triang.c */

import type { Point, Poly } from './types.js';

export const ISCCW = 1;
export const ISCW = 2;
export const ISON = 3;

// ---------------------------------------------------------------------------
// FMA-faithful ccw sign
//
// The oracle's triang.c:ccw is compiled by clang (arm64, default
// -ffp-contract=on) into `fnmul d0,(p1.x-p2.x),(p3.y-p2.y)` followed by
// `fmadd d0,(p1.y-p2.y),(p3.x-p2.x),d0` — i.e. the FIRST product is EXACT
// (fused) while the second is rounded:
//
//   d = exact((p1.y-p2.y)·(p3.x-p2.x)) − fl((p3.y-p2.y)·(p1.x-p2.x))
//
// This is not the C source's arithmetic: for a query point bit-equal to a
// segment endpoint the two products are identical, the source says d == 0
// (ISON), but the compiled binary returns the (negated) rounding error of
// the product — flipping ISON to ISCW/ISCCW. shortest.c's pointintri then
// rejects polygon-vertex endpoints ("destination point not in any
// triangle"), makeMultiSpline fails, and every circo/twopi 2-cycle falls
// back to plain routing. Matching the oracle therefore REQUIRES emulating
// the contraction, not the source. JS has no fma, so: plain double
// evaluation with a conservative error bound decides the easy cases (where
// plain and fused signs provably agree), and an exact Dekker-product +
// dyadic-BigInt path decides the near-zero ones.
// ---------------------------------------------------------------------------

const SPLIT = 134217729; // 2^27 + 1 (Dekker)

/** Exact residue of a*b given its rounded product P: a*b = P + err. */
function twoProductErr(a: number, b: number, P: number): number {
  const ac = SPLIT * a;
  const ahi = ac - (ac - a);
  const alo = a - ahi;
  const bc = SPLIT * b;
  const bhi = bc - (bc - b);
  const blo = b - bhi;
  return ((ahi * bhi - P) + ahi * blo + alo * bhi) + alo * blo;
}

/** Exact tail of P - D given its rounded difference s: P - D = s + tail. */
function twoDiffTail(P: number, D: number, s: number): number {
  const bvirt = P - s;
  const avirt = s + bvirt;
  const bround = bvirt - D;
  const around = P - avirt;
  return around + bround;
}

const dyadicView = new DataView(new ArrayBuffer(8));

/** Decompose a finite double into m·2^e with m a (sign-carrying) BigInt. */
function dyadic(x: number): { m: bigint; e: number } {
  if (x === 0) return { m: 0n, e: 0 };
  dyadicView.setFloat64(0, x);
  const hi = dyadicView.getUint32(0);
  const lo = dyadicView.getUint32(4);
  const sign = hi >>> 31 ? -1n : 1n;
  const biasedExp = (hi >>> 20) & 0x7ff;
  let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
  let e: number;
  if (biasedExp === 0) {
    e = -1074; // subnormal
  } else {
    mant |= 1n << 52n;
    e = biasedExp - 1075;
  }
  return { m: sign * mant, e };
}

/** Exact sign of a + b + c over arbitrary finite doubles. */
function signOfSum3(a: number, b: number, c: number): number {
  const da = dyadic(a);
  const db = dyadic(b);
  const dc = dyadic(c);
  const e = Math.min(da.e, db.e, dc.e);
  const sum = (da.m << BigInt(da.e - e)) + (db.m << BigInt(db.e - e)) +
    (dc.m << BigInt(dc.e - e));
  return sum > 0n ? 1 : (sum < 0n ? -1 : 0);
}

class TriangHelper {
  static ccw(p1: Point, p2: Point, p3: Point): number {
    const a = p1.y - p2.y;
    const b = p3.x - p2.x;
    const c = p3.y - p2.y;
    const e = p1.x - p2.x;
    const P = a * b;
    const D = c * e;
    const d = P - D;
    // Fast path: when |d| clearly exceeds the worst-case slack between the
    // plain and fused evaluations (product residue ≤ ulp(P)/2 plus the
    // subtraction's own rounding), both agree on the sign.
    const bound = 2.3e-16 * (Math.abs(P) + Math.abs(D));
    if (d > bound) return ISCW;
    if (d < -bound) return ISCCW;
    // Exact: sign of exact(a·b) − D = (P − D) + twoProductErr.
    const err = twoProductErr(a, b, P);
    const s = P - D;
    const tail = twoDiffTail(P, D, s);
    const sign = signOfSum3(s, tail, err);
    return sign > 0 ? ISCW : (sign < 0 ? ISCCW : ISON);
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
    // C Ptriangulate's helper is tail-recursive (recurses on the polygon with the
    // clipped ear removed). The recursion depth equals the vertex count, so a
    // large polygon overflows V8's stack (no TCO). Faithful loop form per the
    // AD-3 recursion->iteration pattern: same ear per pass, same emit order,
    // same return value. Mirrors shortest.ts:triInner.
    let cur = pts;
    while (cur.length > 3) {
      const n = cur.length;
      let cut = -1;
      for (let i = 0; i < n; i++) {
        const ip2 = (i + 2) % n;
        if (TriangHelper.isdiagonal(i, ip2, k => cur[k], n)) {
          fn([cur[i], cur[(i+1)%n], cur[ip2]]);
          cut = (i + 1) % n;
          break;
        }
      }
      if (cut === -1) return false;
      cur = cur.filter((_, idx) => idx !== cut);
    }
    fn([cur[0], cur[1], cur[2]]);
    return true;
  }
}

export { TriangHelper };

function signedArea(ps: Point[]): number {
  let sum = 0;
  for (let i = 0; i < ps.length; i++) {
    const j = (i + 1) % ps.length;
    sum += ps[i].x * ps[j].y - ps[j].x * ps[i].y;
  }
  return sum;
}

/** @see lib/pathplan/triang.c:Ptriangulate */
export function triangulate(poly: Poly, fn: (t: [Point,Point,Point]) => void): number {
  const ps = poly.ps.slice();
  if (signedArea(ps) > 0) ps.reverse();
  if (!TriangHelper.triangulateInner(ps, fn)) return 1;
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
