// SPDX-License-Identifier: EPL-2.0

/**
 * SVG gradient emitters — ports svg_print_stop, svg_gradstyle, svg_rgradstyle
 * and get_gradient_points. Separate module to keep svg-helpers.ts < 500 lines (AD5).
 * @see plugin/core/gvrender_core_svg.c:553 (svg_print_stop)
 * @see plugin/core/gvrender_core_svg.c:572 (svg_gradstyle)
 * @see plugin/core/gvrender_core_svg.c:608 (svg_rgradstyle)
 * @see lib/common/utils.c:1446 (get_gradient_points)
 */

import type { Point } from '../model/geom.js';
import type { GVColor } from '../common/color.js';
import type { RenderJob } from '../gvc/job.js';
import { escapeXml } from './svg-helpers.js';
import { cround } from '../common/arith.js';

interface GradientPoints { g0: Point; g1: Point; }
interface BBox { minX: number; maxX: number; minY: number; maxY: number; }

/** Bounding box for 2-point (center+corner) ellipse input. */
function bboxFrom2(A: Point[]): BBox {
  const rx = (A[1] as Point).x - (A[0] as Point).x;
  const ry = (A[1] as Point).y - (A[0] as Point).y;
  return {
    minX: (A[0] as Point).x - rx, maxX: (A[0] as Point).x + rx,
    minY: (A[0] as Point).y - ry, maxY: (A[0] as Point).y + ry,
  };
}
/** Bounding box by scanning all points. */
function bboxFromN(A: Point[]): BBox {
  let minX = (A[0] as Point).x, maxX = (A[0] as Point).x;
  let minY = (A[0] as Point).y, maxY = (A[0] as Point).y;
  for (let i = 1; i < A.length; i++) {
    const p = A[i] as Point;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}
/** Radial points from bbox, LHS (isRHS=0). @see lib/common/utils.c:1478 */
function radialPoints(bb: BBox, cx: number, cy: number): GradientPoints {
  const outerR = Math.hypot(cx - bb.minX, cy - bb.minY);
  return { g0: { x: cx, y: -cy }, g1: { x: outerR / 4, y: outerR } };
}
/** Linear points from bbox+angle, LHS (isRHS=0). @see lib/common/utils.c:1487 */
function linearPoints(bb: BBox, cx: number, cy: number, angle: number): GradientPoints {
  const halfX = bb.maxX - cx;
  const sina = Math.sin(angle), cosa = Math.cos(angle);
  return {
    g0: { x: cx - halfX * cosa, y: -cy + (bb.maxY - cy) * sina },
    g1: { x: cx + halfX * cosa, y: -cy - (cy - bb.minY) * sina },
  };
}

/**
 * Compute gradient endpoints in y-up (Graphviz) space. SVG LHS (isRHS=0).
 * Linear: g0/g1 = endpoints. Radial: g0=(cx,-cy), g1=(inner_r,outer_r).
 * @see lib/common/utils.c:1446 get_gradient_points
 */
export function getGradientPoints(A: Point[], angle: number, radial: boolean): GradientPoints {
  const bb = A.length === 2 ? bboxFrom2(A) : bboxFromN(A);
  const cx = bb.minX + (bb.maxX - bb.minX) / 2;
  const cy = bb.minY + (bb.maxY - bb.minY) / 2;
  if (radial) return radialPoints(bb, cx, cy);
  return linearPoints(bb, cx, cy, angle);
}

/** Print color for gradient stop; "transparent"→"black" for SVG 1.1 compat.
 * @see plugin/core/gvrender_core_svg.c:147 svg_print_gradient_color */
function printGradientColor(job: RenderJob, color: GVColor): void {
  if (color.type === 'string') {
    job.write(color.s === 'transparent' ? 'black' : color.s);
  } else if (color.type === 'rgba') {
    const rh = Math.round(color.r * 255).toString(16).padStart(2, '0');
    const gh = Math.round(color.g * 255).toString(16).padStart(2, '0');
    const bh = Math.round(color.b * 255).toString(16).padStart(2, '0');
    job.write('#' + rh + gh + bh);
  }
}
/** Emit stop-opacity matching C's svg_print_stop. */
function emitStopOpacity(job: RenderJob, color: GVColor): void {
  if (color.type === 'rgba' && Math.round(color.a * 255) < 255) {
    job.write(String(Math.round(color.a * 255) / 255));
  } else if (color.type === 'string' && color.s === 'transparent') {
    job.write('0');
  } else {
    job.write('1.');
  }
}

/**
 * Emit one gradient stop. offset: near-0→"0", near-1→"1", else "%.03f".
 * @see plugin/core/gvrender_core_svg.c:553 svg_print_stop
 */
export function emitStop(job: RenderJob, offset: number, color: GVColor): void {
  if (Math.abs(offset) < 0.0005) {
    job.write('<stop offset="0" style="stop-color:');
  } else if (Math.abs(offset - 1) < 0.0005) {
    job.write('<stop offset="1" style="stop-color:');
  } else {
    job.write('<stop offset="' + offset.toFixed(3) + '" style="stop-color:');
  }
  printGradientColor(job, color);
  job.write(';stop-opacity:');
  emitStopOpacity(job, color);
  job.write(';\"/>\n');
}

/**
 * Gradient element id: [escapeXml(objId)+'_'] + kind+'_'+n.
 * @see plugin/core/gvrender_core_svg.c:572 svg_gradstyle (id block)
 */
export function gradientId(objId: string | null, kind: 'l' | 'r', n: number): string {
  const prefix = objId !== null ? escapeXml(objId) + '_' : '';
  return prefix + kind + '_' + String(n);
}

/** Emit linearGradient coords block (inner helper for emitLinearGradient). */
function writeLinearGradCoords(job: RenderJob, pts: Point[], id: string, angleDeg: number): void {
  const { g0, g1 } = getGradientPoints(pts, angleDeg * Math.PI / 180, false);
  job.write('<defs>\n<linearGradient id="' + id + '"');
  job.write(' gradientUnits="userSpaceOnUse" ');
  job.write('x1="'); job.printDouble(g0.x);
  job.write('" y1="'); job.printDouble(g0.y);
  job.write('" x2="'); job.printDouble(g1.x);
  job.write('" y2="'); job.printDouble(g1.y);
  job.write('" >\n');
}

/**
 * Emit `<defs><linearGradient>` + two stops + `</linearGradient></defs>`.
 * pts in y-up (Graphviz) space. @see plugin/core/gvrender_core_svg.c:572 svg_gradstyle
 */
export function emitLinearGradient(job: RenderJob, pts: Point[], id: string): void {
  const obj = job.obj;
  if (obj === null) return;
  writeLinearGradCoords(job, pts, id, obj.gradientAngle);
  const frac = obj.gradientFrac;
  emitStop(job, frac > 0 ? frac - 0.001 : 0, obj.fillColor);
  emitStop(job, frac > 0 ? frac : 1, obj.stopColor);
  job.write('</linearGradient>\n</defs>\n');
}

/**
 * Emit `<defs><radialGradient>` + two stops + `</radialGradient></defs>`.
 * @see plugin/core/gvrender_core_svg.c:608 svg_rgradstyle
 */
export function emitRadialGradient(job: RenderJob, id: string): void {
  const obj = job.obj;
  if (obj === null) return;
  let ifx = 50, ify = 50;
  if (obj.gradientAngle !== 0) {
    const angle = obj.gradientAngle * Math.PI / 180;
    // @see plugin/core/gvrender_core_svg.c:622-623 (round())
    ifx = cround(50 * (1 + Math.cos(angle)));
    ify = cround(50 * (1 - Math.sin(angle)));
  }
  job.write('<defs>\n<radialGradient id="' + id + '"');
  job.write(' cx="50%" cy="50%" r="75%"');
  job.write(' fx="' + String(ifx) + '%" fy="' + String(ify) + '%">\n');
  emitStop(job, 0, obj.fillColor);
  emitStop(job, 1, obj.stopColor);
  job.write('</radialGradient>\n</defs>\n');
}
