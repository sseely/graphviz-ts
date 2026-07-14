// SPDX-License-Identifier: EPL-2.0

/**
 * Polyomino-based packing of laid-out graphs (components), a port of
 * the l_node/l_clust/l_graph modes of putGraphs.
 *
 * Each graph is approximated by the set of grid cells ("polyomino")
 * covered by its nodes and edges (or its bounding box in l_graph
 * mode); polyominoes are then placed largest-first on concentric
 * rings around the origin.
 *
 * @see lib/pack/pack.c (Freivalds et al., GD 2002 polyomino packing)
 */

import type { Box, Point } from '../../model/geom.js';
import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { PackInfo } from './types.js';
import { PackMode } from './types.js';
import { cround } from '../../common/arith.js';
import { gvQsort } from '../../util/bsd-qsort.js';

/** Max. avg. polyomino size. @see lib/pack/pack.c:C */
const C_AVG = 100;

/** Cells required by size x at cell size s. @see lib/pack/pack.c:GRID */
function grid(x: number, s: number): number {
  return Math.ceil(x / s);
}

/** Cell index of coordinate v (double arithmetic). @see lib/pack/pack.c:CVAL */
function cval(v: number, s: number): number {
  return v >= 0 ? v / s : (v + 1) / s - 1;
}

/** Map a point to its containing cell. @see lib/pack/pack.c:CELL */
function cell(p: Point, s: number): Point {
  return { x: cval(p.x, s), y: cval(p.y, s) };
}

/** Integer point set. @see lib/common/pointset.c */
class PointSet {
  private readonly m = new Map<string, Point>();
  add(x: number, y: number): void {
    this.m.set(`${x},${y}`, { x, y });
  }
  has(p: Point): boolean {
    return this.m.has(`${p.x},${p.y}`);
  }
  points(): Point[] {
    return [...this.m.values()];
  }
  get size(): number {
    return this.m.size;
  }
}

/** Polyomino info for one graph. @see lib/pack/pack.c:ginfo */
interface GInfo {
  perim: number;
  cells: Point[];
  index: number;
}

/**
 * Grid step size: positive root of the quadratic over total cell area.
 * @see lib/pack/pack.c:computeStep
 */
export function computeStep(bbs: Box[], margin: number): number {
  const a = C_AVG * bbs.length - 1;
  let b = 0;
  let c = 0;
  for (const bb of bbs) {
    const W = bb.ur.x - bb.ll.x + 2 * margin;
    const H = bb.ur.y - bb.ll.y + 2 * margin;
    b -= W + H;
    c -= W * H;
  }
  const r = Math.sqrt(b * b - 4 * a * c);
  const root = Math.trunc((-b + r) / (2 * a));
  return root === 0 ? 1 : root;
}

/** Bresenham state for one rasterised line. */
interface LineState {
  x: number; y: number; x2: number; y2: number;
  ax: number; ay: number; sx: number; sy: number;
}

/** X-dominant Bresenham sweep. @see pack.c:fillLine */
function lineXDominant(st: LineState, ps: PointSet): void {
  let d = st.ay - (st.ax >> 1);
  for (;;) {
    ps.add(st.x, st.y);
    if (st.x === st.x2) return;
    if (d >= 0) { st.y += st.sy; d -= st.ax; }
    st.x += st.sx;
    d += st.ay;
  }
}

/** Y-dominant Bresenham sweep. @see pack.c:fillLine */
function lineYDominant(st: LineState, ps: PointSet): void {
  let d = st.ax - (st.ay >> 1);
  for (;;) {
    ps.add(st.x, st.y);
    if (st.y === st.y2) return;
    if (d >= 0) { st.x += st.sx; d -= st.ay; }
    st.y += st.sy;
    d += st.ax;
  }
}

/** Mark cells crossed by the cell-space line p-q (Bresenham). @see pack.c:fillLine */
function fillLine(p: Point, q: Point, ps: PointSet): void {
  const x = cround(p.x);
  const y = cround(p.y);
  const x2 = cround(q.x);
  const y2 = cround(q.y);
  const dx = x2 - x;
  const dy = y2 - y;
  const st: LineState = {
    x, y, x2, y2,
    ax: Math.abs(dx) << 1, ay: Math.abs(dy) << 1,
    sx: dx > 0 ? 1 : -1, sy: dy > 0 ? 1 : -1,
  };
  if (st.ax > st.ay) lineXDominant(st, ps);
  else lineYDominant(st, ps);
}

/** Mark all cells in the inclusive cell-rect [LL, UR]. */
function fillRect(LL: Point, UR: Point, ps: PointSet): void {
  for (let x = LL.x; x <= UR.x; x++) {
    for (let y = LL.y; y <= UR.y; y++) ps.add(x, y);
  }
}

/** Rounded cell for a translated point. */
function roundedCell(p: Point, ssize: number): Point {
  const c = cell(p, ssize);
  return { x: cround(c.x), y: cround(c.y) };
}

/**
 * Mark cells crossed by edge e as a straight tail-to-head line.
 * Spline-following (doSplines) is not exercised by any packing caller
 * yet (pinfo.doSplines is false in twopi/neato component packing).
 * @see lib/pack/pack.c:fillEdge
 */
function fillEdge(e: Edge, pt: Point, ps: PointSet, off: Point, ssize: number): void {
  const hc = e.head.info.coord ?? { x: 0, y: 0 };
  const hpt = roundedCell({ x: hc.x + off.x, y: hc.y + off.y }, ssize);
  fillLine(pt, hpt, ps);
}

/**
 * Polyomino from a graph's bounding box only (l_graph mode).
 * @see lib/pack/pack.c:genBox
 */
function genBox(bb0: Box, ssize: number, margin: number, center: Point): GInfo {
  const ps = new PointSet();
  const bbW = cround(bb0.ur.x) - cround(bb0.ll.x);
  const bbH = cround(bb0.ur.y) - cround(bb0.ll.y);
  const LL = roundedCell({ x: center.x - margin, y: center.y - margin }, ssize);
  const UR = roundedCell({ x: center.x + bbW + margin, y: center.y + bbH + margin }, ssize);
  fillRect(LL, UR, ps);
  return {
    cells: ps.points(),
    perim: grid(bb0.ur.x - bb0.ll.x + 2 * margin, ssize)
      + grid(bb0.ur.y - bb0.ll.y + 2 * margin, ssize),
    index: 0,
  };
}

/** Shared cover-pass parameters. */
interface CoverCtx {
  eg: Graph;
  ps: PointSet;
  off: Point;
  ssize: number;
  margin: number;
}

/** Cover one node's box and its out-edges. @see pack.c:genPoly (node loop body) */
function coverNode(n: Node, ctx: CoverCtx): void {
  const c = n.info.coord ?? { x: 0, y: 0 };
  const pt = { x: cround(c.x) + ctx.off.x, y: cround(c.y) + ctx.off.y };
  const s2 = {
    x: cround(ctx.margin + (n.info.lw + n.info.rw) / 2),
    y: cround(ctx.margin + n.info.ht / 2),
  };
  const LL = roundedCell({ x: pt.x - s2.x, y: pt.y - s2.y }, ctx.ssize);
  const UR = roundedCell({ x: pt.x + s2.x, y: pt.y + s2.y }, ctx.ssize);
  fillRect(LL, UR, ctx.ps);
  const cpt = roundedCell(pt, ctx.ssize);
  for (const e of n.outEdges(ctx.eg)) fillEdge(e, cpt, ctx.ps, ctx.off, ctx.ssize);
}

/**
 * Polyomino from a graph's nodes and edges (l_node mode; the l_clust
 * top-cluster special case is not ported — no packing caller has
 * clusters inside components yet).
 * @see lib/pack/pack.c:genPoly
 */
function genPoly(
  root: Graph, g: Graph, bb: Box, ssize: number, pinfo: PackInfo,
): GInfo {
  const ps = new PointSet();
  const ctx: CoverCtx = {
    eg: root,
    ps,
    off: { x: -cround(bb.ll.x), y: -cround(bb.ll.y) },
    ssize,
    margin: pinfo.margin,
  };
  for (const n of g.nodes.values()) coverNode(n, ctx);
  return {
    cells: ps.points(),
    perim: grid(bb.ur.x - bb.ll.x + 2 * pinfo.margin, ssize)
      + grid(bb.ur.y - bb.ll.y + 2 * pinfo.margin, ssize),
    index: 0,
  };
}

/**
 * Try the polyomino at cell (x, y); on success occupy the cells and
 * record the placement offset.
 * @see lib/pack/pack.c:fits
 */
/** Shared placement state. */
interface PlaceCtx {
  ps: PointSet;
  places: Point[];
  step: number;
  margin: number;
  bbs: Box[];
}

function fits(x: number, y: number, info: GInfo, ctx: PlaceCtx): boolean {
  for (const c of info.cells) {
    if (ctx.ps.has({ x: c.x + x, y: c.y + y })) return false;
  }
  const bb = ctx.bbs[info.index]!;
  const LL = { x: cround(bb.ll.x), y: cround(bb.ll.y) };
  ctx.places[info.index] = { x: ctx.step * x - LL.x, y: ctx.step * y - LL.y };
  for (const c of info.cells) ctx.ps.add(c.x + x, c.y + y);
  return true;
}

/** Ring candidates for wide graphs (W >= H). @see pack.c:placeGraph */
function* ringWide(bnd: number): Generator<[number, number]> {
  let x = 0;
  let y = -bnd;
  for (; x < bnd; x++) yield [x, y];
  for (; y < bnd; y++) yield [x, y];
  for (; x > -bnd; x--) yield [x, y];
  for (; y > -bnd; y--) yield [x, y];
  for (; x < 0; x++) yield [x, y];
}

/** Ring candidates for tall graphs (W < H). @see pack.c:placeGraph */
function* ringTall(bnd: number): Generator<[number, number]> {
  let y = 0;
  let x = -bnd;
  for (; y > -bnd; y--) yield [x, y];
  for (; x < bnd; x++) yield [x, y];
  for (; y < bnd; y++) yield [x, y];
  for (; x > -bnd; x--) yield [x, y];
  for (; y > 0; y--) yield [x, y];
}

/**
 * Place one polyomino on concentric rings out from the origin; the
 * first (largest) graph is centered on the origin when possible.
 * @see lib/pack/pack.c:placeGraph
 */
function placeGraph(i: number, info: GInfo, ctx: PlaceCtx): void {
  const bb = ctx.bbs[info.index]!;
  if (i === 0) {
    const W = grid(bb.ur.x - bb.ll.x + 2 * ctx.margin, ctx.step);
    const H = grid(bb.ur.y - bb.ll.y + 2 * ctx.margin, ctx.step);
    if (fits(-Math.trunc(W / 2), -Math.trunc(H / 2), info, ctx)) return;
  }
  if (fits(0, 0, info, ctx)) return;
  const wide = Math.ceil(bb.ur.x - bb.ll.x) >= Math.ceil(bb.ur.y - bb.ll.y);
  for (let bnd = 1; ; bnd++) {
    const ring = wide ? ringWide(bnd) : ringTall(bnd);
    for (const [x, y] of ring) {
      if (fits(x, y, info, ctx)) return;
    }
  }
}

/**
 * Polyomino packing of pre-laid-out graphs. Returns the translation
 * point for each graph (indexed like gs). The pinfo.fixed protocol is
 * not ported (no caller passes fixed graphs yet).
 * @see lib/pack/pack.c:polyGraphs
 */
export function polyGraphs(
  gs: Graph[], root: Graph, pinfo: PackInfo, bbs: Box[],
): Point[] | null {
  if (gs.length === 0) return null;
  const stepSize = computeStep(bbs, pinfo.margin);
  if (stepSize <= 0) return null;
  const center = { x: 0, y: 0 };
  const info: GInfo[] = gs.map((g, i) => {
    const gi = pinfo.mode === PackMode.Graph
      ? genBox(bbs[i]!, stepSize, pinfo.margin, center)
      : genPoly(root, g, bbs[i]!, stepSize, pinfo);
    gi.index = i;
    return gi;
  });
  // descending by perimeter (C qsort with flipped comparator); cmpf returns 0 on
  // equal perimeter, so the tie order is qsort's, not insertion order. @see util/bsd-qsort.ts
  const sinfo = gvQsort([...info], (a, b) => b.perim - a.perim);
  const ctx: PlaceCtx = {
    ps: new PointSet(),
    places: gs.map(() => ({ x: 0, y: 0 })),
    step: stepSize,
    margin: pinfo.margin,
    bbs,
  };
  for (let i = 0; i < sinfo.length; i++) {
    placeGraph(i, sinfo[i]!, ctx);
  }
  return ctx.places;
}
