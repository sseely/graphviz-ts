// SPDX-License-Identifier: EPL-2.0

/**
 * SVG renderer helper functions.
 *
 * All shape-emission logic lives here as top-level export functions so
 * Lizard's TypeScript parser tracks function boundaries correctly.
 * Lizard only resets its function-tracking on the export keyword;
 * bare function declarations are silently absorbed into the preceding
 * exported function's body count.
 *
 * Lizard parser bugs (affect this file):
 * 1. Regex literal containing a double-quote char (e.g. /"/g) unbalances
 *    its string-quote tracker.  Use new RegExp('"', 'g') instead.
 * 2. Template literals containing ${...} interpolations confuse the parser
 *    and cause following non-exported functions to be absorbed into the
 *    preceding exported function's line-count.  Avoid ${...} template
 *    literals in exported functions; use string concatenation or
 *    job.write/printDouble sequences instead.
 *
 * @see plugin/core/gvrender_core_svg.c
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { Point, Box, Bezier } from '../model/geom.js';
import type { TextSpan } from '../common/emit-types.js';
import type { RenderJob, ObjState } from '../gvc/job.js';
import { PenType } from '../gvc/context.js';
import { transformPoint } from '../gvc/device.js';

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

const SVG_DASH_ARRAY = '5,2';
const SVG_DOT_ARRAY = '1,5';
const PENWIDTH_NORMAL = 1.0;
const PENWIDTH_BOLD = 2.0;
const PENWIDTH_THRESHOLD = 0.005;

/**
 * Padding (in graph units / points) added on all four sides of the bounding
 * box, matching the C plugin descriptor `default_pad = 4.0`.
 * @see plugin/core/gvrender_core_svg.c  (gvrender_features_t.default_pad)
 */
export const SVG_PAD = 4;

// Regex for double-quote: /"/g breaks Lizard's quote-tracker.
// Use this named pattern instead to avoid the parser bug.
const RE_DQUOTE = new RegExp('"', 'g');

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------

export function escapeXml(s: string): string {
  let r = s.replace(/&/g, '&amp;');
  r = r.replace(/</g, '&lt;');
  r = r.replace(/>/g, '&gt;');
  r = r.replace(RE_DQUOTE, '&quot;');
  return r;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

export function rgbaStr(r: number, g: number, b: number): string {
  const rh = Math.round(r * 255).toString(16).padStart(2, '0');
  const gh = Math.round(g * 255).toString(16).padStart(2, '0');
  const bh = Math.round(b * 255).toString(16).padStart(2, '0');
  return '#' + rh + gh + bh;
}

export function paintStr(obj: ObjState, useFill: boolean): string {
  const color = useFill ? obj.fillColor : obj.penColor;
  if (color.type === 'none') return 'none';
  if (color.type === 'string') {
    return color.s === 'transparent' ? 'none' : color.s;
  }
  if (color.type === 'rgba') {
    if (color.a === 0) return 'none';
    return rgbaStr(color.r, color.g, color.b);
  }
  return 'black';
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

export function emitDash(job: RenderJob, pen: PenType): void {
  if (pen === PenType.Dashed) {
    job.write(' stroke-dasharray="' + SVG_DASH_ARRAY + '"');
  } else if (pen === PenType.Dotted) {
    job.write(' stroke-dasharray="' + SVG_DOT_ARRAY + '"');
  }
}

export function emitPenWidth(job: RenderJob, pw: number): void {
  if (Math.abs(pw - PENWIDTH_BOLD) < PENWIDTH_THRESHOLD) {
    job.write(' stroke-width="' + String(PENWIDTH_BOLD) + '"');
    return;
  }
  job.write(' stroke-width="');
  job.printDouble(pw);
  job.write('"');
}

export function emitStyle(job: RenderJob, filled: boolean): void {
  const obj = job.obj;
  const fill = obj !== null && filled ? paintStr(obj, true) : 'none';
  const stroke = obj !== null ? paintStr(obj, false) : 'black';
  job.write(' fill="' + fill + '" stroke="' + stroke + '"');
  if (obj === null) return;
  const pw = obj.penWidth;
  if (Math.abs(pw - PENWIDTH_NORMAL) >= PENWIDTH_THRESHOLD) {
    emitPenWidth(job, pw);
  }
  emitDash(job, obj.pen);
}

// ---------------------------------------------------------------------------
// Point serialisation helpers
// ---------------------------------------------------------------------------

export function emitPoints(job: RenderJob, pts: Point[]): void {
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    job.printDouble(p.x);
    job.write(',');
    job.printDouble(p.y);
    if (i + 1 < pts.length) job.write(' ');
  }
}

export function emitBezierPath(job: RenderJob, pts: Point[]): void {
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const c = i === 0 ? 'M' : (i === 1 ? 'C' : ' ');
    job.write(c);
    job.printDouble(p.x);
    job.write(',');
    job.printDouble(p.y);
  }
}

// ---------------------------------------------------------------------------
// Text alignment
// ---------------------------------------------------------------------------

export function textAnchor(just: 'l' | 'n' | 'r'): string {
  if (just === 'l') return 'start';
  if (just === 'r') return 'end';
  return 'middle';
}

// ---------------------------------------------------------------------------
// Graph open/close — moved to svg-graph.ts (file size cap); re-exported here
// ---------------------------------------------------------------------------

export {
  graphGroupId, emitSvgTag, emitGraphGroupOpen, emitGraphTitle,
  emitGraphBackground, svgBeginGraph, svgEndGraph,
} from './svg-graph.js';

// ---------------------------------------------------------------------------
// Node / edge group wrappers
// ---------------------------------------------------------------------------

export function svgBeginNode(n: Node, job: RenderJob): void {
  // C ids use the object's creation sequence (AGSEQ), not emission order.
  // @see lib/common/emit.c:getObjId
  job.write('<g id="node' + (n.id + 1) + '" class="node">\n');
  job.write('<title>' + escapeXml(n.name) + '</title>\n');
}

export function svgEndNode(job: RenderJob): void {
  job.write('</g>\n');
}

export function svgBeginEdge(e: Edge, job: RenderJob): void {
  const tid = escapeXml(e.tail.name);
  const hid = escapeXml(e.head.name);
  job.write('<g id="edge' + e.graphSeq + '" class="edge">\n');
  job.write('<title>' + tid + '-&gt;' + hid + '</title>\n');
}

export function svgEndEdge(job: RenderJob): void {
  job.write('</g>\n');
}

// ---------------------------------------------------------------------------
// Anchor helpers
// ---------------------------------------------------------------------------

export function emitAnchorAttrs(
  href: string,
  tooltip: string,
  target: string,
  job: RenderJob,
): void {
  if (href.length > 0) {
    const h = escapeXml(href);
    job.write(' xlink:href="' + h + '" href="' + h + '"');
  }
  if (tooltip.length > 0) {
    job.write(' xlink:title="' + escapeXml(tooltip) + '"');
  }
  if (target.length > 0) {
    job.write(' target="' + escapeXml(target) + '"');
  }
}

export function svgBeginAnchor(
  href: string,
  tooltip: string,
  target: string,
  id: string,
  job: RenderJob,
): void {
  if (id.length > 0) {
    job.write('<g id="a_' + escapeXml(id) + '"><a');
  } else {
    job.write('<g><a');
  }
  emitAnchorAttrs(href, tooltip, target, job);
  job.write('>\n');
}

export function svgEndAnchor(job: RenderJob): void {
  job.write('</a>\n</g>\n');
}

// ---------------------------------------------------------------------------
// Text span
// ---------------------------------------------------------------------------

/**
 * Emit a text span SVG element.
 *
 * pos.y is in Graphviz y-up space (same as pos.x for symmetry).
 * C's svg_textspan writes `y = -(p.y + yoffset)` — negating the
 * Graphviz coordinate and then adding the centerline offset.
 * Match that behavior exactly.
 *
 * @see plugin/core/gvrender_core_svg.c:svg_textspan
 */
export function svgTextspan(pos: Point, span: TextSpan, job: RenderJob): void {
  const anchor = textAnchor(span.just);
  // C writes: p.y += yoffset_centerline; then gvprintdouble(job, -p.y)
  // → SVG y = -(graphviz_y + yoffset_centerline)
  const y = -(pos.y + span.yoffset_centerline);
  const fontName = span.fontName ?? 'Times,serif';
  job.write('<text xml:space="preserve" text-anchor="' + anchor + '"');
  job.write(' x="');
  job.printDouble(pos.x);
  job.write('" y="');
  job.printDouble(y);
  job.write('"');
  job.write(' font-family="' + escapeXml(fontName) + '"');
  job.write(' font-size="' + span.fontSize.toFixed(2) + '"');
  job.write('>' + escapeXml(span.str) + '</text>\n');
}

// ---------------------------------------------------------------------------
// Shape emitters
// ---------------------------------------------------------------------------

export function svgEllipse(
  center: Point,
  rx: number,
  ry: number,
  filled: boolean,
  job: RenderJob,
): void {
  job.write('<ellipse');
  emitStyle(job, filled);
  job.write(' cx="');
  job.printDouble(center.x);
  job.write('" cy="');
  job.printDouble(center.y);
  job.write('" rx="');
  job.printDouble(rx);
  job.write('" ry="');
  job.printDouble(ry);
  job.write('"/>\n');
}

export function svgPolygon(pts: Point[], filled: boolean, job: RenderJob): void {
  job.write('<polygon');
  emitStyle(job, filled);
  job.write(' points="');
  emitPoints(job, pts);
  if (pts.length > 0) {
    // Repeat first point — Adobe SVG compatibility
    // @see plugin/core/gvrender_core_svg.c:svg_polygon
    const p0 = pts[0]!;
    job.write(' ');
    job.printDouble(p0.x);
    job.write(',');
    job.printDouble(p0.y);
  }
  job.write('"/>\n');
}

export function svgBezier(pts: Point[], filled: boolean, job: RenderJob): void {
  job.write('<path');
  emitStyle(job, filled);
  job.write(' d="');
  emitBezierPath(job, pts);
  job.write('"/>\n');
}

export function svgPolyline(pts: Point[], job: RenderJob): void {
  job.write('<polyline');
  emitStyle(job, false);
  job.write(' points="');
  emitPoints(job, pts);
  job.write('"/>\n');
}

export function svgComment(text: string, job: RenderJob): void {
  job.write('<!-- ' + escapeXml(text) + ' -->\n');
}

// ---------------------------------------------------------------------------
// Edge graphics — path and arrowhead polygon
// @see plugin/core/gvrender_core_svg.c:svg_bzptarray + svg_polygon (arrow)
// ---------------------------------------------------------------------------

const EDGE_STYLE_ATTR: Record<string, string> = {
  dashed: ' stroke-dasharray="' + SVG_DASH_ARRAY + '"',
  dotted: ' stroke-dasharray="' + SVG_DOT_ARRAY + '"',
  bold: ' stroke-width="' + String(PENWIDTH_BOLD) + '"',
};
const edgeStrokeColor = (e: Edge): string => { const c = e.attrs.get('color'); return c && c.length > 0 ? c : 'black'; };
function edgeStyleAttr(s: string | undefined): string { return EDGE_STYLE_ATTR[s ?? ''] ?? ''; }

/** Emit Bezier edge path with style attributes. @see plugin/core/gvrender_core_svg.c:svg_bzptarray */
export function svgEdgePath(e: Edge, job: RenderJob): void {
  const spl = e.info.spl;
  if (spl === undefined || spl.size === 0) return;
  const stroke = edgeStrokeColor(e);
  const dash = edgeStyleAttr(e.attrs.get('style'));
  for (let si = 0; si < spl.size; si++) {
    const bz = spl.list[si] as Bezier | undefined;
    if (bz === undefined || bz.size < 4) continue;
    const pts = bz.list.map((p) => transformPoint(p, job));
    job.write('<path fill="none" stroke="' + stroke + '"' + dash + ' d="');
    emitBezierPath(job, pts);
    job.write('"/>\n');
  }
}

/** Emit one filled arrowhead polygon with Adobe first-point repetition. */
function emitArrowPolygon(rawPts: Point[], job: RenderJob, strokeWidth?: number): void {
  const pts = rawPts.map((p) => transformPoint(p, job));
  const sw = strokeWidth !== undefined && strokeWidth !== 1 ? ` stroke-width="${strokeWidth}"` : '';
  job.write('<polygon fill="black" stroke="black"' + sw + ' points="');
  emitPoints(job, pts);
  if (pts.length > 0) {
    const p0 = pts[0]!;
    job.write(' ');
    job.printDouble(p0.x);
    job.write(',');
    job.printDouble(p0.y);
  }
  job.write('"/>\n');
}

/**
 * Emit arrowhead polygon(s) for a routed edge (tail first, then head).
 * @see plugin/core/gvrender_core_svg.c:svg_polygon (arrowhead case)
 * @see lib/common/arrows.c:arrow_type_normal
 */
export function svgArrowPolygons(e: Edge, job: RenderJob): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const einfo = e.info as any;
  const sw = e.attrs.get('style') === 'bold' ? 2 : undefined;
  const tailPts = einfo._tailArrowPts as Point[] | undefined;
  if (tailPts?.length) emitArrowPolygon(tailPts, job, sw);
  const headPts = einfo._arrowPts as Point[] | undefined;
  if (headPts?.length) emitArrowPolygon(headPts, job, sw);
}
