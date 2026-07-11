// SPDX-License-Identifier: EPL-2.0

/**
 * Polyomino-based rectangle packing algorithm.
 *
 * Based on "Disconnected Graph Layout and the Polyomino Packing Approach",
 * K. Freivalds et al., GD'01, LNCS 2265, pp. 378-391.
 *
 * @see lib/pack/pack.c:polyRects
 * @see lib/pack/pack.c:computeStep
 * @see lib/pack/pack.c:placeGraph
 * @see lib/pack/pack.c:fits
 */

import type { Box, Point } from '../../model/geom.js';
import type { PackInfo } from './types.js';
import { spiralSearch } from './spiral-search.js';
import { gvQsort } from '../../util/bsd-qsort.js';

/** Max average polyomino size constant. @see lib/pack/pack.c:C */
const C = 100;

/** Grid cell coverage info for one rectangle. */
export interface GInfo {
  perim: number;
  cells: Point[];
  index: number;
}

/** A set of occupied grid cells (string-keyed for O(1) lookup). */
export type PointSet = Set<string>;

/** Encode a grid point as a canonical string key. */
export function psKey(x: number, y: number): string {
  return `${Math.round(x)},${Math.round(y)}`;
}

/** Check if a cell is in the point set. @see lib/pack/pack.c:inPS */
export function inPS(ps: PointSet, p: Point): boolean {
  return ps.has(psKey(p.x, p.y));
}

/** Insert a cell into the point set. @see lib/pack/pack.c:insertPS */
export function insertPS(ps: PointSet, p: Point): void {
  ps.add(psKey(p.x, p.y));
}

/**
 * Compute the polyomino grid step size (positive root of quadratic).
 *
 * @see lib/pack/pack.c:computeStep
 */
export function computeStep(ng: number, bbs: Box[], margin: number): number {
  let b = 0;
  let c = 0;
  const a = C * ng - 1;
  for (let i = 0; i < ng; i++) {
    const bb = bbs[i];
    if (bb === undefined) continue;
    const W = bb.ur.x - bb.ll.x + 2 * margin;
    const H = bb.ur.y - bb.ll.y + 2 * margin;
    b -= W + H;
    c -= W * H;
  }
  const d = b * b - 4.0 * a * c;
  if (d < 0) return 1;
  const root = Math.floor((-b + Math.sqrt(d)) / (2 * a));
  return root <= 0 ? 1 : root;
}

/**
 * Number of grid cells required to cover length x at cell size s.
 *
 * @see lib/pack/pack.c:GRID
 */
export function gridCells(x: number, s: number): number {
  return Math.ceil(x / s);
}

/**
 * Grid cell index containing coordinate v at cell size s.
 *
 * C's `CVAL` macro is applied to the DOUBLE `pointf` fields inside `CELL`
 * (genBox), so the division is floating-point — it yields a fractional cell
 * coordinate that genBox then rounds (see {@link cround}). Modelling it with
 * integer/truncating division (the previous `Math.floor`/`Math.trunc` form)
 * diverges: e.g. `CVAL(-4, 5)` is `((-4+1)/5)-1 = -1.6` (→ round -2), not
 * `-1`. That shrank every packed box's footprint by a cell on the negative
 * side, packing the osage pack_neato2 grid tighter than native.
 *
 * @see lib/pack/pack.c:CVAL / CELL
 */
export function cval(v: number, s: number): number {
  return v >= 0 ? v / s : (v + 1) / s - 1;
}

/** C `round()`: half away from zero (genBox rounds each CELL coordinate). */
export function cround(v: number): number {
  return v >= 0 ? Math.floor(v + 0.5) : Math.ceil(v - 0.5);
}

/** Parameters for genBox. */
export interface GenBoxParams {
  bb: Box;
  ssize: number;
  margin: number;
  idx: number;
}

/**
 * Generate the grid cell coverage for a bounding box.
 *
 * @see lib/pack/pack.c:genBox
 */
export function genBox(p: GenBoxParams): GInfo {
  const { bb, ssize, margin, idx } = p;
  // C rounds the box corners first, then measures the cell region relative to
  // `center` (always the origin under polyRects/osage): LL = center - margin,
  // UR = center + (roundedWidth/Height) + margin. Each corner is mapped to a
  // grid cell by CELL (CVAL on the double coordinate) and then round()ed.
  // @see lib/pack/pack.c:genBox
  const w = cround(bb.ur.x) - cround(bb.ll.x);
  const h = cround(bb.ur.y) - cround(bb.ll.y);
  const llx = cround(cval(-margin, ssize));
  const lly = cround(cval(-margin, ssize));
  const urx = cround(cval(w + margin, ssize));
  const ury = cround(cval(h + margin, ssize));
  const cells: Point[] = [];
  for (let x = llx; x <= urx; x++) {
    for (let y = lly; y <= ury; y++) {
      cells.push({ x, y });
    }
  }
  const W = gridCells(bb.ur.x - bb.ll.x + 2 * margin, ssize);
  const H = gridCells(bb.ur.y - bb.ll.y + 2 * margin, ssize);
  return { perim: W + H, cells, index: idx };
}

/** Context passed to fits() and placeGraph(). */
export interface PlaceCtx {
  ps: PointSet;
  step: number;
  bbs: Box[];
}

/**
 * Test whether any shifted cell collides with the occupied set.
 * Returns true if there is a collision (polyomino does NOT fit).
 *
 * @see lib/pack/pack.c:fits (collision check loop)
 */
export function hasCollision(cells: Point[], dx: number, dy: number, ps: PointSet): boolean {
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell !== undefined && inPS(ps, { x: cell.x + dx, y: cell.y + dy })) return true;
  }
  return false;
}

/**
 * Mark all shifted cells as occupied in the point set.
 *
 * @see lib/pack/pack.c:fits (cell insertion loop)
 */
export function markCells(cells: Point[], dx: number, dy: number, ps: PointSet): void {
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell !== undefined) insertPS(ps, { x: cell.x + dx, y: cell.y + dy });
  }
}

/**
 * Test if a polyomino fits at (x,y); if so, record placement and fill cells.
 *
 * @see lib/pack/pack.c:fits
 */
export function fits(x: number, y: number, info: GInfo, ctx: PlaceCtx): Point | null {
  if (hasCollision(info.cells, x, y, ctx.ps)) return null;
  const bb = ctx.bbs[info.index];
  if (bb === undefined) return null;
  const place: Point = {
    x: ctx.step * x - Math.round(bb.ll.x),
    y: ctx.step * y - Math.round(bb.ll.y),
  };
  markCells(info.cells, x, y, ctx.ps);
  return place;
}

/**
 * Try centered placement for the first graph (i === 0).
 *
 * @see lib/pack/pack.c:placeGraph (i==0 branch)
 */
export function tryCenter(info: GInfo, ctx: PlaceCtx, margin: number): Point | null {
  const bb = ctx.bbs[info.index];
  if (bb === undefined) return null;
  const W = gridCells(bb.ur.x - bb.ll.x + 2 * margin, ctx.step);
  const H = gridCells(bb.ur.y - bb.ll.y + 2 * margin, ctx.step);
  return fits(-Math.floor(W / 2), -Math.floor(H / 2), info, ctx);
}

/**
 * Search concentric square spiral for a placement of the polyomino.
 *
 * @see lib/pack/pack.c:placeGraph
 */
export function placeGraph(i: number, info: GInfo, ctx: PlaceCtx, margin: number): Point {
  if (i === 0) {
    const p = tryCenter(info, ctx, margin);
    if (p !== null) return p;
  }
  const p0 = fits(0, 0, info, ctx);
  if (p0 !== null) return p0;
  const bb = ctx.bbs[info.index];
  const wide = bb !== undefined &&
    Math.ceil(bb.ur.x - bb.ll.x) >= Math.ceil(bb.ur.y - bb.ll.y);
  return spiralSearch(info, ctx, wide);
}

/**
 * Sort GInfo by descending perimeter.
 *
 * @see lib/pack/pack.c:cmpf
 */
export function cmpByGPerimeter(a: GInfo, b: GInfo): number {
  return b.perim - a.perim;
}

/**
 * Pack rectangles using polyomino placement.
 * Returns translation points indexed by original rectangle index.
 *
 * @see lib/pack/pack.c:polyRects
 */
export function polyRects(ng: number, bbs: Box[], pinfo: PackInfo): Point[] | null {
  const step = computeStep(ng, bbs, pinfo.margin);
  if (step <= 0) return null;
  const infos: GInfo[] = [];
  for (let i = 0; i < ng; i++) {
    const bb = bbs[i];
    if (bb === undefined) continue;
    infos.push(genBox({ bb, ssize: step, margin: pinfo.margin, idx: i }));
  }
  // C `pack.c` sorts these via `qsort(cmpf)` (UNSTABLE); cmpf returns 0 on equal
  // perimeter, so the tie order of equal-perimeter components is decided by libc
  // qsort, not insertion order. Match it. @see util/bsd-qsort.ts
  const sorted = gvQsort([...infos], cmpByGPerimeter);
  const ctx: PlaceCtx = { ps: new Set(), step, bbs };
  const places: Point[] = new Array<Point>(ng).fill({ x: 0, y: 0 });
  for (let i = 0; i < sorted.length; i++) {
    const info = sorted[i];
    if (info === undefined) continue;
    places[info.index] = placeGraph(i, info, ctx, pinfo.margin);
  }
  return places;
}
