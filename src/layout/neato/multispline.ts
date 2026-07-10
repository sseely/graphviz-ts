// SPDX-License-Identifier: EPL-2.0

/**
 * makeMultiSpline — the HAVE_GTS router of the reference binary for edges
 * with multiplicity (ED_count > 1) or boundary ports.
 *
 * The triangle corridor from triPath is turned into a simple polygon
 * (mkPoly), the shortest path inside it (Pshortestpath funnel) guides the
 * spline, and for multi-edges each member gets its own sub-polygon built
 * from control points fanned across the corridor (mkCtrlPts).
 *
 * @see lib/neatogen/multispline.c
 */

import type { Edge } from '../../model/edge.js';
import type { Graph } from '../../model/graph.js';
import type { Point } from '../../pathplan/types.js';
import type { SplineInfo } from '../../common/types.js';
import { wind } from '../../pathplan/visibility.js';
import { shortestPath } from '../../pathplan/shortest.js';
import { routeSpline, makePolyline } from '../../pathplan/index.js';
import type { Edge as PEdge } from '../../pathplan/types.js';
import { clipAndInstall } from '../../common/splines-clip.js';
import { makeStraightEdges, addEdgeLabels } from '../dot/straight-edges.js';
import type { Router, Ipair } from './multispline-router.js';
import { addEndpoint, edgeToSeg, triPath } from './multispline-router.js';

export type { Router } from './multispline-router.js';
export { mkRouter } from './multispline-router.js';

/** multispline.c's module sinfo: no end swapping, no merging. */
const MSINFO: SplineInfo = {
  swapEnds: () => false,
  splineMerge: () => false,
  ignoreSwap: false,
  isOrtho: false,
};

/** opposite-side list entry. @see multispline.c:tri (linked list, prepended) */
interface TriSide {
  v: Ipair;
  prev: TriSide | null;
}

/** @see multispline.c:tripoly_t */
interface Tripoly {
  ps: Point[];
  /** triMap[j]: prepend-ordered list of sides opposite vertex j */
  triMap: (TriSide | null)[];
}

const addTri = (i: number, j: number, oldp: TriSide | null): TriSide =>
  ({ v: { i, j }, prev: oldp });

// ---------------------------------------------------------------------------
// mkCtrlPts — fan of control points across the corridor at a vertex
// ---------------------------------------------------------------------------

/** angle bisecting pp--cp--np. @see multispline.c:bisect */
function bisect(pp: Point, cp: Point, np: Point): number {
  const theta = Math.atan2(np.y - cp.y, np.x - cp.x);
  const phi = Math.atan2(pp.y - cp.y, pp.x - cp.x);
  return (theta + phi) / 2.0;
}

/** @see multispline.c:raySeg */
function raySeg(v: Point, w: Point, a: Point, b: Point): boolean {
  const wa = wind(v, w, a);
  const wb = wind(v, w, b);
  if (wa === wb) return false;
  if (wa === 0) {
    return wind(v, b, w) * wind(v, b, a) >= 0;
  }
  return wind(v, a, w) * wind(v, a, b) >= 0;
}

const SMALL = 0.0000000001;

/**
 * Point where ray v->w crosses segment a--b, or null.
 * @see multispline.c:raySegIntersect / lib/common/geom.c:line_intersect
 */
function raySegIntersect(v: Point, w: Point, a: Point, b: Point): Point | null {
  if (!raySeg(v, w, a, b)) return null;
  const mv = { x: w.x - v.x, y: w.y - v.y };
  const lv = { x: b.x - a.x, y: b.y - a.y };
  const ln = { x: -lv.y, y: lv.x }; // perp
  const lc = -(ln.x * a.x + ln.y * a.y);
  const dt = ln.x * mv.x + ln.y * mv.y;
  if (Math.abs(dt) < SMALL) return null;
  const s = (ln.x * v.x + ln.y * v.y + lc) / dt;
  return { x: v.x - s * mv.x, y: v.y - s * mv.y };
}

/**
 * Where the ray v->w (pointing into the polygon) crosses one of the sides
 * opposite vertex vx. Null on failure. @see multispline.c:triPoint
 */
function triPoint(trip: Tripoly, vx: number, v: Point, w: Point): Point | null {
  for (let tp = trip.triMap[vx] ?? null; tp; tp = tp.prev) {
    const ip = raySegIntersect(v, w, trip.ps[tp.v.i]!, trip.ps[tp.v.j]!);
    if (ip !== null) return ip;
  }
  return null;
}

/** index of v among the polygon points (from 1). @see multispline.c:ctrlPtIdx */
function ctrlPtIdx(v: Point, ps: Point[]): number {
  for (let i = 1; i < ps.length; i++) {
    const w = ps[i]!;
    if (w.x === v.x && w.y === v.y) return i;
  }
  return -1;
}

const SEP = 15;

/**
 * mult points on the bisector ray at corridor vertex v, spaced ≤ SEP,
 * ordered by side (s = index after which vertices are on the far side).
 * Null on failure. @see multispline.c:mkCtrlPts
 */
function mkCtrlPts(
  s: number, mult: number, prev: Point, v: Point, nxt: Point, trip: Tripoly,
): Point[] | null {
  const idx = ctrlPtIdx(v, trip.ps);
  if (idx < 0) return null;

  const theta = bisect(prev, v, nxt);
  let sinTheta = Math.sin(theta);
  let cosTheta = Math.cos(theta);
  let w = { x: v.x + 100 * cosTheta, y: v.y + 100 * sinTheta };
  if (idx > s) {
    if (wind(prev, v, w) !== 1) {
      sinTheta *= -1;
      cosTheta *= -1;
      w = { x: v.x + 100 * cosTheta, y: v.y + 100 * sinTheta };
    }
  } else if (wind(prev, v, w) !== -1) {
    sinTheta *= -1;
    cosTheta *= -1;
    w = { x: v.x + 100 * cosTheta, y: v.y + 100 * sinTheta };
  }
  const q = triPoint(trip, idx, v, w);
  if (q === null) return null;

  const d = Math.hypot(q.x - v.x, q.y - v.y);
  const sep = d >= mult * SEP ? SEP : d / mult;
  const ps = new Array<Point>(mult);
  if (idx < s) {
    for (let i = 0; i < mult; i++) {
      ps[i] = { x: v.x + i * sep * cosTheta, y: v.y + i * sep * sinTheta };
    }
  } else {
    for (let i = 0; i < mult; i++) {
      ps[mult - i - 1] = { x: v.x + i * sep * cosTheta, y: v.y + i * sep * sinTheta };
    }
  }
  return ps;
}

// ---------------------------------------------------------------------------
// mkPoly — corridor polygon from the triangle path
// ---------------------------------------------------------------------------

interface SideT {
  v: number;
  ts: TriSide | null;
}

/**
 * Build the simple polygon around the triangle path dad from s to t
 * (t's index in the polygon is 0; the returned sx is s's index).
 * @see multispline.c:mkPoly
 */
function mkPoly(
  rtr: Router, dad: number[], s: number, tIn: number, pS: Point, pT: Point,
): { trip: Tripoly; sx: number } {
  let t = tIn;
  let nt = 0;
  for (let nxt = dad[t]!; nxt !== s; nxt = dad[nxt]!) nt++;

  const side1: SideT[] = [];
  const side2: SideT[] = [];

  let nxt = dad[t]!;
  let p = edgeToSeg(rtr.tg, nxt, t);
  side1.push({ ts: addTri(-1, p.j, null), v: p.i });
  side2.push({ ts: addTri(-1, p.i, null), v: p.j });

  t = nxt;
  for (nxt = dad[t]!; nxt >= 0; nxt = dad[nxt]!) {
    p = edgeToSeg(rtr.tg, t, nxt);
    const s1 = side1[side1.length - 1]!;
    const s2 = side2[side2.length - 1]!;
    if (p.i === s1.v) {
      s1.ts = addTri(s2.v, p.j, s1.ts);
      s2.ts = addTri(s1.v, p.j, s2.ts);
      side2.push({ ts: addTri(s2.v, s1.v, null), v: p.j });
    } else if (p.i === s2.v) {
      s1.ts = addTri(s2.v, p.j, s1.ts);
      s2.ts = addTri(s1.v, p.j, s2.ts);
      side1.push({ ts: addTri(s2.v, s1.v, null), v: p.j });
    } else if (p.j === s1.v) {
      s1.ts = addTri(s2.v, p.i, s1.ts);
      s2.ts = addTri(s1.v, p.i, s2.ts);
      side2.push({ ts: addTri(s2.v, s1.v, null), v: p.i });
    } else {
      s1.ts = addTri(s2.v, p.i, s1.ts);
      s2.ts = addTri(s1.v, p.i, s2.ts);
      side1.push({ ts: addTri(s2.v, s1.v, null), v: p.i });
    }
    t = nxt;
  }
  const cnt1 = side1.length;
  const cnt2 = side2.length;
  side1[cnt1 - 1]!.ts = addTri(-2, side2[cnt2 - 1]!.v, side1[cnt1 - 1]!.ts);
  side2[cnt2 - 1]!.ts = addTri(-2, side1[cnt1 - 1]!.v, side2[cnt2 - 1]!.ts);

  /* store points starting with t at 0, then side1, then s, then side2 */
  const vmap = new Map<number, number>();
  vmap.set(-1, 0);
  vmap.set(-2, cnt1 + 1);
  const pts: Point[] = [pT];
  const trim: (TriSide | null)[] = [null];
  let idx = 1;
  for (let i = 0; i < cnt1; i++) {
    vmap.set(side1[i]!.v, idx);
    pts.push(rtr.ps[side1[i]!.v]!);
    trim[idx++] = side1[i]!.ts;
  }
  pts.push(pS);
  trim[idx++] = null;
  for (let i = cnt2 - 1; i >= 0; i--) {
    vmap.set(side2[i]!.v, idx);
    pts.push(rtr.ps[side2[i]!.v]!);
    trim[idx++] = side2[i]!.ts;
  }

  for (const head of trim) {
    for (let tp = head; tp; tp = tp.prev) {
      tp.v.i = vmap.get(tp.v.i)!;
      tp.v.j = vmap.get(tp.v.j)!;
    }
  }

  void nt; /* nt+4 == pts.length by construction */
  return { trip: { ps: pts, triMap: trim }, sx: cnt1 + 1 };
}

// ---------------------------------------------------------------------------
// genroute
// ---------------------------------------------------------------------------

/** clip to nodes, install, and place labels. @see multispline.c:finishEdge */
function finishEdge(e: Edge, spl: Point[], flip: boolean): void {
  const pts = flip ? spl.slice().reverse() : spl;
  clipAndInstall(e, e.head, pts, pts.length, MSINFO);
  addEdgeLabels(e);
}

/**
 * If the path endpoint at polygon index s heads along the polygon border
 * (q equals a neighbor vertex), nudge it slightly inside.
 * @see multispline.c:tweakEnd
 */
function tweakEnd(poly: Point[], s: number, q: Point): Point {
  const p = poly[s]!;
  const nxt = poly[(s + 1) % poly.length]!;
  const prv = s === 0 ? poly[poly.length - 1]! : poly[s - 1]!;
  if ((q.x === nxt.x && q.y === nxt.y) || (q.x === prv.x && q.y === prv.y)) {
    const mx = (nxt.x + prv.x) / 2.0 - p.x;
    const my = (nxt.y + prv.y) / 2.0 - p.y;
    const d = Math.hypot(mx, my);
    return { x: p.x + 0.1 * mx / d, y: p.y + 0.1 * my / d };
  }
  return p;
}

/** @see multispline.c:tweakPath */
function tweakPath(poly: Point[], t: number, pl: Point[]): void {
  pl[0] = tweakEnd(poly, 0, pl[1]!);
  pl[pl.length - 1] = tweakEnd(poly, t, pl[pl.length - 2]!);
}

/** polygon boundary as pathplan barrier edges. */
function polyEdges(ps: Point[]): PEdge[] {
  return ps.map((p, j) => ({ a: p, b: ps[(j + 1) % ps.length]! }));
}

/** Route one member through `poly`, spline or polyline. Null on failure. */
function routeMember(
  poly: Point[], t: number, pl: Point[], doPolyline: boolean,
): Point[] | null {
  if (doPolyline) {
    return makePolyline(pl);
  }
  tweakPath(poly, t, pl);
  try {
    const spl = routeSpline(
      polyEdges(poly), pl, [{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    return spl.length >= 4 ? spl : null;
  } catch {
    return null;
  }
}

/** Full ED_to_virt chain from the leader (C makeStraightEdge's walk). */
function chainOf(e: Edge): Edge[] {
  const list: Edge[] = [e];
  let e0: Edge = e;
  while (e0.info.to_virt !== undefined && e0.info.to_virt !== e0) {
    e0 = e0.info.to_virt;
    list.push(e0);
  }
  return list;
}

/**
 * Generate splines for e and cohorts through the corridor polygon.
 * Edges run from polygon index 0 to t. Returns 0 on success.
 * @see multispline.c:genroute
 */
function genroute(
  g: Graph, trip: Tripoly, t: number, e: Edge, doPolyline: boolean,
): number {
  const eps: [Point, Point] = [
    { x: trip.ps[0]!.x, y: trip.ps[0]!.y },
    { x: trip.ps[t]!.x, y: trip.ps[t]!.y },
  ];
  const concentrate = g.root.info.concentrate ?? false;
  const mult = e.info.count ?? 1;
  const head = e.head;

  const pl = shortestPath({ ps: trip.ps }, eps);
  if (pl === null) return 1;

  if (pl.length === 2) {
    // C passes doPolyline (0/1) AS the edge type — so the polyline case
    // runs makeStraightEdges with et=1 (EDGETYPE_LINE), never its PLINE
    // branch. Load-bearing quirk; port verbatim. The full to_virt chain is
    // gathered (routespl.c makeStraightEdge); makeStraightEdges applies the
    // Concentrate representative rule internally.
    const chain = chainOf(e);
    makeStraightEdges(g, chain, chain.length, doPolyline ? 1 : 0, MSINFO);
    return 0;
  }

  if (mult === 1 || concentrate) {
    const spl = routeMember(trip.ps, t, pl, doPolyline);
    if (spl === null) return 1;
    finishEdge(e, spl, e.head !== head);
    return 0;
  }

  const pn = 2 * (pl.length - 1);
  const cpts: Point[][] = [];
  for (let i = 0; i + 2 < pl.length; i++) {
    const cp = mkCtrlPts(t, mult + 1, pl[i]!, pl[i + 1]!, pl[i + 2]!, trip);
    if (cp === null) return 1;
    cpts.push(cp);
  }

  let cur: Edge | undefined = e;
  for (let i = 0; i < mult && cur !== undefined; i++) {
    const poly: Point[] = new Array<Point>(pn);
    poly[0] = eps[0];
    for (let j = 1; j + 1 < pl.length; j++) {
      poly[j] = cpts[j - 1]![i]!;
    }
    poly[pl.length - 1] = eps[1];
    for (let j = 1; j + 1 < pl.length; j++) {
      poly[pn - j] = cpts[j - 1]![i + 1]!;
    }
    const mmpl = shortestPath({ ps: poly }, eps);
    if (mmpl === null) return 1;

    const spl = routeMember(poly, pl.length - 1, mmpl, doPolyline);
    if (spl === null) return 1;
    finishEdge(cur, spl, cur.head !== head);

    cur = cur.info.to_virt;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// makeMultiSpline
// ---------------------------------------------------------------------------

/**
 * Route edge e (and its coalesced cohorts) through the triangle router.
 * `route` is the edge's ED_path (obsPath result). Returns 0 on success.
 * @see multispline.c:makeMultiSpline
 */
export function makeMultiSpline(
  g: Graph, e: Edge, rtr: Router, route: Point[], doPolyline: boolean,
): number {
  const tP = route[0]!;
  const hP = route[route.length - 1]!;
  const tId = rtr.tn;
  const hId = rtr.tn + 1;
  const ecnt = rtr.tg.edges.length;
  const originalEdgeCount = rtr.tg.nodes.map((n) => n.edges.length);

  /* Add endpoints to triangle graph */
  addEndpoint(rtr, tP, e.tail.info.lim ?? 0, tId, e.info.tail_port.side);
  addEndpoint(rtr, hP, e.head.info.lim ?? 0, hId, e.info.head_port.side);

  /* Find shortest path of triangles */
  const sp = triPath(rtr.tg, rtr.tn + 2, hId, tId);

  let ret;
  if (sp) {
    const { trip, sx } = mkPoly(rtr, sp, hId, tId, hP, tP);
    ret = genroute(g, trip, sx, e, doPolyline);
  } else {
    ret = -1;
  }

  /* remove edges and nodes added for this edge */
  rtr.tg.edges.length = ecnt;
  for (let i = 0; i < rtr.tn; i++) {
    rtr.tg.nodes[i]!.edges.length = originalEdgeCount[i]!;
  }
  return ret;
}
