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
import type { Point } from '../model/geom.js';
import type { TextSpan } from '../common/emit-types.js';
import type { RendererPlugin } from '../gvc/context.js';
import type { ObjState, RenderJob } from '../gvc/job.js';
import { MapShape } from '../gvc/job.js';
import { escapeXml } from './svg-helpers.js';

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
  if (a.target) out.push(' target=' + DQ + escapeXml(a.target) + DQ);
  if (a.tooltip) out.push(' title=' + DQ + escapeXml(a.tooltip) + DQ);
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
// ImapRenderer
// ---------------------------------------------------------------------------

/** @see plugin/core/gvrender_core_map.c FORMAT_IMAP */
export class ImapRenderer implements RendererPlugin {
  readonly type = 'imap';
  readonly quality = 0;

  beginGraph(_g: Graph, job: RenderJob): void {
    job.write('base referer\n');
    const url = job.obj?.url;
    if (url) job.write('default ' + url + '\n');
  }

  endGraph(_g: Graph, _job: RenderJob): void { /* no-op */ }
  beginNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  endNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  beginEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  endEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  textspan(_pos: Point, _span: TextSpan, _job: RenderJob): void { /* no-op */ }
  ellipse(_c: Point, _rx: number, _ry: number, _f: boolean, _j: RenderJob): void { /* no-op */ }
  polygon(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  bezier(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  polyline(_pts: Point[], _job: RenderJob): void { /* no-op */ }

  beginAnchor(href: string, _tip: string, _tgt: string, _id: string, job: RenderJob): void {
    const obj = job.obj;
    if (!obj || !obj.urlMapPts.length) return;
    const buf: string[] = [];
    mapOutputImap(obj.urlMapShape, obj.urlMapPts, href, buf);
    job.write(buf.join(''));
  }
}

// ---------------------------------------------------------------------------
// ImapNpRenderer
// ---------------------------------------------------------------------------

/** @see plugin/core/gvrender_core_map.c FORMAT_IMAP (no-polygon device) */
export class ImapNpRenderer implements RendererPlugin {
  readonly type = 'imap-np';
  readonly quality = 0;

  beginGraph(_g: Graph, job: RenderJob): void {
    job.write('base referer\n');
    const url = job.obj?.url;
    if (url) job.write('default ' + url + '\n');
  }

  endGraph(_g: Graph, _job: RenderJob): void { /* no-op */ }
  beginNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  endNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  beginEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  endEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  textspan(_pos: Point, _span: TextSpan, _job: RenderJob): void { /* no-op */ }
  ellipse(_c: Point, _rx: number, _ry: number, _f: boolean, _j: RenderJob): void { /* no-op */ }
  polygon(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  bezier(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  polyline(_pts: Point[], _job: RenderJob): void { /* no-op */ }

  beginAnchor(href: string, _tip: string, _tgt: string, _id: string, job: RenderJob): void {
    const obj = job.obj;
    if (!obj || !obj.urlMapPts.length) return;
    const buf: string[] = [];
    mapOutputImap(obj.urlMapShape, obj.urlMapPts, href, buf);
    job.write(buf.join(''));
  }
}

// ---------------------------------------------------------------------------
// CmapxRenderer
// ---------------------------------------------------------------------------

/** @see plugin/core/gvrender_core_map.c FORMAT_CMAPX */
export class CmapxRenderer implements RendererPlugin {
  readonly type = 'cmapx';
  readonly quality = 0;

  beginGraph(g: Graph, job: RenderJob): void {
    const name = escapeXml(g.name);
    job.write('<map id=' + DQ + name + DQ + ' name=' + DQ + name + DQ + '>\n');
  }

  endGraph(_g: Graph, job: RenderJob): void {
    const buf: string[] = [];
    writeCmapxGraphShape(job, buf);
    job.write(buf.join(''));
    job.write('</map>\n');
  }

  beginNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  endNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  beginEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  endEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  textspan(_pos: Point, _span: TextSpan, _job: RenderJob): void { /* no-op */ }
  ellipse(_c: Point, _rx: number, _ry: number, _f: boolean, _j: RenderJob): void { /* no-op */ }
  polygon(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  bezier(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  polyline(_pts: Point[], _job: RenderJob): void { /* no-op */ }

  beginAnchor(href: string, tip: string, target: string, id: string, job: RenderJob): void {
    const obj = job.obj;
    if (!obj || !obj.urlMapPts.length) return;
    const buf: string[] = [];
    mapOutputCmapx(obj.urlMapShape, obj.urlMapPts, { url: href, tooltip: tip, target, id }, true, buf);
    job.write(buf.join(''));
  }
}

// ---------------------------------------------------------------------------
// CmapxNpRenderer
// ---------------------------------------------------------------------------

/** @see plugin/core/gvrender_core_map.c FORMAT_CMAPX (no-polygon device) */
export class CmapxNpRenderer implements RendererPlugin {
  readonly type = 'cmapx-np';
  readonly quality = 0;

  beginGraph(g: Graph, job: RenderJob): void {
    const name = escapeXml(g.name);
    job.write('<map id=' + DQ + name + DQ + ' name=' + DQ + name + DQ + '>\n');
  }

  endGraph(_g: Graph, job: RenderJob): void {
    const buf: string[] = [];
    writeCmapxGraphShape(job, buf);
    job.write(buf.join(''));
    job.write('</map>\n');
  }

  beginNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  endNode(_n: Node, _job: RenderJob): void { /* no-op */ }
  beginEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  endEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }
  textspan(_pos: Point, _span: TextSpan, _job: RenderJob): void { /* no-op */ }
  ellipse(_c: Point, _rx: number, _ry: number, _f: boolean, _j: RenderJob): void { /* no-op */ }
  polygon(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  bezier(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  polyline(_pts: Point[], _job: RenderJob): void { /* no-op */ }

  beginAnchor(href: string, tip: string, target: string, id: string, job: RenderJob): void {
    const obj = job.obj;
    if (!obj || !obj.urlMapPts.length) return;
    const buf: string[] = [];
    mapOutputCmapx(obj.urlMapShape, obj.urlMapPts, { url: href, tooltip: tip, target, id }, true, buf);
    job.write(buf.join(''));
  }
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
