// SPDX-License-Identifier: EPL-2.0

/**
 * Parallel multi-color Bézier edge emission (M1).
 *
 * Ports the `else if (numc)` branch of emit_edge_graphics from
 * lib/common/emit.c:2442-2528.  Each color in a "c1:c2:…" color-list
 * produces one Bézier path offset SEP=2.0 graph-units perpendicular to
 * the routed spline.  Arrow colors follow C's headcolor/tailcolor rule:
 * headcolor = first color (cnum 0), tailcolor = second color (cnum 1, else
 * same as headcolor).
 *
 * AD1: per-curve pen flows through job.obj (caller sets penColor before
 *      each curve; we mutate obj.penColor here so the T4 path emitters see
 *      the right color).
 * AD4: caller passes the raw color-list string; numc is computed here.
 *
 * @see lib/common/emit.c:2442 (else if numc branch)
 * @see lib/common/emit.c:2364 (#define SEP 2.0)
 * @see lib/common/emit.c:2481-2496 (headcolor/tailcolor assignment)
 */

import type { Edge } from '../model/edge.js';
import type { RenderJob } from '../gvc/job.js';
import type { Point, Bezier } from '../model/geom.js';
import { buildOffsetLists, advanceTmpList } from '../common/edge-offset.js';
import { transformPoint } from '../gvc/device.js';
import { emitBezierPath, emitDash, emitPenWidth } from './svg-helpers.js';
import { resolveRenderColor, colorPaint, colorOpacity } from './color-resolve.js';
import { parseSegs } from '../common/multicolor.js';

const PENWIDTH_NORMAL = 1.0;
const PENWIDTH_THRESHOLD = 0.005;
const DEFAULT_COLOR = 'black';

/** Return value carrying the head/tail arrow colors for the caller. */
export interface ParallelEdgeResult {
  headColor: string;
  tailColor: string;
}

/**
 * Emit one offset Bézier path for a single color in the parallel-curve loop.
 * Mutates job.obj.penColor so subsequent arrow emitters see the right color.
 * @see lib/common/emit.c:2501-2506
 */
function emitOffsetBezier(tmplist: Point[], job: RenderJob, color: string): void {
  const obj = job.obj;
  const resolved = resolveRenderColor(color);
  if (obj !== null) {
    obj.penColor = resolved;
  }
  job.write('<path fill="none" stroke="' + colorPaint(resolved) + '"');
  if (obj !== null && Math.abs(obj.penWidth - PENWIDTH_NORMAL) >= PENWIDTH_THRESHOLD) {
    emitPenWidth(job, obj.penWidth);
  }
  if (obj !== null) emitDash(job, obj.pen);
  // C svg_grstyle emits stroke-opacity (after stroke-width/dasharray) for an
  // RGBA paint with partial alpha, e.g. an edge color="#rrggbbaa".
  // @see plugin/core/gvrender_core_svg.c:207-210 svg_grstyle
  const op = colorOpacity(resolved);
  if (op !== null) job.write(' stroke-opacity="' + op + '"');
  job.write(' d="');
  emitBezierPath(job, tmplist);
  job.write('"/>\n');
}

/**
 * Emit parallel offset Bézier curves, one per color in `colorList`.
 * Returns the head and tail arrow colors so the caller can emit arrows.
 *
 * Algorithm (ports emit.c:2442-2528):
 *  1. numc = count of ':' in colorList; numc2 = (2+numc)/2
 *  2. For each bezier segment, compute offlist + init tmplist to outermost lane
 *  3. For each color token (cnum=0,1,…): advance tmplist by one offset step,
 *     emit path in that color; set headColor (cnum==0), tailColor (cnum==1).
 *
 * @see lib/common/emit.c:2442-2528
 */
type SegLists = { offlist: Point[]; tmplist: Point[] };

/** Pre-build per-segment offset + working lists (graph/pre-transform space). */
function buildSegData(bzList: (Bezier | undefined)[], numc2: number): SegLists[] {
  const segData: SegLists[] = [];
  for (const bz of bzList) {
    if (bz === undefined || bz.size < 4) {
      segData.push({ offlist: [], tmplist: [] });
      continue;
    }
    segData.push(buildOffsetLists(bz.list, numc2));
  }
  return segData;
}

/** Emit one parallel offset curve per color, advancing the working list each pass. */
function emitColorPasses(segData: SegLists[], colors: string[], job: RenderJob): void {
  for (const color of colors) {
    for (const sd of segData) {
      if (sd.offlist.length === 0) continue;
      advanceTmpList(sd.tmplist, sd.offlist);
      emitOffsetBezier(sd.tmplist.map((p) => transformPoint(p, job)), job, color);
    }
  }
}

export function emitParallelEdgePaths(
  e: Edge,
  job: RenderJob,
  colorList: string,
): ParallelEdgeResult {
  const spl = e.info.spl;
  const numc = (colorList.match(/:/g) ?? []).length;
  const segData = buildSegData((spl?.list ?? []) as (Bezier | undefined)[], (2 + numc) / 2);
  // parseSegs strips any ';weight', so the semicolon syntax (which C routes
  // to split-along-length multicolor — a follow-up) at least yields valid
  // parallel colors instead of an invalid "red;0.5" stroke.
  const colors = parseSegs(colorList).segs.map((s) => s.color ?? DEFAULT_COLOR);
  emitColorPasses(segData, colors, job);
  return {
    headColor: colors[0] ?? DEFAULT_COLOR,
    tailColor: colors[1] ?? colors[0] ?? DEFAULT_COLOR,
  };
}
