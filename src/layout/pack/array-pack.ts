// SPDX-License-Identifier: EPL-2.0

/**
 * Array-based rectangle packing algorithm.
 *
 * @see lib/pack/pack.c:arrayRects
 */

import type { Box, Point } from '../../model/geom.js';
import {
  type PackInfo,
  PK_COL_MAJOR,
  PK_INPUT_ORDER,
  PK_USER_VALS,
  PK_LEFT_ALIGN,
  PK_RIGHT_ALIGN,
  PK_TOP_ALIGN,
  PK_BOT_ALIGN,
} from './types.js';
import { gvQsort } from '../../util/bsd-qsort.js';
import { cround } from '../../common/arith.js';

/** Internal info for one rectangle during array packing. */
export interface AInfo {
  width: number;
  height: number;
  index: number;
}

/** Grid layout dimensions. */
export interface GridDims {
  nc: number;
  nr: number;
  rowMajor: boolean;
}

/** Mutable column/row cursor for grid traversal. */
export interface GridCursor {
  col: { val: number };
  row: { val: number };
}

/**
 * Advance a grid cursor by one cell.
 *
 * @see lib/pack/pack.c:INC
 */
export function inc(cursor: GridCursor, dims: GridDims): void {
  if (dims.rowMajor) {
    if (++cursor.col.val === dims.nc) { cursor.col.val = 0; cursor.row.val++; }
  } else {
    if (++cursor.row.val === dims.nr) { cursor.row.val = 0; cursor.col.val++; }
  }
}

/**
 * Compute grid dimensions and row-major flag from pinfo.
 *
 * @see lib/pack/pack.c:arrayRects (grid setup block)
 */
export function computeGrid(ng: number, pinfo: PackInfo): GridDims {
  const sz = pinfo.sz;
  if (pinfo.flags & PK_COL_MAJOR) {
    const nr = sz > 0 ? sz : Math.ceil(Math.sqrt(ng));
    return { nc: Math.ceil(ng / nr), nr, rowMajor: false };
  }
  const nc = sz > 0 ? sz : Math.ceil(Math.sqrt(ng));
  return { nc, nr: Math.ceil(ng / nc), rowMajor: true };
}

/**
 * Build AInfo array from bounding boxes.
 *
 * @see lib/pack/pack.c:arrayRects (ainfo construction)
 */
export function buildAInfo(ng: number, gs: Box[], margin: number): AInfo[] {
  const info: AInfo[] = [];
  for (let i = 0; i < ng; i++) {
    const bb = gs[i];
    if (bb === undefined) continue;
    info.push({
      width: bb.ur.x - bb.ll.x + margin,
      height: bb.ur.y - bb.ll.y + margin,
      index: i,
    });
  }
  return info;
}

/**
 * Sort comparator: ascending by user vals[index].
 *
 * @see lib/pack/pack.c:ucmpf
 */
export function cmpByUserVals(a: AInfo, b: AInfo, vals: number[]): number {
  return (vals[a.index] ?? 0) - (vals[b.index] ?? 0);
}

/**
 * Sort comparator: descending by width+height.
 *
 * @see lib/pack/pack.c:acmpf
 */
export function cmpByPerimeter(a: AInfo, b: AInfo): number {
  return (b.height + b.width) - (a.height + a.width);
}

/**
 * Sort AInfo array according to pinfo sort flags.
 *
 * @see lib/pack/pack.c:arrayRects (sort block)
 */
export function sortAInfo(info: AInfo[], pinfo: PackInfo): AInfo[] {
  const sinfo = [...info];
  // C arrayRects sorts via gv_sort(ucmpf)/qsort(acmpf) — both libc qsort
  // (gv_sort is a qsort_r wrapper), UNSTABLE. Both comparators return 0 on a
  // tie (equal user-val, or equal height+width), so equal components' order is
  // decided by qsort, not insertion order. @see util/bsd-qsort.ts · pack.c:arrayRects
  if ((pinfo.flags & PK_USER_VALS) && pinfo.vals !== null) {
    const vals = pinfo.vals;
    gvQsort(sinfo, (a, b) => cmpByUserVals(a, b, vals));
  } else if (!(pinfo.flags & PK_INPUT_ORDER)) {
    gvQsort(sinfo, cmpByPerimeter);
  }
  return sinfo;
}

/**
 * Accumulate max width per column and max height per row from sorted info.
 *
 * @see lib/pack/pack.c:arrayRects (column/row max pass)
 */
export function accumulateMaxima(
  sinfo: AInfo[],
  widths: number[],
  heights: number[],
  dims: GridDims,
): void {
  const cursor: GridCursor = { col: { val: 0 }, row: { val: 0 } };
  for (const ip of sinfo) {
    widths[cursor.col.val] = Math.max(widths[cursor.col.val] ?? 0, ip.width);
    heights[cursor.row.val] = Math.max(heights[cursor.row.val] ?? 0, ip.height);
    inc(cursor, dims);
  }
}

/**
 * Convert widths to cumulative x positions (left to right).
 *
 * @see lib/pack/pack.c:arrayRects (widths prefix-sum)
 */
export function widthsToCumulative(widths: number[]): void {
  let wd = 0;
  for (let i = 0; i < widths.length; i++) {
    const v = widths[i] ?? 0;
    widths[i] = wd;
    wd += v;
  }
}

/**
 * Convert heights to cumulative y positions (bottom to top).
 *
 * @see lib/pack/pack.c:arrayRects (heights prefix-sum)
 */
export function heightsToCumulative(heights: number[], nr: number): void {
  let ht = 0;
  for (let i = nr; i > 0; i--) {
    const v = heights[i - 1] ?? 0;
    heights[i] = ht;
    ht += v;
  }
  heights[0] = ht;
}

/**
 * Compute x placement for one rect using alignment flags.
 *
 * @see lib/pack/pack.c:arrayRects (placement x)
 */
export function placeX(flags: number, widths: number[], col: number, bb: Box): number {
  const w0 = widths[col] ?? 0;
  const w1 = widths[col + 1] ?? 0;
  // C round(): half away from zero. The right-aligned and centred forms are
  // negative whenever the rect overhangs its column, and the /2.0 centring puts
  // an exact .5 on the table for any odd slack. @see lib/pack/pack.c:693-698
  if (flags & PK_LEFT_ALIGN) return cround(w0);
  if (flags & PK_RIGHT_ALIGN) return cround(w1 - (bb.ur.x - bb.ll.x));
  return cround((w0 + w1 - bb.ur.x - bb.ll.x) / 2.0);
}

/**
 * Compute y placement for one rect using alignment flags.
 *
 * @see lib/pack/pack.c:arrayRects (placement y)
 */
export function placeY(flags: number, heights: number[], row: number, bb: Box): number {
  const h0 = heights[row] ?? 0;
  const h1 = heights[row + 1] ?? 0;
  // C round(): half away from zero. @see lib/pack/pack.c:700-705
  if (flags & PK_TOP_ALIGN) return cround(h0 - (bb.ur.y - bb.ll.y));
  if (flags & PK_BOT_ALIGN) return cround(h1);
  return cround((h0 + h1 - bb.ur.y - bb.ll.y) / 2.0);
}

/** Accumulated position tables for array packing. */
interface PosTables {
  widths: number[];
  heights: number[];
}

/**
 * Position rects into the places array using sorted info and cumulative tables.
 *
 * @see lib/pack/pack.c:arrayRects (position rects block)
 */
export function positionRects(
  sinfo: AInfo[],
  gs: Box[],
  flags: number,
  tables: PosTables,
  dims: GridDims,
): Point[] {
  const places: Point[] = new Array<Point>(gs.length).fill({ x: 0, y: 0 });
  const cursor: GridCursor = { col: { val: 0 }, row: { val: 0 } };
  for (const ip of sinfo) {
    const bb = gs[ip.index];
    if (bb !== undefined) {
      places[ip.index] = {
        x: placeX(flags, tables.widths, cursor.col.val, bb),
        y: placeY(flags, tables.heights, cursor.row.val, bb),
      };
    }
    inc(cursor, dims);
  }
  return places;
}

/**
 * Pack rectangles into an array layout.
 * Returns translation points indexed by original rectangle index.
 *
 * @see lib/pack/pack.c:arrayRects
 */
export function arrayRects(ng: number, gs: Box[], pinfo: PackInfo): Point[] | null {
  const dims = computeGrid(ng, pinfo);
  const sinfo = sortAInfo(buildAInfo(ng, gs, pinfo.margin), pinfo);
  const widths = new Array<number>(dims.nc + 1).fill(0);
  const heights = new Array<number>(dims.nr + 1).fill(0);
  accumulateMaxima(sinfo, widths, heights, dims);
  widthsToCumulative(widths);
  heightsToCumulative(heights, dims.nr);
  return positionRects(sinfo, gs, pinfo.flags, { widths, heights }, dims);
}
