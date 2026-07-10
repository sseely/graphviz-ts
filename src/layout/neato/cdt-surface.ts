// SPDX-License-Identifier: EPL-2.0

/**
 * Constrained Delaunay surface — the GTS-backed mkSurface of the reference
 * binary, over the robust Bowyer–Watson core from delaunay.ts.
 *
 * mkSurface triangulates all points (routing bbox + obstacle vertices) with
 * the bbox and obstacle boundaries as DIRECTED constraint segments (bbox
 * CCW, obstacles CW), then removes "hole" faces: gts's triangle_is_hole
 * flags a face whose traversal runs a constraint edge OPPOSITE to its
 * stored direction — geometrically, the face to the RIGHT of the directed
 * constraint, i.e. outside the bbox or inside an obstacle. Faces strictly
 * inside an obstacle that touch no constraint survive, exactly as in GTS,
 * and end up isolated in the triangle graph (unreachable, harmless).
 *
 * Face numbering follows triangulation insertion order (GTS's numbering is
 * an allocation/hash artifact); consumers depend on the face SET and the
 * shared-edge adjacency, not the ids.
 *
 * @see lib/neatogen/delaunay.c:mkSurface
 * @see lib/neatogen/delaunay.c:triangle_is_hole / delaunay_remove_holes
 * @see lib/neatogen/delaunay.c:tri (constraint edges created up front)
 */

import type { Tri } from './delaunay.js';
import { incircle, orient2d, makeTri, bowyerWatson } from './delaunay.js';

/** Triangulated surface. @see lib/neatogen/delaunay.h:surface_t */
export interface Surface {
  nfaces: number;
  /** vertex indices of face i: faces[3i..3i+2] (CCW) */
  faces: number[];
  /** face indices sharing a side with face i (−1 padded): neigh[3i..3i+2] */
  neigh: number[];
}

const edgeKey = (u: number, v: number): number =>
  u < v ? u * 0x100000 + v : v * 0x100000 + u;

/** Constrained-Delaunay builder over a fixed point set. */
class Cdt {
  constructor(
    private readonly px: number[],
    private readonly py: number[],
    private readonly tris: Tri[],
  ) {}

  /** Does open segment (a,b) properly cross open segment (u,v)? */
  private segsCross(a: number, b: number, u: number, v: number): boolean {
    const { px, py } = this;
    const o1 = orient2d(px, py, a, b, u);
    const o2 = orient2d(px, py, a, b, v);
    const o3 = orient2d(px, py, u, v, a);
    const o4 = orient2d(px, py, u, v, b);
    return o1 * o2 < 0 && o3 * o4 < 0;
  }

  private hasEdge(a: number, b: number): boolean {
    const key = edgeKey(a, b);
    return this.tris.some((t) =>
      edgeKey(t.a, t.b) === key || edgeKey(t.b, t.c) === key ||
      edgeKey(t.c, t.a) === key);
  }

  /** v strictly between a and b along their common line. */
  private between(a: number, b: number, v: number): boolean {
    const { px, py } = this;
    const dx = px[b]! - px[a]!;
    const dy = py[b]! - py[a]!;
    const t = (px[v]! - px[a]!) * dx + (py[v]! - py[a]!) * dy;
    return t > 0 && t < dx * dx + dy * dy;
  }

  private crossedBy(a: number, b: number): Tri[] {
    return this.tris.filter((t) =>
      this.segsCross(a, b, t.a, t.b) || this.segsCross(a, b, t.b, t.c) ||
      this.segsCross(a, b, t.c, t.a));
  }

  /**
   * Retriangulate a pseudo-polygon chain (vertices strictly on one side of
   * a→b, ordered from a to b) against the base edge, Delaunay-optimally:
   * pick the chain vertex whose circumcircle with (a,b) contains the
   * others, emit (a,c,b), recurse (Anglada's CDT algorithm — the
   * triangulation GTS converges to via edge flips).
   */
  private fillPseudoPolygon(chain: number[], a: number, b: number): void {
    if (chain.length === 0) return;
    const { px, py } = this;
    let ci = 0;
    for (let i = 1; i < chain.length; i++) {
      const t = makeTri(px, py, a, chain[ci]!, b);
      if (incircle(px, py, t.a, t.b, t.c, chain[i]!) * t.orient > 0) ci = i;
    }
    const c = chain[ci]!;
    this.tris.push(makeTri(px, py, a, c, b));
    this.fillPseudoPolygon(chain.slice(0, ci), a, c);
    this.fillPseudoPolygon(chain.slice(ci + 1), c, b);
  }

  /**
   * Enforce constraint segment (a,b): remove crossed triangles, split the
   * cavity vertices by side, retriangulate both pseudo-polygons. A vertex
   * exactly ON the open segment splits the constraint recursively (GTS's
   * add_constraint handles on-edge vertices the same way).
   */
  insertConstraint(a: number, b: number): void {
    if (a === b || this.hasEdge(a, b)) return;
    const { px, py } = this;

    const crossed = this.crossedBy(a, b);
    for (const t of crossed) {
      for (const v of [t.a, t.b, t.c]) {
        if (v === a || v === b) continue;
        if (orient2d(px, py, a, b, v) === 0 && this.between(a, b, v)) {
          this.insertConstraint(a, v);
          this.insertConstraint(v, b);
          return;
        }
      }
    }

    const left: number[] = [];
    const right: number[] = [];
    const seen = new Set<number>([a, b]);
    for (const t of crossed) {
      for (const v of [t.a, t.b, t.c]) {
        if (seen.has(v)) continue;
        seen.add(v);
        const o = orient2d(px, py, a, b, v);
        if (o > 0) left.push(v);
        else if (o < 0) right.push(v);
      }
    }
    const along = (v: number): number =>
      (px[v]! - px[a]!) * (px[b]! - px[a]!) +
      (py[v]! - py[a]!) * (py[b]! - py[a]!);
    left.sort((u, v) => along(u) - along(v));
    right.sort((u, v) => along(u) - along(v));

    const crossedSet = new Set(crossed);
    const keep = this.tris.filter((t) => !crossedSet.has(t));
    this.tris.length = 0;
    this.tris.push(...keep);
    this.fillPseudoPolygon(left, a, b);
    this.fillPseudoPolygon(right.slice().reverse(), b, a);
  }

  /** Drop hole faces and emit CCW faces + shared-edge adjacency. */
  toSurface(segs: number[], nsegs: number): Surface {
    const dirCons = new Set<number>();
    for (let k = 0; k < nsegs; k++) {
      dirCons.add(segs[2 * k]! * 0x100000 + segs[2 * k + 1]!);
    }
    const kept: [number, number, number][] = [];
    for (const t of this.tris) {
      const [a, b, c] = t.orient >= 0 ? [t.a, t.b, t.c] : [t.a, t.c, t.b];
      const hole = dirCons.has(b * 0x100000 + a) ||
        dirCons.has(c * 0x100000 + b) || dirCons.has(a * 0x100000 + c);
      if (!hole) kept.push([a, b, c]);
    }

    const faces: number[] = [];
    const byEdge = new Map<number, number[]>();
    kept.forEach(([a, b, c], i) => {
      faces.push(a, b, c);
      for (const key of [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)]) {
        const lst = byEdge.get(key);
        if (lst) lst.push(i);
        else byEdge.set(key, [i]);
      }
    });
    const neigh: number[] = [];
    kept.forEach(([a, b, c], i) => {
      const ns: number[] = [];
      for (const key of [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)]) {
        for (const j of byEdge.get(key)!) {
          if (j !== i) ns.push(j);
        }
      }
      while (ns.length < 3) ns.push(-1);
      neigh.push(ns[0]!, ns[1]!, ns[2]!);
    });

    return { nfaces: kept.length, faces, neigh };
  }
}

/**
 * Build the constrained Delaunay surface over n points with nsegs directed
 * constraint segments (segs[2k], segs[2k+1]), removing hole faces.
 * Returns null when no proper triangulation exists.
 * @see lib/neatogen/delaunay.c:mkSurface
 */
export function mkSurface(
  x: number[], y: number[], n: number, segs: number[], nsegs: number,
): Surface | null {
  const px = x.slice(0, n);
  const py = y.slice(0, n);
  const ids = Array.from({ length: n }, (_, i) => i);
  const tris = bowyerWatson(px, py, ids);
  if (tris === null) return null;

  const cdt = new Cdt(px, py, tris);
  for (let k = 0; k < nsegs; k++) {
    cdt.insertConstraint(segs[2 * k]!, segs[2 * k + 1]!);
  }
  return cdt.toSurface(segs, nsegs);
}
