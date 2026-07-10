// SPDX-License-Identifier: EPL-2.0

/**
 * Delaunay triangulation — the GTS-backed delaunay_tri of the reference
 * binary, reimplemented with Bowyer–Watson insertion over a robust
 * incircle predicate.
 *
 * The C delaunay_tri builds a GTS surface (tri) and collects its edges via
 * gts_surface_foreach_edge; that traversal order is an allocation-address
 * artifact of GTS/glib and cannot be reproduced. The EDGE SET, however, is
 * the Delaunay triangulation itself (unique in general position), and every
 * consumer (call_tri → SparseMatrix → stress smoothing at loose tolerances)
 * depends on the set, not the order. We emit edges in sorted (i,j) order.
 *
 * Robustness: circo/twopi layouts place many nodes on a common circle, so
 * near-cocircular quads are the COMMON case, not the exception. The
 * incircle test uses Shewchuk's fast double-precision path with an error
 * bound, falling back to an exact BigInt determinant when inconclusive —
 * an inconsistent predicate corrupts the insertion cavity and yields a
 * non-planar "triangulation". Exact ties (det = 0) count as outside.
 *
 * Degenerate inputs follow the C behavior:
 *  - coincident points: GTS's gts_delaunay_add_vertex returns the existing
 *    vertex and tri() replaces the duplicate (gts_vertex_replace) — the
 *    duplicate index never appears in an edge. We map duplicates the same way.
 *  - all-collinear points: GTS yields no faces → 0 edges; delaunay_tri then
 *    chains the points sorted by x (or y for a vertical line).
 *
 * @see lib/neatogen/delaunay.c:delaunay_tri
 * @see lib/neatogen/delaunay.c:tri (enclosing triangle at scale 100)
 */

import { gvQsort } from '../../util/bsd-qsort.js';

// ---------------------------------------------------------------------------
// Robust incircle
// ---------------------------------------------------------------------------

/** (10 + 96·ε)·ε with ε = 2⁻⁵³ — Shewchuk's iccerrboundA. */
const ICCERRBOUND_A = (10 + 96 * 2 ** -53) * 2 ** -53;

/**
 * Smallest e ≤ 0 with v·2^(−e) integral (0 for integers/zero). Doubling a
 * finite double is exact, so the loop is exact and terminates at the ulp.
 */
function ulpExp(v: number): number {
  let m = v;
  let e = 0;
  while (!Number.isInteger(m)) {
    m *= 2;
    e--;
  }
  return e;
}

/** Exact integer image of `v` at scale 2^(−emin), emin ≤ ulpExp(v). */
function scaledBigInt(v: number, emin: number): bigint {
  let m = v;
  let e = 0;
  while (!Number.isInteger(m)) {
    m *= 2;
    e--;
  }
  return BigInt(m) << BigInt(e - emin);
}

/** Exact incircle sign via BigInt 4×4 determinant on scaled coordinates. */
function incircleExact(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): number {
  const vals = [ax, ay, bx, by, cx, cy, dx, dy];
  let emin = 0;
  for (const v of vals) emin = Math.min(emin, ulpExp(v));
  const [AX, AY, BX, BY, CX, CY, DX, DY] = vals.map((v) => scaledBigInt(v, emin));
  // translate by d (exact in integers)
  const adx = AX! - DX!; const ady = AY! - DY!;
  const bdx = BX! - DX!; const bdy = BY! - DY!;
  const cdx = CX! - DX!; const cdy = CY! - DY!;
  const alift = adx * adx + ady * ady;
  const blift = bdx * bdx + bdy * bdy;
  const clift = cdx * cdx + cdy * cdy;
  const det = alift * (bdx * cdy - cdx * bdy)
    - blift * (adx * cdy - cdx * ady)
    + clift * (adx * bdy - bdx * ady);
  return det > 0n ? 1 : det < 0n ? -1 : 0;
}

/**
 * Sign of the incircle determinant: > 0 iff d is strictly inside the
 * circumcircle of ccw triangle (a,b,c); the sign flips for cw triangles,
 * so callers pass an orientation factor.
 */
export function incircle(
  px: number[], py: number[], a: number, b: number, c: number, d: number,
): number {
  const adx = px[a]! - px[d]!; const ady = py[a]! - py[d]!;
  const bdx = px[b]! - px[d]!; const bdy = py[b]! - py[d]!;
  const cdx = px[c]! - px[d]!; const cdy = py[c]! - py[d]!;

  const bdxcdy = bdx * cdy; const cdxbdy = cdx * bdy;
  const alift = adx * adx + ady * ady;
  const cdxady = cdx * ady; const adxcdy = adx * cdy;
  const blift = bdx * bdx + bdy * bdy;
  const adxbdy = adx * bdy; const bdxady = bdx * ady;
  const clift = cdx * cdx + cdy * cdy;

  const det = alift * (bdxcdy - cdxbdy)
    + blift * (cdxady - adxcdy)
    + clift * (adxbdy - bdxady);

  const permanent = (Math.abs(bdxcdy) + Math.abs(cdxbdy)) * alift
    + (Math.abs(cdxady) + Math.abs(adxcdy)) * blift
    + (Math.abs(adxbdy) + Math.abs(bdxady)) * clift;
  const errbound = ICCERRBOUND_A * permanent;
  if (det > errbound || -det > errbound) return Math.sign(det);
  return incircleExact(px[a]!, py[a]!, px[b]!, py[b]!, px[c]!, py[c]!, px[d]!, py[d]!);
}

/** Robust orientation: > 0 for ccw (a,b,c). */
export function orient2d(px: number[], py: number[], a: number, b: number, c: number): number {
  const detleft = (px[a]! - px[c]!) * (py[b]! - py[c]!);
  const detright = (py[a]! - py[c]!) * (px[b]! - px[c]!);
  const det = detleft - detright;
  const detsum = Math.abs(detleft) + Math.abs(detright);
  const errbound = 3.3306690738754716e-16 * detsum; // Shewchuk ccwerrboundA
  if (det > errbound || -det > errbound) return Math.sign(det);
  // exact fallback via the incircle machinery's scaled integers
  const vals = [px[a]!, py[a]!, px[b]!, py[b]!, px[c]!, py[c]!];
  let emin = 0;
  for (const v of vals) emin = Math.min(emin, ulpExp(v));
  const [AX, AY, BX, BY, CX, CY] = vals.map((v) => scaledBigInt(v, emin));
  const d = (AX! - CX!) * (BY! - CY!) - (AY! - CY!) * (BX! - CX!);
  return d > 0n ? 1 : d < 0n ? -1 : 0;
}

// ---------------------------------------------------------------------------
// Bowyer–Watson
// ---------------------------------------------------------------------------

export interface Tri {
  a: number; b: number; c: number;
  /** +1 ccw / −1 cw — fixed at creation so incircle signs are comparable */
  orient: number;
}

export function makeTri(px: number[], py: number[], a: number, b: number, c: number): Tri {
  return { a, b, c, orient: orient2d(px, py, a, b, c) || 1 };
}

/** Insert point p, retriangulating the cavity of triangles whose
 * circumcircle strictly contains it. */
export function bwInsert(px: number[], py: number[], tris: Tri[], p: number): void {
  const edgeCount = new Map<number, [number, number, number]>();
  const live: Tri[] = [];
  for (const t of tris) {
    if (incircle(px, py, t.a, t.b, t.c, p) * t.orient > 0) {
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as const) {
        const key = u < v ? u * 0x100000 + v : v * 0x100000 + u;
        const cur = edgeCount.get(key);
        if (cur) cur[2]++;
        else edgeCount.set(key, [u, v, 1]);
      }
    } else {
      live.push(t);
    }
  }
  for (const [u, v, cnt] of edgeCount.values()) {
    if (cnt === 1 && orient2d(px, py, u, v, p) !== 0) {
      live.push(makeTri(px, py, u, v, p));
    }
  }
  tris.length = 0;
  tris.push(...live);
}

/** Bowyer–Watson over deduplicated point ids; null if no proper face. */
export function bowyerWatson(px: number[], py: number[], ids: number[]): Tri[] | null {
  // Enclosing triangle (GTS uses gts_triangle_enclosing at scale 100).
  let minX = Infinity; let maxX = -Infinity;
  let minY = Infinity; let maxY = -Infinity;
  for (const i of ids) {
    minX = Math.min(minX, px[i]!); maxX = Math.max(maxX, px[i]!);
    minY = Math.min(minY, py[i]!); maxY = Math.max(maxY, py[i]!);
  }
  const w = Math.max(maxX - minX, maxY - minY, 1);
  const s0 = px.length;
  px.push(minX - 100 * w, maxX + 100 * w, (minX + maxX) / 2);
  py.push(minY - 100 * w, minY - 100 * w, maxY + 100 * w);
  const tris: Tri[] = [makeTri(px, py, s0, s0 + 1, s0 + 2)];
  for (const i of ids) bwInsert(px, py, tris, i);
  const real = tris.filter((t) => t.a < s0 && t.b < s0 && t.c < s0);
  px.length = s0;
  py.length = s0;
  if (real.length === 0) return null; // all collinear (or < 3 distinct points)
  return real;
}

// ---------------------------------------------------------------------------
// delaunay_tri
// ---------------------------------------------------------------------------

/**
 * Compute the Delaunay edge list for n points. Returns pairs [i,j,...] in
 * sorted (i,j) order, or the sorted-chain fallback for collinear input.
 * @see lib/neatogen/delaunay.c:delaunay_tri
 */
export function delaunayTri(xv: number[], yv: number[], n: number): number[] {
  // Coincident points map to their first occurrence (GTS vertex_replace).
  const canon = new Map<string, number>();
  const ids: number[] = [];
  for (let i = 0; i < n; i++) {
    const key = `${xv[i]},${yv[i]}`;
    if (!canon.has(key)) {
      canon.set(key, i);
      ids.push(i);
    }
  }

  const px = xv.slice(0, n);
  const py = yv.slice(0, n);
  const tris = ids.length >= 3 ? bowyerWatson(px, py, ids) : null;

  if (tris === null) {
    // C: GTS produced no edges — chain all n points sorted by x
    // (by y when the first two share x). Duplicates participate too:
    // the C fallback sorts raw indices, not deduplicated vertices.
    const vs = Array.from({ length: n }, (_, i) => i);
    const keyArr = xv[0] === xv[1] ? yv : xv;
    gvQsort(vs, (a, b) => {
      const va = keyArr[a]!;
      const vb = keyArr[b]!;
      if (va < vb) return -1;
      if (va > vb) return 1;
      return 0;
    });
    const edges: number[] = [];
    for (let i = 1; i < n; i++) edges.push(vs[i - 1]!, vs[i]!);
    return edges;
  }

  const seen = new Set<number>();
  const pairs: [number, number][] = [];
  for (const t of tris) {
    for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as const) {
      const i = Math.min(u, v);
      const j = Math.max(u, v);
      const key = i * 0x100000 + j;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push([i, j]);
      }
    }
  }
  pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const edges: number[] = [];
  for (const [i, j] of pairs) edges.push(i, j);
  return edges;
}
