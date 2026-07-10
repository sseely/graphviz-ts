// SPDX-License-Identifier: EPL-2.0

/**
 * Triangle-graph router for multisplines — mkRouter and the shortest-path
 * machinery of multispline.c.
 *
 * The router triangulates the free space around the obstacles (constrained
 * Delaunay of a margined bounding box + obstacle boundaries, holes removed)
 * and builds a graph whose nodes are triangles, connected when they share
 * a side. Edge endpoints are added as temporary nodes connected to the
 * triangles of their obstacle's sides, and a Dijkstra pass (max-heap on
 * negated distances, exactly the C fPQ) finds the corridor of triangles
 * the spline must thread.
 *
 * @see lib/neatogen/multispline.c:mkRouter / mkTriGraph / triPath / addEndpoint
 * @see lib/neatogen/fPQ.h
 */

import type { Point, Poly } from '../../pathplan/types.js';
import { wind } from '../../pathplan/visibility.js';
import { mkSurface } from './cdt-surface.js';

/** index pair. @see multispline.c:ipair */
export interface Ipair { i: number; j: number }

/** @see multispline.c:tnode */
export interface Tnode {
  edges: number[];
  ctr: Point;
}

/** @see multispline.c:tedge */
export interface Tedge {
  t: number;
  h: number;
  seg: Ipair;
  dist: number;
}

/** @see multispline.c:tgraph */
export interface Tgraph {
  nodes: Tnode[];
  edges: Tedge[];
}

/** @see multispline.c:router_s */
export interface Router {
  pn: number;
  ps: Point[];
  /** indices in obstacle i are obs[i]...obs[i+1]-1 */
  obs: number[];
  /** vertex indices of triangle i: tris[3i..3i+2] */
  tris: number[];
  /** map from obstacle side (a,b), a<b, to adjacent kept triangle */
  trimap: Map<number, number>;
  /** number of triangle nodes (endpoint nodes get tn, tn+1) */
  tn: number;
  tg: Tgraph;
}

const MARGIN = 32;

const segKey = (a: number, b: number): number =>
  a < b ? a * 0x100000 + b : b * 0x100000 + a;

/** @see multispline.c:triCenter */
function triCenter(pts: Point[], tris: number[], i: number): Point {
  const a = pts[tris[3 * i]!]!;
  const b = pts[tris[3 * i + 1]!]!;
  const c = pts[tris[3 * i + 2]!]!;
  return { x: (a.x + b.x + c.x) / 3.0, y: (a.y + b.y + c.y) / 3.0 };
}

/**
 * Shared side of neighbor faces p and q as a sorted index pair.
 * @see multispline.c:sharedEdge
 */
function sharedEdge(faces: number[], p3: number, q3: number): Ipair {
  const p = [faces[p3]!, faces[p3 + 1]!, faces[p3 + 2]!];
  const q = new Set([faces[q3]!, faces[q3 + 1]!, faces[q3 + 2]!]);
  const shared = p.filter((v) => q.has(v));
  const p1 = Math.min(shared[0]!, shared[1]!);
  const p2 = Math.max(shared[0]!, shared[1]!);
  return { i: p1, j: p2 };
}

/** @see multispline.c:addTriEdge */
export function addTriEdge(g: Tgraph, t: number, h: number, seg: Ipair): void {
  const dist = Math.hypot(
    g.nodes[t]!.ctr.x - g.nodes[h]!.ctr.x,
    g.nodes[t]!.ctr.y - g.nodes[h]!.ctr.y);
  const idx = g.edges.length;
  g.edges.push({ t, h, seg, dist });
  g.nodes[t]!.edges.push(idx);
  g.nodes[h]!.edges.push(idx);
}

/** @see multispline.c:mkTriGraph */
function mkTriGraph(nfaces: number, faces: number[], neigh: number[], pts: Point[], tris: number[]): Tgraph {
  const g: Tgraph = { nodes: [], edges: [] };
  /* plus 2 for nodes added as endpoints of an edge */
  for (let i = 0; i < nfaces + 2; i++) {
    g.nodes.push({ edges: [], ctr: { x: 0, y: 0 } });
  }
  for (let i = 0; i < nfaces; i++) {
    g.nodes[i]!.ctr = triCenter(pts, tris, i);
  }
  for (let i = 0; i < nfaces; i++) {
    for (let ne = 0; ne < 3; ne++) {
      const j = neigh[3 * i + ne]!;
      if (j === -1) break;
      if (i < j) {
        addTriEdge(g, i, j, sharedEdge(faces, 3 * i, 3 * j));
      }
    }
  }
  return g;
}

/**
 * Build the router over the obstacle set: margined bbox stored CCW,
 * obstacles CW (as given), all boundary sides as directed constraints.
 * @see multispline.c:mkRouter
 */
export function mkRouter(obsp: Poly[]): Router {
  const npoly = obsp.length;
  let minX = Infinity; let maxX = -Infinity;
  let minY = Infinity; let maxY = -Infinity;
  let cnt = 0;
  for (const obs of obsp) {
    for (const p of obs.ps) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      cnt++;
    }
  }
  minX -= MARGIN; minY -= MARGIN; maxX += MARGIN; maxY += MARGIN;

  const npts = cnt + 4; /* 4 points of bounding box */
  const pts: Point[] = new Array<Point>(npts);
  const segs: number[] = [];
  /* store bounding box in CCW order */
  pts[0] = { x: minX, y: minY };
  pts[1] = { x: maxX, y: minY };
  pts[2] = { x: maxX, y: maxY };
  pts[3] = { x: minX, y: maxY };
  for (let i = 1; i <= 4; i++) {
    segs.push(i - 1, i < 4 ? i : 0);
  }

  /* store obstacles in CW order and generate constraint segments */
  const obsi = new Array<number>(npoly + 1);
  let ix = 4;
  for (let i = 0; i < npoly; i++) {
    obsi[i] = ix;
    const obs = obsp[i]!;
    for (let j = 1; j <= obs.ps.length; j++) {
      segs.push(ix, j < obs.ps.length ? ix + 1 : obsi[i]!);
      pts[ix++] = obs.ps[j - 1]!;
    }
  }
  obsi[npoly] = ix;

  const x = pts.map((p) => p.x);
  const y = pts.map((p) => p.y);
  const sf = mkSurface(x, y, npts, segs, npts);
  if (sf === null) {
    throw new Error('mkRouter: constrained triangulation failed');
  }

  /* map from obstacle side to its unique adjacent kept triangle */
  const trimap = new Map<number, number>();
  for (let i = 0; i < sf.nfaces; i++) {
    const a = sf.faces[3 * i]!;
    const b = sf.faces[3 * i + 1]!;
    const c = sf.faces[3 * i + 2]!;
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
      trimap.set(segKey(u, v), i);
    }
  }

  return {
    pn: npts,
    ps: pts,
    obs: obsi,
    tris: sf.faces.slice(),
    trimap,
    tn: sf.nfaces,
    tg: mkTriGraph(sf.nfaces, sf.faces, sf.neigh, pts, sf.faces),
  };
}

/** @see multispline.c:findMap */
export function findMap(trimap: Map<number, number>, a: number, b: number): number {
  const t = trimap.get(segKey(a, b));
  if (t === undefined) throw new Error('findMap: no triangle for segment');
  return t;
}

// ---------------------------------------------------------------------------
// addEndpoint — inject a spline endpoint into the triangle graph
// ---------------------------------------------------------------------------

const NSMALL = -0.0000000001;

/** @see lib/pathplan/visibility.c:area2 */
function area2(a: Point, b: Point, c: Point): number {
  return (a.y - b.y) * (c.x - b.x) - (c.y - b.y) * (a.x - b.x);
}

/** true iff q is in the convex cone a-b-c. @see multispline.c:inCone */
function inCone(a: Point, b: Point, c: Point, q: Point): boolean {
  return area2(q, a, b) >= NSMALL && area2(q, b, c) >= NSMALL;
}

/** check if ray v->w intersects segment a--b. @see multispline.c:raySeg */
export function raySeg(v: Point, w: Point, a: Point, b: Point): boolean {
  const wa = wind(v, w, a);
  const wb = wind(v, w, b);
  if (wa === wb) return false;
  if (wa === 0) {
    return wind(v, b, w) * wind(v, b, a) >= 0;
  }
  return wind(v, a, w) * wind(v, a, b) >= 0;
}

/** compass side bitmasks. @see lib/common/const.h */
const BOTTOM = 1 << 0;
const RIGHT = 1 << 1;
const TOP = 1 << 2;
const LEFT = 1 << 3;

const add = (p: Point, q: Point): Point => ({ x: p.x + q.x, y: p.y + q.y });

/** (vr, v0, v1) direction triple for a side mask. @see multispline.c:addEndpoint */
function sideCone(p: Point, sides: number): [Point, Point, Point] {
  const north = { x: 0, y: 1 }; const northeast = { x: 1, y: 1 };
  const east = { x: 1, y: 0 }; const southeast = { x: 1, y: -1 };
  const south = { x: 0, y: -1 }; const southwest = { x: -1, y: -1 };
  const west = { x: -1, y: 0 }; const northwest = { x: -1, y: 1 };
  switch (sides) {
    case TOP: return [add(p, north), add(p, northwest), add(p, northeast)];
    case TOP | RIGHT: return [add(p, northeast), add(p, north), add(p, east)];
    case RIGHT: return [add(p, east), add(p, northeast), add(p, southeast)];
    case BOTTOM | RIGHT: return [add(p, southeast), add(p, east), add(p, south)];
    case BOTTOM: return [add(p, south), add(p, southeast), add(p, southwest)];
    case BOTTOM | LEFT: return [add(p, southwest), add(p, south), add(p, west)];
    case LEFT: return [add(p, west), add(p, southwest), add(p, northwest)];
    case TOP | LEFT: return [add(p, northwest), add(p, west), add(p, north)];
    default: return [p, p, p];
  }
}

/**
 * Add graph node v_id at endpoint p inside obstacle obsId, connected to the
 * triangles adjacent to the obstacle's sides — restricted to a 45°-widened
 * cone when p sits on specific node sides.
 * @see multispline.c:addEndpoint
 */
export function addEndpoint(
  rtr: Router, p: Point, obsId: number, vId: number, sides: number,
): void {
  const starti = rtr.obs[obsId]!;
  const endi = rtr.obs[obsId + 1]!;
  const pts = rtr.ps;
  const [vr, v0, v1] = sideCone(p, sides);

  rtr.tg.nodes[vId]!.edges.length = 0;
  rtr.tg.nodes[vId]!.ctr = p;
  for (let i = starti; i < endi; i++) {
    const seg: Ipair = { i, j: i < endi - 1 ? i + 1 : starti };
    const t = findMap(rtr.trimap, seg.i, seg.j);
    if (sides !== 0 && !inCone(v0, p, v1, pts[seg.i]!) &&
        !inCone(v0, p, v1, pts[seg.j]!) &&
        !raySeg(p, vr, pts[seg.i]!, pts[seg.j]!)) {
      continue;
    }
    addTriEdge(rtr.tg, vId, t, seg);
  }
}

/** @see multispline.c:edgeToSeg */
export function edgeToSeg(tg: Tgraph, i: number, j: number): Ipair {
  const np = tg.nodes[i]!;
  for (const k of np.edges) {
    const ep = tg.edges[k]!;
    if (ep.t === j || ep.h === j) return ep.seg;
  }
  throw new Error('edgeToSeg: no edge between triangles');
}

// ---------------------------------------------------------------------------
// triPath — Dijkstra over the triangle graph (C fPQ max-heap, negated vals)
// ---------------------------------------------------------------------------

const UNSEEN = -3.4028234663852886e38; // -FLT_MAX

/**
 * Max-heap on vals with guard vals[-1]=0 (all live values ≤ 0), exactly the
 * C fPQ macros instantiated by multispline.c.
 * @see lib/neatogen/fPQ.h
 */
class Fpq {
  private readonly pq: number[];
  private cnt = 0;
  readonly vals: number[];
  private readonly idxs: number[];

  constructor(readonly size: number) {
    this.pq = new Array<number>(size + 1).fill(-1); // pq[0] = guard idx -1
    this.vals = new Array<number>(size).fill(UNSEEN);
    this.idxs = new Array<number>(size).fill(0);
  }

  private val(n: number): number {
    return n === -1 ? 0 : this.vals[n]!; // guard value 0 = +inf in ≤0 domain
  }

  private upheap(kIn: number): void {
    const { pq } = this;
    let k = kIn;
    const x = pq[k]!;
    const v = this.val(x);
    let next = Math.floor(k / 2);
    let n = pq[next]!;
    while (this.val(n) < v) {
      pq[k] = n;
      this.idxs[n] = k;
      k = next;
      next = Math.floor(next / 2);
      n = pq[next]!;
    }
    pq[k] = x;
    this.idxs[x] = k;
  }

  insert(np: number): boolean {
    if (this.cnt === this.size) return true; // overflow
    this.cnt++;
    this.pq[this.cnt] = np;
    this.upheap(this.cnt);
    return false;
  }

  private downheap(kIn: number): void {
    const { pq } = this;
    let k = kIn;
    const x = pq[k]!;
    const v = this.val(x);
    const lim = Math.floor(this.cnt / 2);
    while (k <= lim) {
      let j = k + k;
      let n = pq[j]!;
      if (j < this.cnt && this.val(n) < this.val(pq[j + 1]!)) {
        j++;
        n = pq[j]!;
      }
      if (v >= this.val(n)) break;
      pq[k] = n;
      this.idxs[n] = k;
      k = j;
    }
    pq[k] = x;
    this.idxs[x] = k;
  }

  remove(): number {
    if (this.cnt === 0) return -1;
    const n = this.pq[1]!;
    this.pq[1] = this.pq[this.cnt]!;
    this.cnt--;
    if (this.cnt > 0) this.downheap(1);
    return n;
  }

  update(n: number, d: number): void {
    this.vals[n] = d;
    this.upheap(this.idxs[n]!);
  }
}

/**
 * Shortest triangle path from v0 to v1; the result vector encodes the path
 * v1, dad[v1], ..., v0. Null on heap overflow (cannot happen at our sizes).
 * @see multispline.c:triPath
 */
export function triPath(g: Tgraph, n: number, v0: number, v1: number): number[] | null {
  const dad = new Array<number>(n).fill(0);
  const pq = new Fpq(n);

  dad[v0] = -1;
  pq.vals[v0] = 0;
  if (pq.insert(v0)) return null;

  let i;
  while ((i = pq.remove()) !== -1) {
    pq.vals[i]! *= -1;
    if (i === v1) break;
    const np = g.nodes[i]!;
    for (const k of np.edges) {
      const e = g.edges[k]!;
      const adjn = e.t === i ? e.h : e.t;
      if (pq.vals[adjn]! < 0) {
        const d = -(pq.vals[i]! + e.dist);
        if (pq.vals[adjn] === UNSEEN) {
          pq.vals[adjn] = d;
          dad[adjn] = i;
          if (pq.insert(adjn)) return null;
        } else if (pq.vals[adjn]! < d) {
          pq.update(adjn, d);
          dad[adjn] = i;
        }
      }
    }
  }
  return dad;
}
