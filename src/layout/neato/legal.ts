// SPDX-License-Identifier: EPL-2.0

/**
 * Plegal_arrangement — decides whether the obstacle polygons form a legal
 * (pairwise non-intersecting, non-nested) arrangement. spline_edges_ only
 * builds the visibility configuration when this passes; otherwise every
 * edge falls back to a straight line.
 *
 * Faithful port of lib/neatogen/legal.c: a left-to-right sweep over all
 * polygon vertices (find_ints) tests each newly-entered edge against the
 * active-edge list with sgnarea/online/intpoint, and a final containment
 * pass (findInside) catches polygons nested without boundary crossings.
 *
 * @see lib/neatogen/legal.c
 */

import type { Point } from '../../model/geom.js';
import type { Poly } from '../../pathplan/types.js';
import { inPoly } from '../../pathplan/index.js';
import { gvQsort } from '../../util/bsd-qsort.js';

/** legal.c:vertex — pos plus its polygon ring and the sweep 'active' mark. */
interface Vertex {
  pos: Point;
  /** ring this vertex belongs to */
  poly: PolyRing;
  /** self-reference while the edge (this, after(this)) is in the sweep list */
  active: Vertex | null;
  /** index within the flat vertex list (only for ring arithmetic) */
  idx: number;
}

/** legal.c:polygon — start/finish indices into the flat vertex list + bb. */
interface PolyRing {
  start: number;
  finish: number;
  bb: { ll: Point; ur: Point };
}

/** @see legal.c:after */
function after(vs: Vertex[], v: Vertex): Vertex {
  return v.idx === v.poly.finish ? vs[v.poly.start]! : vs[v.idx + 1]!;
}

/** @see legal.c:prior */
function prior(vs: Vertex[], v: Vertex): Vertex {
  return v.idx === v.poly.start ? vs[v.poly.finish]! : vs[v.idx - 1]!;
}

function sign(v: number): number {
  if (v < 0) return -1;
  if (v > 0) return 1;
  return 0;
}

/** @see legal.c:SLOPE */
const slope = (p: Point, q: Point): number => (p.y - q.y) / (p.x - q.x);

const eqPt = (v: Point, w: Point): boolean => v.x === w.x && v.y === w.y;

/**
 * Signs of the areas of the triangles formed by adding each vertex of
 * segment m to segment l, and the sign of their product.
 * @see legal.c:sgnarea
 */
function sgnarea(vs: Vertex[], l: Vertex, m: Vertex, i: number[]): void {
  const a = l.pos.x;
  const b = l.pos.y;
  const c = after(vs, l).pos.x - a;
  const d = after(vs, l).pos.y - b;
  const e = m.pos.x - a;
  const f = m.pos.y - b;
  const g = after(vs, m).pos.x - a;
  const h = after(vs, m).pos.y - b;
  i[0] = sign(c * f - d * e);
  i[1] = sign(c * h - d * g);
  i[2] = i[0]! * i[1]!;
}

/**
 * Where is g relative to the interval delimited by f and h (unordered)?
 * -1 outside, 1 inside, 0 on the boundary.
 * @see legal.c:between
 */
function between(f: number, g: number, h: number): number {
  if (f < g) {
    if (g < h) return 1;
    if (g > h) return -1;
    return 0;
  }
  if (f > g) {
    if (g > h) return 1;
    if (g < h) return -1;
    return 0;
  }
  return 0;
}

/** Is vertex i (0 = start, 1 = end) of segment m on segment l?
 * @see legal.c:online */
function online(vs: Vertex[], l: Vertex, m: Vertex, i: number): number {
  const a = l.pos;
  const b = after(vs, l).pos;
  const c = i === 0 ? m.pos : after(vs, m).pos;
  return a.x === b.x
    ? (a.x === c.x && between(a.y, c.y, b.y) !== -1 ? 1 : 0)
    : between(a.x, c.x, b.x);
}

/** Point of a detected intersection. Returns null when cond rejects.
 * @see legal.c:intpoint */
function intpoint(
  vs: Vertex[], l: Vertex, m: Vertex, cond: number,
): Point | null {
  if (cond <= 0) return null;
  const ls = l.pos;
  const le = after(vs, l).pos;
  const ms = m.pos;
  const me = after(vs, m).pos;
  let x: number;
  let y: number;

  switch (cond) {
    case 3: { // a simple intersection
      if (ls.x === le.x) {
        x = ls.x;
        y = me.y + slope(ms, me) * (x - me.x);
      } else if (ms.x === me.x) {
        x = ms.x;
        y = le.y + slope(ls, le) * (x - le.x);
      } else {
        const m1 = slope(ms, me);
        const m2 = slope(ls, le);
        const c1 = ms.y - m1 * ms.x;
        const c2 = ls.y - m2 * ls.x;
        x = (c2 - c1) / (m1 - m2);
        y = (m1 * c2 - c1 * m2) / (m1 - m2);
      }
      break;
    }
    case 2: { // the two lines have a common segment
      let pt1: Point;
      let pt2: Point;
      if (online(vs, l, m, 0) === -1) { // ms between ls and le
        pt1 = ms;
        pt2 = online(vs, m, l, 1) === -1
          ? (online(vs, m, l, 0) === -1 ? le : ls) : me;
      } else if (online(vs, l, m, 1) === -1) { // me between ls and le
        pt1 = me;
        pt2 = online(vs, l, m, 0) === -1
          ? (online(vs, m, l, 0) === -1 ? le : ls) : ms;
      } else {
        // may be degenerate?
        if (online(vs, m, l, 0) !== -1) return null;
        pt1 = ls;
        pt2 = le;
      }
      x = (pt1.x + pt2.x) / 2;
      y = (pt1.y + pt2.y) / 2;
      break;
    }
    default: { // case 1: a vertex of line m is on line l
      if ((ls.x - le.x) * (ms.y - ls.y) === (ls.y - le.y) * (ms.x - ls.x)) {
        x = ms.x;
        y = ms.y;
      } else {
        x = me.x;
        y = me.y;
      }
    }
  }
  return { x, y };
}

/** True if a REAL intersection has been found (filters endpoint touches of
 * vertical segments). @see legal.c:realIntersect */
function realIntersect(vs: Vertex[], firstv: Vertex, secondv: Vertex, p: Point): boolean {
  const vft = firstv.pos;
  const avft = after(vs, firstv).pos;
  const vsd = secondv.pos;
  const avsd = after(vs, secondv).pos;
  return (vft.x !== avft.x && vsd.x !== avsd.x) ||
    (vft.x === avft.x && !eqPt(vft, p) && !eqPt(avft, p)) ||
    (vsd.x === avsd.x && !eqPt(vsd, p) && !eqPt(avsd, p));
}

/** Detect whether segments l and m intersect. @see legal.c:find_intersection */
function findIntersection(vs: Vertex[], l: Vertex, m: Vertex): boolean {
  const i: number[] = [0, 0, 0];
  sgnarea(vs, l, m, i);
  if (i[2]! > 0) return false;

  let pt: Point | null;
  if (i[2]! < 0) {
    sgnarea(vs, m, l, i);
    if (i[2]! > 0) return false;
    pt = intpoint(vs, l, m, i[2]! < 0 ? 3 : online(vs, m, l, Math.abs(i[0]!)));
    if (pt === null) return false;
  } else {
    pt = intpoint(vs, l, m, i[0] === i[1]
      ? 2 * Math.max(online(vs, l, m, 0), online(vs, l, m, 1))
      : online(vs, l, m, Math.abs(i[0]!)));
    if (pt === null) return false;
  }
  return realIntersect(vs, l, m, pt);
}

/** Sweep comparator: x, then y. @see legal.c:gt */
function gt(a: Vertex, b: Vertex): number {
  if (a.pos.x > b.pos.x) return 1;
  if (a.pos.x < b.pos.x) return -1;
  if (a.pos.y > b.pos.y) return 1;
  if (a.pos.y < b.pos.y) return -1;
  return 0;
}

/**
 * Check for pairwise intersection of polygon sides by a left-to-right
 * sweep. Returns 1 if an intersection is found, 0 if not, -1 on the
 * delete-a-non-line error. @see legal.c:find_ints
 */
function findInts(vs: Vertex[]): number {
  const all: Vertex[] = [];
  const pvertex = gvQsort(vs.slice(), gt);

  for (const pt1 of pvertex) {
    let pt2 = prior(vs, pt1);
    let templ = pt2;
    for (let k = 0; k < 2; k++) { // each vertex has 2 edges
      switch (gt(pt1, pt2)) {
        case -1: { // forward edge: test against active list, then insert
          for (const tempa of all) {
            if (findIntersection(vs, tempa, templ)) return 1;
          }
          all.push(templ);
          templ.active = templ;
          break;
        }
        case 1: { // backward edge: delete
          const tempa = templ.active;
          if (tempa === null) {
            // C: agerrorf("trying to delete a non-line") + return -1
            return -1;
          }
          const at = all.indexOf(tempa);
          if (at >= 0) all.splice(at, 1);
          templ.active = null;
          break;
        }
        default:
          break; // same point; do nothing
      }
      pt2 = after(vs, pt1);
      templ = pt1; // second neighbor
    }
  }
  return 0;
}

const inBox = (p: Point, bb: { ll: Point; ur: Point }): boolean =>
  p.x <= bb.ur.x && p.x >= bb.ll.x && p.y <= bb.ur.y && p.y >= bb.ll.y;

const nested = (a: { ll: Point; ur: Point }, b: { ll: Point; ur: Point }): boolean =>
  inBox(a.ll, b) && inBox(a.ur, b);

/**
 * Boundary-crossing-free containment: each pair is either disjoint or one
 * inside the other. Returns true when a nesting is found.
 * @see legal.c:findInside
 */
function findInside(polys: Poly[], rings: PolyRing[]): boolean {
  for (let i = 0; i < polys.length; i++) {
    const p1 = polys[i]!;
    const pt = p1.ps[0]!;
    for (let j = i + 1; j < polys.length; j++) {
      const p2 = polys[j]!;
      if (nested(rings[i]!.bb, rings[j]!.bb)) {
        if (inPoly(p2.ps, pt)) return true;
      } else if (nested(rings[j]!.bb, rings[i]!.bb)) {
        if (inPoly(p1.ps, p2.ps[0]!)) return true;
      }
    }
  }
  return false;
}

/**
 * True when no two obstacle polygons intersect or nest.
 * @see lib/neatogen/legal.c:Plegal_arrangement
 */
export function legalArrangement(polys: Poly[]): boolean {
  const rings: PolyRing[] = [];
  const vs: Vertex[] = [];
  for (const poly of polys) {
    const start = vs.length;
    const bb = {
      ll: { x: Infinity, y: Infinity },
      ur: { x: -Infinity, y: -Infinity },
    };
    const ring: PolyRing = { start, finish: start, bb };
    for (const p of poly.ps) {
      bb.ll.x = Math.min(bb.ll.x, p.x);
      bb.ll.y = Math.min(bb.ll.y, p.y);
      bb.ur.x = Math.max(bb.ur.x, p.x);
      bb.ur.y = Math.max(bb.ur.y, p.y);
      vs.push({ pos: p, poly: ring, active: null, idx: vs.length });
    }
    ring.finish = vs.length - 1;
    rings.push(ring);
  }

  const found = findInts(vs);
  if (found < 0) return false;
  if (found !== 0) return false;
  return !findInside(polys, rings);
}
