// SPDX-License-Identifier: EPL-2.0

/**
 * Constrained Delaunay surface — a faithful port of the GTS 0.7.6 CDT core
 * (src/cdt.c) as driven by the reference binary's tri()/mkSurface
 * (lib/neatogen/delaunay.c).
 *
 * The algorithm is GTS's incremental insertion, NOT Bowyer–Watson: each
 * vertex is located (closest-face sample + orientation walk), its face is
 * 1→3 split, and the surrounding edges are recursively swapped while a
 * neighbor's apex lies STRICTLY inside the circumcircle (exact predicate).
 * Exactly-cocircular quads therefore keep the diagonal the insertion
 * history produced — the tie outcome downstream corridors depend on
 * (proven on 2168_1: BW picked the opposite diagonal of the symmetric
 * trapezoid, the router then succeeded where native's fails).
 *
 * Constraint edges are created UP FRONT (tri(), delaunay.c) and shared via
 * vertex connectivity, so insertion-time swaps already refuse to flip them.
 * Constraints not present after insertion are enforced with GTS's
 * remove_intersected_vertex/edge walk + triangulate_polygon refill.
 *
 * Hole faces are then removed: triangle_is_hole flags a face whose stored
 * ring runs a constraint edge OPPOSITE to the constraint's stored
 * direction (bbox is CCW, obstacles CW, so that is exactly "outside the
 * bbox or inside an obstacle"). Interior obstacle faces that touch no
 * constraint survive as isolated triangle-graph nodes, as in GTS.
 *
 * Face numbering follows face-creation order (GTS's numbering is an
 * allocation/hash artifact); consumers depend on the face SET and the
 * shared-edge adjacency, not the ids.
 *
 * @see gts-0.7.6/src/cdt.c (gts_delaunay_add_vertex, swap_if_in_circle,
 *      gts_delaunay_add_constraint, triangulate_polygon, point_locate)
 * @see lib/neatogen/delaunay.c:tri / mkSurface / delaunay_remove_holes
 */

import { incircle, orient2d } from './delaunay.js';

/** Triangulated surface. @see lib/neatogen/delaunay.h:surface_t */
export interface Surface {
  nfaces: number;
  /** vertex indices of face i: faces[3i..3i+2] (CCW) */
  faces: number[];
  /** face indices sharing a side with face i (−1 padded): neigh[3i..3i+2] */
  neigh: number[];
}

/** GtsEdge: shared segment between vertices, with incident triangles.
 * `constraint` mirrors GTS_IS_CONSTRAINT; a swapped edge is never removed
 * from connectivity (GTS keeps floating edges alive), only NEXT_CUT
 * destroys crossed non-constraint edges. */
interface CEdge {
  v1: number;
  v2: number;
  constraint: boolean;
  /** All live triangles using this edge (GTS e->triangles); faces removed
   * from the surface are destroyed AND detached unless kept as `ref`. */
  tris: CFace[];
}

/** GtsFace: an aligned ring — e[i] connects v[i] → v[(i+1)%3]. */
interface CFace {
  v: [number, number, number];
  e: [CEdge, CEdge, CEdge];
  inSurface: boolean;
}

const pairKey = (u: number, v: number): number =>
  u < v ? u * 0x100000 + v : v * 0x100000 + u;

class Cdt {
  /** live-edge connectivity: gts_vertices_are_connected */
  private readonly edges = new Map<number, CEdge>();
  /** surface faces in creation order (deterministic output order) */
  private readonly surface = new Set<CFace>();

  constructor(private readonly px: number[], private readonly py: number[]) {}

  private orient(a: number, b: number, c: number): number {
    return orient2d(this.px, this.py, a, b, c);
  }

  /** gts_point_in_circle(v4, v1, v2, v3) > 0 — strictly inside. */
  private inCircle(v1: number, v2: number, v3: number, v4: number): number {
    return incircle(this.px, this.py, v1, v2, v3, v4);
  }

  // -------------------------------------------------------------------
  // Edge / face plumbing (GTS object model)
  // -------------------------------------------------------------------

  connected(u: number, v: number): CEdge | undefined {
    return this.edges.get(pairKey(u, v));
  }

  /** gts_edge_new (reuse checked by callers via connected()). */
  newEdge(u: number, v: number, constraint = false): CEdge {
    const e: CEdge = { v1: u, v2: v, constraint, tris: [] };
    this.edges.set(pairKey(u, v), e);
    return e;
  }

  edgeOrNew(u: number, v: number): CEdge {
    return this.connected(u, v) ?? this.newEdge(u, v);
  }

  /** gts_object_destroy on an edge: drop from connectivity. */
  private destroyEdge(e: CEdge): void {
    const cur = this.edges.get(pairKey(e.v1, e.v2));
    if (cur === e) this.edges.delete(pairKey(e.v1, e.v2));
  }

  /** gts_vertex_replace: rewire `from`'s (pre-created constraint) edges to
   * `to`, rekeying connectivity. Only called before `from` has any faces. */
  rewireVertex(from: number, to: number, cons: CEdge[]): void {
    for (const c of cons) {
      if (c.v1 !== from && c.v2 !== from) continue;
      const oldKey = pairKey(c.v1, c.v2);
      if (this.edges.get(oldKey) === c) this.edges.delete(oldKey);
      if (c.v1 === from) c.v1 = to;
      if (c.v2 === from) c.v2 = to;
      if (c.v1 !== c.v2 && !this.edges.has(pairKey(c.v1, c.v2))) {
        this.edges.set(pairKey(c.v1, c.v2), c);
      }
    }
  }

  /** gts_face_new + gts_surface_add_face for an aligned ring. */
  addFace(v: [number, number, number], e: [CEdge, CEdge, CEdge]): CFace {
    const f: CFace = { v, e, inSurface: true };
    for (const ed of e) ed.tris.push(f);
    this.surface.add(f);
    return f;
  }

  /** gts_surface_remove_face: destroyed unless kept floating (ref). */
  private removeFace(f: CFace, keepFloating = false): void {
    this.surface.delete(f);
    f.inSurface = false;
    if (!keepFloating) this.detachFace(f);
  }

  /** face destruction — detach from its edges' triangle lists. */
  private detachFace(f: CFace): void {
    for (const ed of f.e) {
      const i = ed.tris.indexOf(f);
      if (i >= 0) ed.tris.splice(i, 1);
    }
  }

  /** neighbor(): the other surface face incident to e. */
  private neighbor(f: CFace, e: CEdge): CFace | null {
    for (const t of e.tris) {
      if (t !== f && t.inSurface) return t;
    }
    return null;
  }

  /** Rotate f's stored ring so that edge `e` (if given) comes first.
   * @see gts_triangle_vertices_edges */
  private ringFrom(f: CFace, e: CEdge | null): {
    v1: number; v2: number; v3: number; e1: CEdge; e2: CEdge; e3: CEdge;
  } {
    let i = 0;
    if (e !== null) {
      i = f.e.indexOf(e);
      if (i < 0) throw new Error('cdt: edge not in face');
    }
    const j = (i + 1) % 3;
    const k = (i + 2) % 3;
    return {
      v1: f.v[i]!, v2: f.v[j]!, v3: f.v[k]!,
      e1: f.e[i]!, e2: f.e[j]!, e3: f.e[k]!,
    };
  }

  // -------------------------------------------------------------------
  // Point location (cdt.c: closest_face, triangle_next_edge, point_locate)
  // -------------------------------------------------------------------

  /** closest_face: sample ~n^(1/3) faces, keep the closest positively
   * oriented one. C iterates the face hash (allocation order); we iterate
   * creation order — the subsequent walk lands on the geometrically
   * containing face either way. */
  private closestFace(x: number, y: number): CFace | null {
    const nt = this.surface.size;
    if (nt === 0) return null;
    let stop = Math.floor(Math.exp(Math.log(nt) / 3));
    let dmin = Infinity;
    let closest: CFace | null = null;
    for (const f of this.surface) {
      if (this.orient(f.v[0], f.v[1], f.v[2]) > 0) {
        const p1 = f.e[0].v1;
        const d = (x - this.px[p1]!) ** 2 + (y - this.py[p1]!) ** 2;
        if (d < dmin) { dmin = d; closest = f; }
      }
      stop--;
      if (stop <= 0) break;
    }
    return closest;
  }

  /** orientation of raw coords against vertex ids (o is a moving point). */
  private orientPt(ox: number, oy: number, b: number, cx: number, cy: number): number {
    // mirror gts_point_orientation(o, v, p) with o and p raw points
    const pxArr = this.px; const pyArr = this.py;
    pxArr.push(ox, cx); pyArr.push(oy, cy);
    const r = orient2d(pxArr, pyArr, pxArr.length - 2, b, pxArr.length - 1);
    pxArr.length -= 2; pyArr.length -= 2;
    return r;
  }

  /** triangle_next_edge: edge of f crossed by segment o→p, or null with
   * onSummit set. @see cdt.c:triangle_next_edge */
  private triangleNextEdge(
    f: CFace, ox: number, oy: number, x: number, y: number,
  ): { edge: CEdge | null; onSummit: boolean } {
    const { v1, v2, v3, e1, e2, e3 } = this.ringFrom(f, null);
    let orient = this.orientPt(ox, oy, v1, x, y);
    if (orient > 0) {
      orient = this.orientPt(ox, oy, v2, x, y);
      if (orient > 0) {
        if (this.orientToward(v2, v3, x, y) >= 0) return { edge: null, onSummit: false };
        return { edge: e2, onSummit: false };
      }
      if (orient < 0) {
        if (this.orientToward(v1, v2, x, y) >= 0) return { edge: null, onSummit: false };
        return { edge: e1, onSummit: false };
      }
      return { edge: null, onSummit: this.orientToward(v1, v2, x, y) < 0 };
    }
    if (orient < 0) {
      orient = this.orientPt(ox, oy, v3, x, y);
      if (orient > 0) {
        if (this.orientToward(v3, v1, x, y) >= 0) return { edge: null, onSummit: false };
        return { edge: e3, onSummit: false };
      }
      if (orient < 0) {
        if (this.orientToward(v2, v3, x, y) >= 0) return { edge: null, onSummit: false };
        return { edge: e2, onSummit: false };
      }
      return { edge: null, onSummit: this.orientToward(v3, v1, x, y) < 0 };
    }
    if (this.orientToward(v2, v3, x, y) < 0) return { edge: e2, onSummit: false };
    return { edge: null, onSummit: this.orientToward(v1, v2, x, y) < 0 };
  }

  /** gts_point_orientation(va, vb, p) with p a raw point. */
  private orientToward(a: number, b: number, x: number, y: number): number {
    const pxArr = this.px; const pyArr = this.py;
    pxArr.push(x); pyArr.push(y);
    const r = orient2d(pxArr, pyArr, a, b, pxArr.length - 1);
    pxArr.length -= 1; pyArr.length -= 1;
    return r;
  }

  private barycenter(f: CFace): [number, number] {
    return [
      (this.px[f.v[0]]! + this.px[f.v[1]]! + this.px[f.v[2]]!) / 3,
      (this.py[f.v[0]]! + this.py[f.v[1]]! + this.py[f.v[2]]!) / 3,
    ];
  }

  /** point_locate walk from face f (origin o) toward (x,y).
   * @see cdt.c:point_locate */
  private pointLocateWalk(
    ox: number, oy: number, x: number, y: number, f0: CFace,
  ): CFace | null {
    const first = this.triangleNextEdge(f0, ox, oy, x, y);
    if (first.edge === null) {
      if (!first.onSummit) return f0; // p is inside f
      // restarts from a neighbor of f
      for (const e of f0.e) {
        const f1 = this.neighbor(f0, e);
        if (f1 !== null) {
          const [bx, by] = this.barycenter(f1);
          return this.pointLocateWalk(bx, by, x, y, f1);
        }
      }
      return null;
    }

    let prev: CEdge = first.edge;
    let f = this.neighbor(f0, prev);
    let v1 = 0; let v2 = 0; let v3 = 0;
    let e2: CEdge | null = null; let e3: CEdge | null = null;
    if (f !== null) {
      const r = this.ringFrom(f, prev);
      v1 = r.v1; v2 = r.v2; v3 = r.v3; prev = r.e1; e2 = r.e2; e3 = r.e3;
    }
    while (f !== null) {
      const orient = this.orientPt(ox, oy, v3, x, y);
      if (orient < 0) {
        if (this.orientToward(v2, v3, x, y) >= 0) return f;
        f = this.neighbor(f, e2!);
        prev = e2!;
        v1 = v3;
      } else if (orient > 0) {
        if (this.orientToward(v3, v1, x, y) >= 0) return f;
        f = this.neighbor(f, e3!);
        prev = e3!;
        v2 = v3;
      } else {
        if (this.orientToward(v2, v3, x, y) >= 0) return f;
        // segment intersects f exactly on v3: restart from a neighbor
        for (const e of [e2!, e3!]) {
          const f1 = this.neighbor(f, e);
          if (f1 !== null) {
            const [bx, by] = this.barycenter(f1);
            return this.pointLocateWalk(bx, by, x, y, f1);
          }
        }
        return null;
      }
      if (f !== null) {
        const i = f.e.indexOf(prev);
        const eN2 = f.e[(i + 1) % 3]!;
        const eN3 = f.e[(i + 2) % 3]!;
        e2 = eN2; e3 = eN3;
        v3 = eN2.v1 === v1 || eN2.v1 === v2 ? eN2.v2 : eN2.v1;
      }
    }
    return null;
  }

  /** gts_point_locate (guess=NULL): closest_face + barycenter walk. */
  private pointLocate(x: number, y: number): CFace | null {
    const guess = this.closestFace(x, y);
    if (guess === null) return null;
    const [bx, by] = this.barycenter(guess);
    return this.pointLocateWalk(bx, by, x, y, guess);
  }

  // -------------------------------------------------------------------
  // Delaunay insertion (cdt.c: swap_if_in_circle, add_vertex_to_face)
  // -------------------------------------------------------------------

  /** @see cdt.c:swap_if_in_circle (cf. figure misc/swap.fig) */
  private swapIfInCircle(
    f1: CFace, v1: number, v2: number, v3: number,
    e1: CEdge, e2: CEdge, e3: CEdge,
  ): void {
    if (e1.constraint) return; // e1 is a constraint, cannot swap

    const f2 = this.neighbor(f1, e1);
    if (f2 === null) return; // e1 is a boundary

    // f2's ring from e1: e4 follows e1, e5 follows e4
    const i = f2.e.indexOf(e1);
    const e4 = f2.e[(i + 1) % 3]!;
    const e5 = f2.e[(i + 2) % 3]!;
    const v4 = e4.v1 === e1.v1 || e4.v1 === e1.v2 ? e4.v2 : e4.v1;

    if (this.inCircle(v1, v2, v3, v4) > 0) {
      const en = this.edgeOrNew(v3, v4);
      // f3 ring: (v4, v2, v3) with edges (e5, e2, en); e5 = v4–v2
      // f4 ring: (v1, v4, v3) with edges (e4, en, e3); e4 = v1–v4
      // (rings derived from C's gts_face_new(en,e5,e2)/(en,e3,e4) cycles,
      //  matching the vertex triples C passes to the recursive calls)
      this.removeFace(f1);
      this.removeFace(f2);
      const f3 = this.addFace([v4, v2, v3], [e5, e2, en]);
      const f4 = this.addFace([v1, v4, v3], [e4, en, e3]);

      this.swapIfInCircle(f3, v4, v2, v3, e5, e2, en);
      this.swapIfInCircle(f4, v1, v4, v3, e4, en, e3);
    }
  }

  /** gts_delaunay_add_vertex_to_face. Returns the id of an existing
   * vertex with identical coordinates, or null when v was added. */
  private addVertexToFace(v: number, f: CFace): number | null {
    const { v1, v2, v3, e1, e2, e3 } = this.ringFrom(f, null);
    if (v === v1 || v === v2 || v === v3) return null; // already present
    const { px, py } = this;
    if (px[v] === px[v1] && py[v] === py[v1]) return v1;
    if (px[v] === px[v2] && py[v] === py[v2]) return v2;
    if (px[v] === px[v3] && py[v] === py[v3]) return v3;

    const e4 = this.edgeOrNew(v, v1);
    const e5 = this.edgeOrNew(v, v2);
    const e6 = this.edgeOrNew(v, v3);

    this.removeFace(f);
    // nf[0]=(e4,e1,e5) ring (v,v1,v2); nf[1]=(e5,e2,e6) ring (v,v2,v3);
    // nf[2]=(e6,e3,e4) ring (v,v3,v1)
    const nf0 = this.addFace([v, v1, v2], [e4, e1, e5]);
    const nf1 = this.addFace([v, v2, v3], [e5, e2, e6]);
    const nf2 = this.addFace([v, v3, v1], [e6, e3, e4]);

    this.swapIfInCircle(nf0, v1, v2, v, e1, e5, e4);
    this.swapIfInCircle(nf1, v2, v3, v, e2, e6, e5);
    this.swapIfInCircle(nf2, v3, v1, v, e3, e4, e6);
    return null;
  }

  /** gts_delaunay_add_vertex. Returns null on success, the duplicate
   * vertex id for coincident points, or throws if outside the hull. */
  addVertex(v: number): number | null {
    const f = this.pointLocate(this.px[v]!, this.py[v]!);
    if (f === null) throw new Error('cdt: vertex outside triangulation hull');
    return this.addVertexToFace(v, f);
  }

  // -------------------------------------------------------------------
  // Constraint insertion (cdt.c: gts_delaunay_add_constraint et al.)
  // -------------------------------------------------------------------

  /** polygon_in_circle: any polygon vertex strictly inside circle(p1,p2,p3). */
  private polygonInCircle(poly: CEdge[], p1: number, p2: number, p3: number): boolean {
    let v1 = -1; let v2 = -1;
    for (const s of poly) {
      for (const v of [s.v1, s.v2]) {
        if (v !== v1 && v !== v2 && v !== p1 && v !== p2 && v !== p3 &&
            this.inCircle(p1, p2, p3, v) > 0) {
          return true;
        }
      }
      v1 = s.v1; v2 = s.v2;
    }
    return false;
  }

  /** @see cdt.c:triangulate_polygon */
  private triangulatePolygon(poly: CEdge[]): void {
    if (poly.length < 2) return;

    const s = poly[0]!;
    const s1 = poly[1]!;
    let v1: number; let v2: number;
    if (s.v1 === s1.v1 || s.v1 === s1.v2) {
      v1 = s.v2; v2 = s.v1;
    } else {
      v1 = s.v1; v2 = s.v2;
    }

    let idx = 1;
    let v3 = v2;
    let found = false;
    while (idx < poly.length && !found) {
      const si = poly[idx]!;
      v3 = si.v1 === v3 ? si.v2 : si.v1;
      if (v3 !== v1 &&
          this.orient(v1, v2, v3) >= 0 &&
          !this.polygonInCircle(poly, v1, v2, v3)) {
        found = true;
      } else {
        idx++;
      }
    }
    if (!found) return;

    const e1 = this.edgeOrNew(v2, v3);
    const e2 = this.edgeOrNew(v3, v1);
    // f = (s, e1, e2) ring (v1, v2, v3)
    this.addFace([v1, v2, v3], [s, e1, e2]);

    // C: poly1 = poly[1..idx] with the tail after idx replaced by [e1]
    // (empty when e1 IS poly[idx]); poly2 = [e2] + poly[idx+1..] (e2 not
    // duplicated when it already heads the rest).
    const poly1: CEdge[] = [];
    for (let k = 1; k <= idx; k++) poly1.push(poly[k]!);
    if (e1 !== poly[idx]) poly1.push(e1);

    const rest = poly.slice(idx + 1);
    const poly2 = rest.length > 0 && e2 !== rest[0] ? [e2, ...rest] : rest;

    this.triangulatePolygon(poly1);
    this.triangulatePolygon(poly2);
  }

  /** remove_triangles(e): drop e's surface faces (destroying them). */
  private removeTriangles(e: CEdge): void {
    for (const t of [...e.tris]) {
      if (t.inSurface) this.removeFace(t);
    }
  }

  /** @see cdt.c:remove_intersected_edge (incl. the NEXT_CUT macro) */
  private removeIntersectedEdge(
    sv1: number, sv2: number, e: CEdge, f: CFace,
    left: CEdge[], right: CEdge[],
  ): void {
    if (e.constraint) throw new Error('cdt: constraint edges cross');

    const r = this.ringFrom(f, e);
    const v1 = r.v1; const v2 = r.v2; const v3 = r.v3;
    const e1 = r.e2; const e2 = r.e3; // C shadows: e←r.e1, e1←r.e2, e2←r.e3
    const cut = (edge: CEdge, edge1: CEdge, list: CEdge[]): void => {
      const next = this.neighbor(f, edge);
      this.removeTriangles(e);
      if (e.tris.length === 0) this.destroyEdge(e);
      if (next === null) throw new Error('cdt: constraint walk left the surface');
      list.push(edge1);
      this.removeIntersectedEdge(sv1, sv2, edge, next, left, right);
    };

    const o1 = this.orient(v2, v3, sv2);
    const o2 = this.orient(v3, v1, sv2);
    if (o1 === 0) {
      // terminal: s.v2 is v3
      this.removeTriangles(e);
      if (e.tris.length === 0) this.destroyEdge(e);
      left.push(e2);
      right.push(e1);
    } else if (o1 > 0) {
      cut(e2, e1, right);
    } else if (o2 >= 0) {
      cut(e1, e2, left);
    } else {
      const o3 = this.orient(sv1, sv2, v3);
      if (o3 > 0) cut(e1, e2, left);
      else cut(e2, e1, right);
    }
  }

  /** @see cdt.c:remove_intersected_vertex */
  private removeIntersectedVertex(
    sv1: number, sv2: number, left: CEdge[], right: CEdge[],
  ): CFace {
    // triangles around sv1 in the surface
    for (const t of this.surface) {
      if (t.v[0] !== sv1 && t.v[1] !== sv1 && t.v[2] !== sv1) continue;
      let [v1, v2, v3] = t.v;
      if (sv1 === v2) { v2 = v3; v3 = v1; } else if (sv1 === v3) { v3 = v2; v2 = v1; }
      // now the wedge at sv1 spans v2..v3
      const o1 = this.orient(sv1, v2, sv2);
      if (o1 < 0) continue;
      const o2 = this.orient(v3, sv1, sv2);
      if (o2 < 0) continue;

      const o3 = this.orient(v2, v3, sv2);
      // e = edge opposite sv1 (connects v2–v3)
      const e = t.e.find((ed) =>
        (ed.v1 === v2 && ed.v2 === v3) || (ed.v1 === v3 && ed.v2 === v2))!;
      const next = this.neighbor(t, e);
      const rr = this.ringFrom(t, e); // v2'=rr.v1, v3'=rr.v2, sv1=rr.v3
      const e2 = rr.e2; // v3–sv1 side
      const e1 = rr.e3; // sv1–v2 side

      if (o3 >= 0) return t; // s.v2 inside (or on far edge of) t — nothing to remove

      // remove t but keep it floating as the attribute reference
      this.removeFace(t, true);
      left.push(e2);
      right.push(e1);
      if (next === null) throw new Error('cdt: constraint walk left the surface');
      this.removeIntersectedEdge(sv1, sv2, e, next, left, right);
      return t;
    }
    throw new Error('cdt: no wedge triangle found at constraint endpoint');
  }

  /** @see cdt.c:gts_delaunay_add_constraint */
  addConstraint(c: CEdge): void {
    const left: CEdge[] = [];
    const right: CEdge[] = [];
    const ref = this.removeIntersectedVertex(c.v1, c.v2, left, right);
    if (ref.inSurface) return; // constraint already realized (o3 >= 0 path)

    // C: triangulate_polygon(prepend(reverse(right), c)) then
    //    triangulate_polygon(prepend(left, c)).
    //
    // GTS accumulates `left`/`right` with g_slist_PREPEND, so ITS lists are in
    // reverse-walk order; we accumulate with push, i.e. walk order. C's
    // reverse(right) therefore yields WALK order and its un-reversed `left`
    // yields REVERSE-walk order — the opposite of what the literal C reads like.
    // Copying the reversal verbatim inverts both cavity rings' winding, so
    // triangulatePolygon's `orient(v1,v2,v3) >= 0` ear test rejects every
    // candidate, the cavity is left UNFILLED, and the constraint edge ends up in
    // no triangle (findMap then throws "no triangle for segment").
    //
    // Latent when a constraint cuts a single triangle — each list holds one edge
    // and the reversal is a no-op. It bites from two cut triangles up.
    this.triangulatePolygon([c, ...right]);
    this.triangulatePolygon([c, ...[...left].reverse()]);
    // ref face was kept floating; destroy it now (detach from edges)
    this.detachFace(ref);
  }

  // -------------------------------------------------------------------
  // Output (delaunay.c: mkSurface + delaunay_remove_holes)
  // -------------------------------------------------------------------

  /** Remove faces using any enclosing-triangle vertex (tri() destroys the
   * enclosing vertices, cascading to their faces). */
  dropEnclosing(s0: number): void {
    for (const f of [...this.surface]) {
      if (f.v[0] >= s0 || f.v[1] >= s0 || f.v[2] >= s0) this.removeFace(f);
    }
  }

  /** delaunay_remove_holes: stored ring runs a constraint edge opposite
   * to the constraint's stored direction. @see delaunay.c:triangle_is_hole */
  dropHoles(): void {
    for (const f of [...this.surface]) {
      let hole = false;
      for (let i = 0; i < 3; i++) {
        const e = f.e[i]!;
        if (e.constraint && e.v1 !== f.v[i]!) { hole = true; break; }
      }
      if (hole) this.removeFace(f);
    }
  }

  toSurface(): Surface {
    const kept = [...this.surface];
    const index = new Map<CFace, number>();
    kept.forEach((f, i) => index.set(f, i));
    const faces: number[] = [];
    const neigh: number[] = [];
    for (const f of kept) {
      faces.push(f.v[0], f.v[1], f.v[2]);
      const ns: number[] = [];
      for (const e of f.e) {
        for (const t of e.tris) {
          if (t !== f && t.inSurface) ns.push(index.get(t)!);
        }
      }
      while (ns.length < 3) ns.push(-1);
      neigh.push(ns[0]!, ns[1]!, ns[2]!);
    }
    return { nfaces: kept.length, faces, neigh };
  }
}

const SQRT3 = 1.73205080756887729;

/**
 * Build the constrained Delaunay surface over n points with nsegs directed
 * constraint segments (segs[2k], segs[2k+1]), removing hole faces.
 * Returns null when no proper triangulation exists.
 * @see lib/neatogen/delaunay.c:tri / mkSurface
 */
export function mkSurface(
  x: number[], y: number[], n: number, segs: number[], nsegs: number,
): Surface | null {
  const px = x.slice(0, n);
  const py = y.slice(0, n);

  // gts_triangle_enclosing(points, scale=100)
  let xmin = px[0]!; let xmax = px[0]!;
  let ymin = py[0]!; let ymax = py[0]!;
  for (let i = 1; i < n; i++) {
    if (px[i]! > xmax) xmax = px[i]!;
    else if (px[i]! < xmin) xmin = px[i]!;
    if (py[i]! > ymax) ymax = py[i]!;
    else if (py[i]! < ymin) ymin = py[i]!;
  }
  const xo = (xmax + xmin) / 2;
  const yo = (ymax + ymin) / 2;
  let r = 100 * Math.hypot(xmax - xo, ymax - yo);
  if (r === 0) r = 100;
  const s0 = n;
  px.push(xo + r * SQRT3, xo, xo - r * SQRT3);
  py.push(yo - r, yo + 2 * r, yo - r);

  const cdt = new Cdt(px, py);
  // tri(): constraint edges are created BEFORE the vertices are inserted,
  // so insertion-time swaps already treat them as unswappable.
  const cons: CEdge[] = [];
  for (let k = 0; k < nsegs; k++) {
    cons.push(cdt.newEdge(segs[2 * k]!, segs[2 * k + 1]!, true));
  }

  // enclosing triangle face: ring (v1,v2,v3) CCW with e1=v1–v2 etc.
  const eEnc1 = cdt.newEdge(s0, s0 + 1);
  const eEnc2 = cdt.newEdge(s0 + 1, s0 + 2);
  const eEnc3 = cdt.newEdge(s0 + 2, s0);
  cdt.addFace([s0, s0 + 1, s0 + 2], [eEnc1, eEnc2, eEnc3]);

  for (let i = 0; i < n; i++) {
    const dup = cdt.addVertex(i);
    if (dup !== null && dup !== i) {
      // gts_vertex_replace(v4, v): rewire i's pre-created constraint edges
      cdt.rewireVertex(i, dup, cons);
    }
  }

  for (let k = 0; k < nsegs; k++) {
    const c = cons[k]!;
    if (c.v1 === c.v2) continue; // degenerate after duplicate replacement
    cdt.addConstraint(c);
  }

  cdt.dropEnclosing(s0);
  if (nsegs > 0) cdt.dropHoles();

  const sf = cdt.toSurface();
  px.length = n;
  py.length = n;
  return sf.nfaces > 0 ? sf : null;
}
