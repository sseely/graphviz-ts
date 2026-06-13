// SPDX-License-Identifier: EPL-2.0

/**
 * Split-along-length multi-color edges: a `color="c1;f1:c2;f2"` (semicolon)
 * spec draws each routed spline split along its ARC LENGTH, one sub-curve per
 * color segment. This is C's `multicolor()` path, reached when the color has
 * both ';' and ':' (numsemi && numc); the plain ':' syntax is the parallel
 * branch (svg-parallel-edge.ts).
 *
 * Arrow rule (note: inverse of the parallel branch): tail arrow = FIRST color,
 * head arrow = endcolor (LAST drawn color).
 *
 * @see lib/common/emit.c:1975 multicolor
 * @see lib/common/emit.c:1921 splitBSpline
 * @see lib/common/emit.c:1908 approxLen
 * @see lib/common/utils.c:175 Bezier (de Casteljau split)
 */

import type { Edge } from '../model/edge.js';
import type { RenderJob } from '../gvc/job.js';
import type { Point, Bezier } from '../model/geom.js';
import { parseSegs } from '../common/multicolor.js';
import { transformPoint } from '../gvc/device.js';
import { emitBezierPath, emitDash, emitPenWidth } from './svg-helpers.js';

const DEFAULT_COLOR = 'black';
const PENWIDTH_NORMAL = 1.0;
const PENWIDTH_THRESHOLD = 0.005;
/** AEQ0 tolerance for fraction comparisons. */
const EPS = 1e-5;

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Chord length of one cubic (control points at off..off+3). @see emit.c:1908 */
function approxLen(list: Point[], off: number): number {
  return dist(list[off]!, list[off + 1]!) +
    dist(list[off + 1]!, list[off + 2]!) +
    dist(list[off + 2]!, list[off + 3]!);
}

/**
 * de Casteljau split of a single cubic (control points v[0..3]) at parameter t,
 * returning the left and right 4-point sub-curves. Ports C's Bezier().
 */
function splitCubic(v: Point[], t: number): { left: Point[]; right: Point[] } {
  const u = 1 - t;
  const row = [v[0]!, v[1]!, v[2]!, v[3]!];
  const left: Point[] = [row[0]!];
  const right: Point[] = new Array<Point>(4);
  right[3] = row[3]!;
  for (let i = 1; i <= 3; i++) {
    for (let j = 0; j <= 3 - i; j++) {
      row[j] = { x: u * row[j]!.x + t * row[j + 1]!.x, y: u * row[j]!.y + t * row[j + 1]!.y };
    }
    left.push(row[0]!);
    right[3 - i] = row[3 - i]!;
  }
  return { left, right };
}

/**
 * Split a B-spline (control points, length 3*cnt+1) at arc-length fraction t.
 * @see lib/common/emit.c:1921 splitBSpline
 */
function splitBSpline(list: Point[], t: number): { left: Point[]; right: Point[] } {
  const cnt = (list.length - 1) / 3;
  if (cnt === 1) return splitCubic(list, t);
  const lens: number[] = [];
  let sum = 0;
  for (let i = 0; i < cnt; i++) { lens.push(approxLen(list, 3 * i)); sum += lens[i]!; }
  const target = t * sum;
  sum = 0;
  let i = 0;
  for (; i < cnt; i++) { sum += lens[i]!; if (sum >= target) break; }
  const last = lens[i]!;
  const r = (target - (sum - last)) / last;
  const seg = splitCubic(list.slice(3 * i, 3 * i + 4), r);
  return {
    left: list.slice(0, 3 * i).concat(seg.left),
    right: seg.right.concat(list.slice(3 * i + 4)),
  };
}

/** Emit one sub-curve as an SVG path in the given color (style from obj). */
function emitCurve(list: Point[], color: string, job: RenderJob): void {
  const obj = job.obj;
  const pts = list.map((p) => transformPoint(p, job));
  job.write('<path fill="none" stroke="' + color + '"');
  if (obj !== null && Math.abs(obj.penWidth - PENWIDTH_NORMAL) >= PENWIDTH_THRESHOLD) {
    emitPenWidth(job, obj.penWidth);
  }
  if (obj !== null) emitDash(job, obj.pen);
  job.write(' d="');
  emitBezierPath(job, pts);
  job.write('"/>\n');
}

interface ColorSeg { color: string | null; t: number; }

/** Running state for one spline's length-split walk. */
interface SplitState { left: number; first: boolean; bzR: Point[]; done: boolean; endColor: string; }

/** Apply one color segment: split off its length share and emit the sub-curve. */
function stepSegment(list: Point[], s: ColorSeg, st: SplitState, job: RenderJob): void {
  if (Math.abs(s.t) < EPS) return;
  const color = s.color ?? DEFAULT_COLOR;
  st.left -= s.t;
  st.endColor = color;
  if (st.first) {
    st.first = false;
    const sp = splitBSpline(list, s.t);
    emitCurve(sp.left, color, job);
    st.bzR = sp.right;
    if (Math.abs(st.left) < EPS) st.done = true;
  } else if (Math.abs(st.left) < EPS) {
    emitCurve(st.bzR, color, job);
    st.done = true;
  } else {
    const sp = splitBSpline(st.bzR, s.t / (st.left + s.t));
    emitCurve(sp.left, color, job);
    st.bzR = sp.right;
  }
}

/** Draw one spline split along its length per the color segments; return endcolor. */
function drawSplitSpline(list: Point[], segs: ColorSeg[], job: RenderJob): string {
  const st: SplitState = { left: 1, first: true, bzR: list, done: false, endColor: DEFAULT_COLOR };
  for (const s of segs) {
    stepSegment(list, s, st, job);
    if (st.done) break;
  }
  return st.endColor;
}

/**
 * Emit a split-along-length multi-color edge. Returns the first and end colors
 * for arrow drawing (tail = first, head = end).
 * @see lib/common/emit.c:1975 multicolor
 */
export function emitSplitEdgePaths(
  e: Edge,
  job: RenderJob,
  colorList: string,
): { firstColor: string; endColor: string } {
  const segs = parseSegs(colorList).segs;
  const firstColor = segs[0]?.color ?? DEFAULT_COLOR;
  const spl = e.info.spl;
  let endColor = firstColor;
  if (spl === undefined) return { firstColor, endColor };
  for (let si = 0; si < spl.size; si++) {
    const bz = spl.list[si] as Bezier | undefined;
    if (bz === undefined || bz.size < 4) continue;
    endColor = drawSplitSpline(bz.list, segs, job);
  }
  return { firstColor, endColor };
}
