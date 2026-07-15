// SPDX-License-Identifier: EPL-2.0

/**
 * Plain, IMAP, and CMAPX renderer plugins.
 *
 * Plain: ports lib/common/output.c:write_plain.
 * IMAP/CMAPX: ports plugin/core/gvrender_core_map.c.
 *
 * @see lib/common/output.c:write_plain
 * @see plugin/core/gvrender_core_map.c
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { Point, Box } from '../model/geom.js';
import { POINTS_PER_INCH } from '../model/geom.js';
import type { TextSpan } from '../common/emit-types.js';
import type { TextlabelT } from '../common/types.js';
import { lateDouble } from '../common/nodeinit.js';
import { substObjAnchor } from '../common/subst.js';
import type { RendererPlugin } from '../gvc/context.js';
import type { ObjState, RenderJob } from '../gvc/job.js';
import { MapShape, EMIT_CLUSTERS_LAST } from '../gvc/job.js';
import {
  type MapCtx,
  computeNodeUrlMap,
  computeGraphUrlMap,
  computeClusterUrlMap,
  computeLabelRectMap,
  computeEdgeSplineMaps,
} from '../gvc/anchor.js';
import { initJobViewportZoom, parseDrawingSize } from '../gvc/viewport.js';
import { escapeXml } from './svg-helpers.js';
import { escapeXmlTitle } from './xml-escape.js';

// ---------------------------------------------------------------------------
// Avoid Lizard quote-tracker bug: never put " in string literals.
// ---------------------------------------------------------------------------

const DQ = '\x22';

// ---------------------------------------------------------------------------
// Shared interfaces (defined before all functions to avoid Lizard leakage)
// ---------------------------------------------------------------------------

/** Node style attributes for plain format. */
export interface PlainNodeAttrs {
  label: string; style: string; shape: string; color: string; fill: string;
}

/** Anchor attributes bundled to avoid >5-param functions. */
export interface AnchorCtx {
  url: string; tooltip: string; target: string; id: string;
}

// ---------------------------------------------------------------------------
// printG5 — @see lib/common/output.c:printdouble (%.5g)
// ---------------------------------------------------------------------------

/** Format with 5 significant figures, trailing zeros stripped. */
export function printG5(v: number): string {
  const s = v.toPrecision(5);
  if (s.includes('.') && !s.includes('e')) {
    return s.replace(/\.?0+$/, '');
  }
  return s;
}

/** Convert points → inches (PS2INCH = 1/72) and format as %.5g. */
export function plainCoord(v: number): string {
  return printG5(v / 72);
}

/** Resolve fill color: fillcolor attr, then color attr, then lightgrey. */
export function plainNodeFill(n: Node): string {
  const color = n.attrs.get('color') ?? 'black';
  return n.attrs.get('fillcolor') || color || 'lightgrey';
}

// ---------------------------------------------------------------------------
// Plain format helpers — @see lib/common/output.c:write_plain
// ---------------------------------------------------------------------------

/** Read the five style attrs needed for a plain node line. */
export function plainNodeAttrs(n: Node): PlainNodeAttrs {
  return {
    label: n.attrs.get('label') ?? n.name,
    style: n.attrs.get('style') ?? 'solid',
    shape: n.attrs.get('shape') ?? 'ellipse',
    color: n.attrs.get('color') ?? 'black',
    fill: plainNodeFill(n),
  };
}

/** Write one node line: `node name x y w h label style shape color fill\n` */
export function writePlainNode(n: Node, out: string[]): void {
  const x = plainCoord(n.info.coord.x);
  const y = plainCoord(n.info.coord.y);
  const w = printG5(n.info.width);
  const h = printG5(n.info.height);
  const a = plainNodeAttrs(n);
  out.push('node ' + n.name + ' ' + x + ' ' + y + ' ' + w + ' ' + h
    + ' ' + a.label + ' ' + a.style + ' ' + a.shape + ' ' + a.color + ' ' + a.fill + '\n');
}

/** Flatten all Bezier curves in an edge spline into a point array. */
export function collectSplinePts(e: Edge): Point[] {
  if (!e.info.spl) return [];
  const pts: Point[] = [];
  for (const bz of e.info.spl.list) {
    for (const pt of bz.list) pts.push(pt);
  }
  return pts;
}

/** Return `:name` suffix when a port name is present, else empty string. */
export function portSuffix(name: string | null): string {
  return name ? ':' + name : '';
}

/** Write the `edge tail head n pt...` prefix when spline data exists. */
export function writePlainEdgeHead(
  e: Edge, tport: string, hport: string, pts: Point[], out: string[],
): void {
  out.push('edge ' + e.tail.name + tport + ' ' + e.head.name + hport
    + ' ' + String(pts.length));
  for (const pt of pts) {
    out.push(' ' + plainCoord(pt.x) + ' ' + plainCoord(pt.y));
  }
}

/** Write one edge — spline prefix if available, always appends `style color\n`. */
export function writePlainEdge(e: Edge, extend: boolean, out: string[]): void {
  const tport = extend ? portSuffix(e.info.tail_port.name) : '';
  const hport = extend ? portSuffix(e.info.head_port.name) : '';
  const pts = collectSplinePts(e);
  if (pts.length > 0) writePlainEdgeHead(e, tport, hport, pts, out);
  const style = e.attrs.get('style') ?? 'solid';
  const color = e.attrs.get('color') ?? 'black';
  out.push(' ' + style + ' ' + color + '\n');
}

/** Write the full plain output: graph header, nodes, edges, stop. */
export function writePlain(g: Graph, job: RenderJob, extend: boolean): void {
  const w = plainCoord(g.info.bb.ur.x);
  const h = plainCoord(g.info.bb.ur.y);
  job.write('graph ' + printG5(job.zoom) + ' ' + w + ' ' + h + '\n');
  for (const [, n] of g.nodes) {
    const buf: string[] = [];
    writePlainNode(n, buf);
    job.write(buf.join(''));
  }
  for (const [, n] of g.nodes) {
    for (const e of n.outEdges(g)) {
      const buf: string[] = [];
      writePlainEdge(e, extend, buf);
      job.write(buf.join(''));
    }
  }
  job.write('stop\n');
}

// ---------------------------------------------------------------------------
// CMAPX / IMAP helpers — @see plugin/core/gvrender_core_map.c
// ---------------------------------------------------------------------------

/** Build AnchorCtx from an ObjState, defaulting nulls to empty string. */
export function cmapxObjAnchor(obj: ObjState): AnchorCtx {
  return {
    url: obj.url ?? '',
    tooltip: obj.tooltip ?? '',
    target: obj.target ?? '',
    id: obj.id ?? '',
  };
}

/** Write graph-level CMAPX shape if the obj has map points. */
export function writeCmapxGraphShape(job: RenderJob, out: string[]): void {
  const obj = job.obj;
  if (!obj || !obj.urlMapPts.length) return;
  mapOutputCmapx(obj.urlMapShape, obj.urlMapPts, cmapxObjAnchor(obj), true, out);
}

/** Map MapShape enum to CMAPX shape attribute string. */
export function cmapxShape(shape: MapShape): string {
  if (shape === MapShape.Circle) return 'circle';
  if (shape === MapShape.Rectangle) return 'rect';
  return 'poly';
}

/** CMAPX coords for a rectangle (UL→LR in Y-down space). */
export function cmapxCoordsRect(pts: Point[]): string {
  return String(Math.round(pts[0]!.x)) + ',' + String(Math.round(pts[1]!.y))
    + ',' + String(Math.round(pts[1]!.x)) + ',' + String(Math.round(pts[0]!.y));
}

/** CMAPX coords for a circle: `cx,cy,r`. */
export function cmapxCoordsCircle(pts: Point[]): string {
  const cx = Math.round(pts[0]!.x);
  const cy = Math.round(pts[0]!.y);
  const r = Math.round(pts[1]!.x - pts[0]!.x);
  return String(cx) + ',' + String(cy) + ',' + String(r);
}

/** CMAPX coords for a polygon: `x0,y0,x1,y1,...`. */
export function cmapxCoordsPoly(pts: Point[]): string {
  return pts.map(p => String(Math.round(p.x)) + ',' + String(Math.round(p.y))).join(',');
}

/** Dispatch to the correct CMAPX coordinate formatter. */
export function cmapxCoords(shape: MapShape, pts: Point[]): string {
  if (shape === MapShape.Circle) return cmapxCoordsCircle(pts);
  if (shape === MapShape.Rectangle) return cmapxCoordsRect(pts);
  return cmapxCoordsPoly(pts);
}

/** Append optional id/href/target/title attributes to out. */
export function mapCmapxAttrs(a: AnchorCtx, out: string[]): void {
  if (a.id) out.push(' id=' + DQ + escapeXml(a.id) + DQ);
  if (a.url) out.push(' href=' + DQ + escapeXml(a.url) + DQ);
  // C uses gvputs_xml (dash+nbsp flags) for target/title — runs of spaces
  // become &#160;. @see gvrender_core_map.c:map_output_shape
  if (a.target) out.push(' target=' + DQ + escapeXmlTitle(a.target) + DQ);
  if (a.tooltip) out.push(' title=' + DQ + escapeXmlTitle(a.tooltip) + DQ);
}

/** Write one `<area>` element: CMAPX (isXml=true → `/>`) or CMAP (`>`). */
export function mapOutputCmapx(
  shape: MapShape, pts: Point[], a: AnchorCtx, isXml: boolean, out: string[],
): void {
  out.push('<area shape=' + DQ + cmapxShape(shape) + DQ);
  mapCmapxAttrs(a, out);
  out.push(' alt=' + DQ + DQ);
  out.push(' coords=' + DQ + cmapxCoords(shape, pts) + DQ);
  out.push(isXml ? '/>\n' : '>\n');
}

/** Write one IMAP shape line; skipped when url is empty. */
export function mapOutputImap(
  shape: MapShape, pts: Point[], url: string, out: string[],
): void {
  if (!url) return;
  if (shape === MapShape.Rectangle) {
    out.push('rect ' + url + ' '
      + Math.round(pts[0]!.x) + ',' + Math.round(pts[1]!.y)
      + ' ' + Math.round(pts[1]!.x) + ',' + Math.round(pts[0]!.y) + '\n');
  } else if (shape === MapShape.Circle) {
    const r = Math.round(pts[1]!.x - pts[0]!.x);
    out.push('circle ' + url + ' '
      + Math.round(pts[0]!.x) + ',' + Math.round(pts[0]!.y) + ',' + String(r) + '\n');
  } else {
    const pairs = pts.map(p => Math.round(p.x) + ',' + Math.round(p.y)).join(' ');
    out.push('poly ' + url + ' ' + pairs + '\n');
  }
}

// ---------------------------------------------------------------------------
// PlainRenderer
// ---------------------------------------------------------------------------

/** @see plugin/core/gvrender_core_dot.c FORMAT_PLAIN */
export class PlainRenderer implements RendererPlugin {
  readonly type = 'plain';
  readonly quality = 0;

  beginGraph(_g: Graph, _job: RenderJob): void { /* no-op */ }
  endGraph(g: Graph, job: RenderJob): void { writePlain(g, job, false); }
  beginNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  endNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  beginEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  endEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  textspan(_pos: Point, _span: TextSpan, _job: RenderJob): void { /* no-op */ }
  ellipse(_c: Point, _rx: number, _ry: number, _f: boolean, _j: RenderJob): void { /* no-op */ }
  polygon(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  bezier(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  polyline(_pts: Point[], _job: RenderJob): void { /* no-op */ }
}

// ---------------------------------------------------------------------------
// PlainExtRenderer
// ---------------------------------------------------------------------------

/** @see plugin/core/gvrender_core_dot.c FORMAT_PLAIN_EXT */
export class PlainExtRenderer implements RendererPlugin {
  readonly type = 'plain-ext';
  readonly quality = 0;

  beginGraph(_g: Graph, _job: RenderJob): void { /* no-op */ }
  endGraph(g: Graph, job: RenderJob): void { writePlain(g, job, true); }
  beginNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  endNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  beginEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  endEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  textspan(_pos: Point, _span: TextSpan, _job: RenderJob): void { /* no-op */ }
  ellipse(_c: Point, _rx: number, _ry: number, _f: boolean, _j: RenderJob): void { /* no-op */ }
  polygon(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  bezier(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  polyline(_pts: Point[], _job: RenderJob): void { /* no-op */ }
}

// ---------------------------------------------------------------------------
// Imagemap renderers (cmapx / imap and their no-polygon `_np` variants)
// ---------------------------------------------------------------------------

/** Graph name as `agnameof` returns it: the DOT name, or `%1` for an anonymous
 * root (cgraph's first anonymous id). The port stores `''` for an anonymous
 * root (dot/xdot re-serialization must not print a `%`-name — see dot.ts), so
 * the imagemap layer restores the internal name only here.
 * @see lib/cgraph/id.c:agnameof ; lib/cgraph/id.c:idmap (anon → `%1`) */
export function mapGraphName(g: Graph): string {
  return g.anonymous ? '%1' : g.name;
}

/** First non-empty attr walking parent scopes (agget inheritance). */
function graphAttr(g: Graph, key: string): string | undefined {
  for (let s: Graph | null = g; s !== null; s = s.parent) {
    const v = s.attrs.get(key);
    if (v !== undefined && v !== '') return v;
  }
  return undefined;
}

/** Root graph URL (href, then URL) with \-substitution, for the imap `default`
 * line. Resolved from attrs because obj.url is populated after beginGraph.
 * @see lib/common/emit.c:initObjMapData ; gvrender_core_map.c:map_begin_page */
export function graphMapUrl(g: Graph): string | null {
  const raw = graphAttr(g, 'href') ?? graphAttr(g, 'URL');
  return raw === undefined ? null : substObjAnchor(raw, g);
}

/** Build the imagemap coordinate context. The map device's default dpi is 96
 * (dpi/resolution attrs override); zoom fits the drawing into `size=` exactly
 * as the SVG path (initJobViewportZoom). @see gvrender_core_map.c device_features_map */
export function buildMapCtx(g: Graph, job: RenderJob, mapPolygon: boolean): MapCtx {
  const drawingDpi = lateDouble(g.attrs.get('dpi'), lateDouble(g.attrs.get('resolution'), 0, 0), 0);
  const mapDpi = drawingDpi > 0 ? drawingDpi : 96;
  const devscale = mapDpi / POINTS_PER_INCH;
  const z = initJobViewportZoom(job.bb, parseDrawingSize(g.attrs.get('size')), job.pad);
  // The graph `margin=` enters device space as `margin * dpi/72` (independent
  // of zoom), added after the scaled transform. @see emit.c:setup_page.
  const marginOff = { x: job.margin.x * devscale, y: job.margin.y * devscale };
  return { bb: job.bb, pad: job.pad, scale: z * devscale, marginOff, mapPolygon };
}

/** Head/tail/center label anchor bundle. */
interface EdgeLabelAnchor { url: string | null; tooltip: string | null; target: string | null; explicit: boolean; }

/** Coalesce nullable anchor fields to '' (gvrender_begin_anchor passes ""). */
function anchorOf(url: string | null, tooltip: string | null, target: string | null, id: string | null): AnchorCtx {
  return { url: url ?? '', tooltip: tooltip ?? '', target: target ?? '', id: id ?? '' };
}

/**
 * Shared imagemap renderer. Ports plugin/core/gvrender_core_map.c: the
 * `url_map_p` geometry (src/gvc/anchor.ts) is populated in the begin hooks and
 * emitted as `<area>` (cmapx) or `keyword url coords` (imap) lines in traversal
 * order. The `_np` subclasses disable polygon/circle shapes
 * (device_features_map_nopoly).
 * @see plugin/core/gvrender_core_map.c
 */
abstract class MapRendererBase implements RendererPlugin {
  abstract readonly type: string;
  readonly quality = 0;
  protected abstract readonly isCmapx: boolean;
  protected abstract readonly mapPolygon: boolean;
  private mapCtx: MapCtx | null = null;

  beginGraph(g: Graph, job: RenderJob): void {
    // Reset per render — instance may be reused across diagrams.
    // The map device carries EMIT_CLUSTERS_LAST (device_features_map): container
    // anchors (HTML table, cluster) emit their <area> AFTER their contents, so
    // an inner cell's area precedes the enclosing table's. @see gvrender_core_map.c
    job.flags |= EMIT_CLUSTERS_LAST;
    this.mapCtx = buildMapCtx(g, job, this.mapPolygon);
    if (this.isCmapx) {
      const name = escapeXml(mapGraphName(g));
      job.write('<map id=' + DQ + name + DQ + ' name=' + DQ + name + DQ + '>\n');
      return;
    }
    job.write('base referer\n');
    const url = graphMapUrl(g);
    if (url) job.write('default ' + url + '\n');
  }

  endGraph(_g: Graph, job: RenderJob): void {
    if (!this.isCmapx) return;
    const obj = job.obj;
    // Root graph hot spot (map_end_page). @see gvrender_core_map.c:map_end_page
    if (obj !== null && this.mapCtx !== null && (obj.url !== null || obj.explicitTooltip)) {
      computeGraphUrlMap(obj, this.mapCtx);
    }
    const buf: string[] = [];
    writeCmapxGraphShape(job, buf);
    job.write(buf.join(''));
    job.write('</map>\n');
  }

  beginNode(n: Node, job: RenderJob): void {
    if (this.mapCtx !== null && job.obj !== null) computeNodeUrlMap(n, job.obj, this.mapCtx);
  }

  beginCluster(sg: Graph, job: RenderJob): void {
    const bb = sg.info.bb;
    if (this.mapCtx !== null && job.obj !== null && bb !== undefined) {
      computeClusterUrlMap(bb, job.obj, this.mapCtx);
    }
  }

  endEdge(e: Edge, job: RenderJob): void {
    if (this.mapCtx !== null && job.obj !== null) this.emitEdge(e, job.obj, job);
  }

  /** C emit_map_rect: record the HTML table/cell box as the pending hot spot,
   *  so the following beginAnchor emits its <area>. @see emit.c:640 */
  emitMapRect(box: Box, job: RenderJob): void {
    if (this.mapCtx !== null && job.obj !== null) {
      computeClusterUrlMap(box, job.obj, this.mapCtx);
    }
  }

  beginAnchor(url: string, tip: string, target: string, id: string, job: RenderJob): void {
    const obj = job.obj;
    if (obj === null || obj.urlMapPts.length === 0) return;
    this.emitShape(obj.urlMapShape, obj.urlMapPts, { url, tooltip: tip, target, id }, job);
  }

  endNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  beginEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  endCluster(_sg: Graph, _job: RenderJob): void { /* no-op */ }
  textspan(_pos: Point, _span: TextSpan, _job: RenderJob): void { /* no-op */ }
  ellipse(_c: Point, _rx: number, _ry: number, _f: boolean, _j: RenderJob): void { /* no-op */ }
  polygon(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  bezier(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  polyline(_pts: Point[], _job: RenderJob): void { /* no-op */ }

  /** Emit one hot spot: `<area>` (cmapx) or a plain `keyword url coords` line. */
  private emitShape(shape: MapShape, pts: Point[], a: AnchorCtx, job: RenderJob): void {
    const buf: string[] = [];
    if (this.isCmapx) mapOutputCmapx(shape, pts, a, true, buf);
    else mapOutputImap(shape, pts, a.url, buf);
    job.write(buf.join(''));
  }

  /** Whole-edge spline outline(s) then center/head/tail label hot spots.
   * @see lib/common/emit.c:emit_begin_edge (2851-2872) / emit_end_edge */
  private emitEdge(e: Edge, obj: ObjState, job: RenderJob): void {
    const spl = e.info.spl;
    const wholeEdge = obj.url !== null || obj.explicitTooltip;
    if (spl !== undefined && this.mapPolygon && wholeEdge) {
      const w2 = Math.max(obj.penWidth / 2, 2);
      const anchor = anchorOf(obj.url, obj.tooltip, obj.target, obj.id);
      for (const poly of computeEdgeSplineMaps(spl, w2, this.mapCtx!)) {
        this.emitShape(MapShape.Polygon, poly, anchor, job);
      }
    }
    const centerA: EdgeLabelAnchor = {
      url: obj.labelUrl, tooltip: obj.labelTooltip, target: obj.labelTarget, explicit: obj.explicitLabelTooltip,
    };
    this.emitEdgeLabel(e.info.label, centerA, obj, job);
    this.emitEdgeLabel(e.info.xlabel, centerA, obj, job);
    this.emitEdgeLabel(e.info.head_label,
      { url: obj.headUrl, tooltip: obj.headTooltip, target: obj.headTarget, explicit: obj.explicitHeadTooltip },
      obj, job);
    this.emitEdgeLabel(e.info.tail_label,
      { url: obj.tailUrl, tooltip: obj.tailTooltip, target: obj.tailTarget, explicit: obj.explicitTailTooltip },
      obj, job);
  }

  /** One edge label hot spot (map_label rect), if placed and url/explicit-tip.
   * @see lib/common/emit.c:emit_edge_label */
  private emitEdgeLabel(lab: TextlabelT | undefined, la: EdgeLabelAnchor, obj: ObjState, job: RenderJob): void {
    const placed = lab !== undefined && lab.set && this.mapCtx !== null;
    if (!placed || (la.url === null && !la.explicit)) return;
    computeLabelRectMap(lab, obj, this.mapCtx!);
    this.emitShape(MapShape.Rectangle, obj.urlMapPts, anchorOf(la.url, la.tooltip, la.target, obj.id), job);
  }
}

/** @see plugin/core/gvrender_core_map.c FORMAT_IMAP */
export class ImapRenderer extends MapRendererBase {
  readonly type = 'imap';
  protected readonly isCmapx = false;
  protected readonly mapPolygon = true;
}

/** @see plugin/core/gvrender_core_map.c FORMAT_IMAP (no-polygon device) */
export class ImapNpRenderer extends MapRendererBase {
  readonly type = 'imap-np';
  protected readonly isCmapx = false;
  protected readonly mapPolygon = false;
}

/** @see plugin/core/gvrender_core_map.c FORMAT_CMAPX */
export class CmapxRenderer extends MapRendererBase {
  readonly type = 'cmapx';
  protected readonly isCmapx = true;
  protected readonly mapPolygon = true;
}

/** @see plugin/core/gvrender_core_map.c FORMAT_CMAPX (no-polygon device) */
export class CmapxNpRenderer extends MapRendererBase {
  readonly type = 'cmapx-np';
  protected readonly isCmapx = true;
  protected readonly mapPolygon = false;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/** @see plugin/core/gvrender_core_dot.c FORMAT_PLAIN */
export function createPlainRenderer(): RendererPlugin { return new PlainRenderer(); }

/** @see plugin/core/gvrender_core_dot.c FORMAT_PLAIN_EXT */
export function createPlainExtRenderer(): RendererPlugin { return new PlainExtRenderer(); }

/** @see plugin/core/gvrender_core_map.c FORMAT_IMAP */
export function createImapRenderer(): RendererPlugin { return new ImapRenderer(); }

/** @see plugin/core/gvrender_core_map.c FORMAT_IMAP (no polygon) */
export function createImapNpRenderer(): RendererPlugin { return new ImapNpRenderer(); }

/** @see plugin/core/gvrender_core_map.c FORMAT_CMAPX */
export function createCmapxRenderer(): RendererPlugin { return new CmapxRenderer(); }

/** @see plugin/core/gvrender_core_map.c FORMAT_CMAPX (no polygon) */
export function createCmapxNpRenderer(): RendererPlugin { return new CmapxNpRenderer(); }
