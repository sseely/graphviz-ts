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

import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { Point, Bezier } from '../model/geom.js';
import type { TextSpan } from '../common/emit-types.js';
import { HTML_BF, HTML_IF, HTML_UL, HTML_SUP, HTML_SUB, HTML_S, HTML_OL } from '../common/emit-types.js';
import { fontFamilyAttrs } from '../common/ps-fontalias.js';
import type { RenderJob, ObjState } from '../gvc/job.js';
import { colorPaint, colorOpacity, textFillAttrs } from './color-resolve.js';
import { PenType, FillType } from '../gvc/context.js';
import { emitLinearGradient, emitRadialGradient, gradientId } from './svg-gradient.js';
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

export function paintStr(obj: ObjState, useFill: boolean): string {
  return colorPaint(useFill ? obj.fillColor : obj.penColor);
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

/** Emit ` <attr>="<opacity>"` when the color carries partial alpha. */
function emitOpacity(job: RenderJob, attr: string, color: ObjState['fillColor']): void {
  const o = colorOpacity(color);
  if (o !== null) job.write(' ' + attr + '="' + o + '"');
}

/**
 * Emit fill/stroke style attributes in C's exact order: fill, fill-opacity,
 * stroke, stroke-width, stroke-dasharray, stroke-opacity.
 * @see plugin/core/gvrender_core_svg.c:165-213 svg_grstyle
 */
export function emitStyle(job: RenderJob, filled: boolean, gradFillUrl?: string): void {
  const obj = job.obj;
  const solidFill = obj !== null && filled;
  const fill = gradFillUrl !== undefined
    ? 'url(#' + gradFillUrl + ')'
    : (solidFill ? paintStr(obj, true) : 'none');
  job.write(' fill="' + fill + '"');
  if (gradFillUrl === undefined && solidFill) emitOpacity(job, 'fill-opacity', obj.fillColor);
  const stroke = obj !== null ? paintStr(obj, false) : 'black';
  job.write(' stroke="' + stroke + '"');
  if (obj === null) return;
  const pw = obj.penWidth;
  if (Math.abs(pw - PENWIDTH_NORMAL) >= PENWIDTH_THRESHOLD) {
    emitPenWidth(job, pw);
  }
  emitDash(job, obj.pen);
  emitOpacity(job, 'stroke-opacity', obj.penColor);
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
  svgBeginPage, svgEndPage, svgBeginLayer, svgEndLayer,
} from './svg-graph.js';

// ---------------------------------------------------------------------------
// Node / edge group wrappers
// ---------------------------------------------------------------------------

export function svgBeginNode(n: Node, job: RenderJob): void {
  // C ids use the object's creation sequence (AGSEQ), not emission order.
  // The layer prefix/suffix are empty unless rendering layers (layerNum>1).
  // @see lib/common/emit.c:getObjId; plugin/core/gvrender_core_svg.c:svg_begin_node
  job.write('<g id="' + job.idLayerPrefix() + 'node' + (n.id + 1) + job.idLayerSuffix()
    + '" class="node">\n');
  job.write('<title>' + escapeXml(n.name) + '</title>\n');
}

export function svgEndNode(job: RenderJob): void {
  job.write('</g>\n');
}

/**
 * XML-escape an edge title the way C's `gvputs_xml` does (gv_xml_escape with
 * dash=1): `&`, `<`, `>`, and `-`→`&#45;`. The hyphen escaping is why dot emits
 * `A&#45;&gt;B`, not `A-&gt;B`.
 * @see lib/util/xml.c:xml_core (flags.dash)
 */
function escapeEdgeTitle(s: string): string {
  let r = s.replace(/&/g, '&amp;');
  r = r.replace(/</g, '&lt;');
  r = r.replace(/>/g, '&gt;');
  return r.replace(/-/g, '&#45;');
}

/**
 * Begin an edge group + `<title>`. The title is `tail[:tport]<sep>head[:hport]`
 * built raw, then escaped — mirroring C's `\E` substitution (`labels.c`) fed
 * through `gvputs_xml`. The port string is the resolved port name
 * (`ED_*_port(e).name`): a compass replaces a record field when both are given
 * (`A:f0:n` → `A:n`), and the dash escapes to `&#45;`.
 * @see lib/common/labels.c:strdup_and_subst_obj (case 'E')
 * @see plugin/core/gvrender_core_svg.c:svg_begin_edge
 */
export function svgBeginEdge(e: Edge, job: RenderJob): void {
  const sep = job.directed ? '->' : '--';
  const tp = e.info.tail_port?.name;
  const hp = e.info.head_port?.name;
  const raw = e.tail.name + (tp ? ':' + tp : '')
    + sep + e.head.name + (hp ? ':' + hp : '');
  // Edges get the layer prefix only — no per-object suffix (svg_begin_edge
  // passes idx=NULL, unlike svg_begin_node).
  job.write('<g id="' + job.idLayerPrefix() + 'edge' + e.graphSeq + '" class="edge">\n');
  job.write('<title>' + escapeEdgeTitle(raw) + '</title>\n');
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
    // C svg_begin_anchor writes xlink:href only.
    // @see plugin/core/gvrender_core_svg.c:svg_begin_anchor
    job.write(' xlink:href="' + escapeXml(href) + '"');
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
/**
 * Build the text-decoration value string for HTML_UL / HTML_OL / HTML_S flags.
 * Returns empty string when no decoration flags are set.
 * @see plugin/core/gvrender_core_svg.c:svg_textspan lines 501-515
 */
function textDecorationValue(flags: number): string {
  const parts: string[] = [];
  if (flags & HTML_UL) parts.push('underline');
  if (flags & HTML_OL) parts.push('overline');
  if (flags & HTML_S)  parts.push('line-through');
  return parts.join(',');
}

/**
 * Emit the HTML-flag SVG attributes (bold/italic from markup, text-decoration,
 * baseline-shift). bold/italic are skipped when the font alias already set them.
 * @see plugin/core/gvrender_core_svg.c:496-516 svg_textspan flag block
 */
function emitFontAttrs(flags: number, job: RenderJob, alias: { weight: boolean; style: boolean }): void {
  if (flags & HTML_BF && !alias.weight) job.write(' font-weight="bold"');
  if (flags & HTML_IF && !alias.style) job.write(' font-style="italic"');
  const dec = flags & (HTML_UL | HTML_OL | HTML_S)
    ? textDecorationValue(flags) : '';
  if (dec) job.write(' text-decoration="' + dec + '"');
  if (flags & HTML_SUP) job.write(' baseline-shift="super"');
  if (flags & HTML_SUB) job.write(' baseline-shift="sub"');
}

export function svgTextspan(pos: Point, span: TextSpan, job: RenderJob): void {
  const anchor = textAnchor(span.just);
  // C: p.y += yoffset_centerline; gvprintdouble(-p.y) → SVG y = -(y + offset)
  const y = -(pos.y + span.yoffset_centerline);
  job.write('<text xml:space="preserve" text-anchor="' + anchor + '"');
  job.write(' x="');
  job.printDouble(pos.x);
  job.write('" y="');
  job.printDouble(y);
  job.write('"');
  const ff = fontFamilyAttrs(span.fontName);
  if (ff !== null) job.write(ff.attrs);
  else job.write(' font-family="' + escapeXml(span.fontName ?? 'Times,serif') + '"');
  emitFontAttrs(span.fontFlags, job, ff ?? { weight: false, style: false });
  job.write(' font-size="' + span.fontSize.toFixed(2) + '"');
  job.write(textFillAttrs(span.fontColor));
  job.write('>' + escapeXml(span.str) + '</text>\n');
}

// ---------------------------------------------------------------------------
// Shape emitters
// ---------------------------------------------------------------------------

/**
 * Emit `<defs>` gradient block for a filled shape; returns the gradient id
 * to use as fill="url(#id)", or undefined for solid/none fills (AD2, AD3).
 * pts must be in y-up (Graphviz) coordinate space.
 * @see plugin/core/gvrender_core_svg.c:647-694 (gradient dispatch)
 */
export function emitGradientDefs(job: RenderJob, ptsYup: Point[], filled: boolean): string | undefined {
  if (!filled) return undefined;
  const obj = job.obj;
  if (obj === null) return undefined;
  if (obj.fill === FillType.Linear) {
    const gid = gradientId(obj.id, 'l', job.linearGradId++);
    emitLinearGradient(job, ptsYup, gid);
    return gid;
  }
  if (obj.fill === FillType.Radial) {
    const gid = gradientId(obj.id, 'r', job.radialGradId++);
    emitRadialGradient(job, gid);
    return gid;
  }
  return undefined;
}
export function svgEllipse(
  center: Point,
  rx: number,
  ry: number,
  filled: boolean,
  job: RenderJob,
): void {
  const ptsUp = [{ x: center.x, y: -center.y }, { x: center.x + rx, y: -center.y + ry }];
  const gradUrl = emitGradientDefs(job, ptsUp, filled);
  job.write('<ellipse');
  emitStyle(job, filled, gradUrl);
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
  const ptsUp = pts.map((p) => ({ x: p.x, y: -p.y }));
  const gradUrl = emitGradientDefs(job, ptsUp, filled);
  job.write('<polygon');
  emitStyle(job, filled, gradUrl);
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
  const ptsUp = pts.map((p) => ({ x: p.x, y: -p.y }));
  const gradUrl = emitGradientDefs(job, ptsUp, filled);
  job.write('<path');
  emitStyle(job, filled, gradUrl);
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
// @see lib/common/emit.c:emit_edge_graphics:2350 (color/penwidth flow)
// ---------------------------------------------------------------------------

/**
 * Emit Bezier edge path with style from job.obj (AD1: no ad-hoc attr reads).
 * Attribute order: fill="none" stroke="X" [stroke-width] [stroke-dasharray] d="..."
 * @see plugin/core/gvrender_core_svg.c:svg_bzptarray
 * @see lib/common/emit.c:emit_edge_graphics:2368 (late_string color)
 */
export function svgEdgePath(e: Edge, job: RenderJob): void {
  const spl = e.info.spl;
  if (spl === undefined || spl.size === 0) return;
  const obj = job.obj;
  const stroke = obj !== null ? paintStr(obj, false) : 'black';
  for (let si = 0; si < spl.size; si++) {
    const bz = spl.list[si] as Bezier | undefined;
    if (bz === undefined || bz.size < 4) continue;
    const pts = bz.list.map((p) => transformPoint(p, job));
    job.write('<path fill="none" stroke="' + stroke + '"');
    if (obj !== null && Math.abs(obj.penWidth - PENWIDTH_NORMAL) >= PENWIDTH_THRESHOLD) {
      emitPenWidth(job, obj.penWidth);
    }
    if (obj !== null) emitDash(job, obj.pen);
    job.write(' d="');
    emitBezierPath(job, pts);
    job.write('"/>\n');
  }
}

/**
 * Emit one arrowhead polygon with pen color from job.obj and Adobe first-point
 * repetition.  Exported so Lizard resets its line counter here (parser note above).
 * @see plugin/core/gvrender_core_svg.c:svg_polygon (arrowhead case)
 */
export function emitArrowPolygon(rawPts: Point[], penColor: string, job: RenderJob, pw: number): void {
  const pts = rawPts.map((p) => transformPoint(p, job));
  job.write('<polygon fill="' + penColor + '" stroke="' + penColor + '"');
  if (Math.abs(pw - PENWIDTH_NORMAL) >= PENWIDTH_THRESHOLD) {
    emitPenWidth(job, pw);
  }
  job.write(' points="');
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
 * Arrow fill and stroke use the edge pen color from job.obj (AD1).
 * @see plugin/core/gvrender_core_svg.c:svg_polygon (arrowhead case)
 * @see lib/common/arrows.c:arrow_type_normal
 */
export function svgArrowPolygons(e: Edge, job: RenderJob): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const einfo = e.info as any;
  const obj = job.obj;
  const penColor = obj !== null ? paintStr(obj, false) : 'black';
  const pw = obj !== null ? obj.penWidth : 1.0;
  const tailPts = einfo._tailArrowPts as Point[] | undefined;
  if (tailPts?.length) emitArrowPolygon(tailPts, penColor, job, pw);
  const headPts = einfo._arrowPts as Point[] | undefined;
  if (headPts?.length) emitArrowPolygon(headPts, penColor, job, pw);
}

// ---------------------------------------------------------------------------
// Parallel multi-color edge emission — moved to svg-parallel-edge.ts (file-
// size cap, AD5).  Re-exported here so callers import from one place.
// ---------------------------------------------------------------------------

export { emitParallelEdgePaths } from './svg-parallel-edge.js';
export type { ParallelEdgeResult } from './svg-parallel-edge.js';
