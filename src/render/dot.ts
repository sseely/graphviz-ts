// SPDX-License-Identifier: EPL-2.0

/**
 * DOT and XDOT renderer plugins.
 *
 * Ports gvrender_core_dot.c — FORMAT_DOT and FORMAT_XDOT branches.
 * FORMAT_CANON, FORMAT_XDOT12, FORMAT_XDOT14 are out of scope (AD-12).
 *
 * @see plugin/core/gvrender_core_dot.c
 * @see plugin/core/gvplugin_core.c
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { Point } from '../model/geom.js';
import type { TextSpan } from '../common/emit-types.js';
import type { RendererPlugin } from '../gvc/context.js';
import type { RenderJob } from '../gvc/job.js';
import { EmitState } from '../gvc/job.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const XDOT_VERSION = '1.7';

/** Max magnitude cap — matches maxnegnum in C source. */
const MAX_NEGNUM = 999999999999999.99;

/** Near-zero suppression threshold (same as gvprintdouble). */
const NEAR_ZERO = 0.005;

/** Indices 8/9 alias 1; 10/11 alias 5. NUM_XBUFS covers 0–7. */
const NUM_XBUFS = 8;

// ---------------------------------------------------------------------------
// printNum — @see lib/gvc/gvdevice.c:gvprintnum
// ---------------------------------------------------------------------------

/**
 * Strip trailing zeros (and the decimal point) from a toFixed(3) string,
 * then collapse a leading "0." or "-0." prefix.
 */
function trimAndStrip(s: string): string {
  const dot = s.indexOf('.');
  if (dot < 0) return s;
  let end = s.length;
  while (end > dot + 1 && s[end - 1] === '0') end--;
  if (s[end - 1] === '.') end--;
  const t = s.slice(0, end);
  if (t.startsWith('0.')) return t.slice(1);
  if (t.startsWith('-0.')) return '-' + t.slice(2);
  return t;
}

/**
 * Convert a double to compact string form for DOT/XDOT output.
 *
 * Rules (porting gvprintnum from lib/gvc/gvdevice.c):
 * - |n| > MAX_NEGNUM → clamped to ±MAX_NEGNUM
 * - |n| < NEAR_ZERO → "0" (suppresses -0)
 * - 3 decimal places, trailing zeros and point stripped
 * - Leading "0." collapsed to "." (e.g. 0.5 → ".5")
 *
 * Exported for json.ts (T30) and map.ts (T31).
 *
 * @see lib/gvc/gvdevice.c:gvprintnum
 */
export function printNum(n: number): string {
  if (Math.abs(n) > MAX_NEGNUM) {
    return n < 0 ? String(-MAX_NEGNUM) : String(MAX_NEGNUM);
  }
  if (Math.abs(n) < NEAR_ZERO) return '0';
  return trimAndStrip(n.toFixed(3));
}

// ---------------------------------------------------------------------------
// XDot buffer management
// ---------------------------------------------------------------------------

/**
 * Create a 12-slot xbufs array with the canonical aliasing.
 *
 * Indices 8–9 (NDraw, EDraw) alias index 1 (CDraw).
 * Indices 10–11 (NLabel, ELabel) alias index 5 (CLabel).
 *
 * @see plugin/core/gvrender_core_dot.c:xbufs
 */
export function makeXbufs(): string[][] {
  const bufs: string[][] = Array.from({ length: NUM_XBUFS + 4 }, () => []);
  bufs[EmitState.NDraw] = bufs[EmitState.CDraw]!;
  bufs[EmitState.EDraw] = bufs[EmitState.CDraw]!;
  bufs[EmitState.NLabel] = bufs[EmitState.CLabel]!;
  bufs[EmitState.ELabel] = bufs[EmitState.CLabel]!;
  return bufs;
}

// ---------------------------------------------------------------------------
// XDOT op helpers — @see plugin/core/gvrender_core_dot.c
// ---------------------------------------------------------------------------

/** Format a single point as "x y ". */
export function xdotPoint(p: Point, yOff: number): string {
  return printNum(p.x) + ' ' + printNum(yOff - p.y) + ' ';
}

/** Format N points preceded by opcode and count. */
export function xdotPoints(c: string, pts: Point[], yOff: number): string {
  let s = c + ' ' + String(pts.length) + ' ';
  for (const p of pts) s += xdotPoint(p, yOff);
  return s;
}

/** Build the xdot "F size name " font preamble. */
export function xdotFont(span: TextSpan): string {
  const size = printNum(span.fontSize > 0 ? span.fontSize : 0);
  const name = span.fontName ?? '';
  return 'F ' + size + ' ' + String(name.length) + ' -' + name + ' ';
}

/** Build the xdot pen color op. */
export function xdotPenColor(color: string): string {
  return 'c ' + String(color.length) + ' -' + color + ' ';
}

/** Build the xdot fill color op. */
export function xdotFillColor(color: string): string {
  return 'C ' + String(color.length) + ' -' + color + ' ';
}

// ---------------------------------------------------------------------------
// DOT attribute helpers
// ---------------------------------------------------------------------------

/** Format node attributes for DOT output. */
export function formatNodeAttrs(n: Node): string {
  const info = n.info;
  const x = printNum(info.coord.x);
  const y = printNum(info.coord.y);
  const w = printNum(info.width);
  const h = printNum(info.height);
  const parts: string[] = [`pos="${x},${y}"`, `width=${w}`, `height=${h}`];
  n.attrs.forEach((v, k) => {
    if (k !== 'pos' && k !== 'width' && k !== 'height') {
      parts.push(`${k}="${v}"`);
    }
  });
  return parts.join(' ');
}

/** Format edge spline points for the DOT pos attribute. */
export function formatEdgePos(e: Edge): string {
  const spl = e.info.spl;
  if (!spl || spl.list.length === 0) return '';
  const parts: string[] = [];
  for (const bez of spl.list) {
    if (bez.eflag) {
      parts.push('e,' + printNum(bez.ep.x) + ',' + printNum(bez.ep.y));
    }
    for (const p of bez.list) {
      parts.push(printNum(p.x) + ',' + printNum(p.y));
    }
  }
  return 'pos="' + parts.join(' ') + '"';
}

/** Return the edge connector token. */
export function edgeConnector(directed: boolean): string {
  return directed ? '->' : '--';
}

/** Return true if the graph is directed or strict-directed. */
export function isDirected(g: Graph): boolean {
  return g.kind === 'directed' || g.kind === 'strict-directed';
}

// ---------------------------------------------------------------------------
// Shared graph header helper
// ---------------------------------------------------------------------------

/** Emit the opening digraph/graph line and bb attribute. */
export function dotBeginGraphHeader(g: Graph, job: RenderJob): void {
  const kw = isDirected(g) ? 'digraph' : 'graph';
  job.write(kw + ' ' + g.name + ' {\n');
  const bb = g.info.bb;
  const bbStr = printNum(bb.ll.x) + ',' + printNum(bb.ll.y) + ','
    + printNum(bb.ur.x) + ',' + printNum(bb.ur.y);
  job.write('\tgraph [bb="' + bbStr + '"];\n');
}

// ---------------------------------------------------------------------------
// DotRenderer
// ---------------------------------------------------------------------------

/**
 * DOT format renderer — writes graphviz DOT language with layout attributes.
 *
 * @see plugin/core/gvrender_core_dot.c:dot_engine
 */
export class DotRenderer implements RendererPlugin {
  readonly type = 'dot';
  /** @see plugin/core/gvplugin_core.c registration table */
  readonly quality = 0;

  beginGraph(g: Graph, job: RenderJob): void {
    dotBeginGraphHeader(g, job);
  }

  endGraph(_g: Graph, job: RenderJob): void {
    job.write('}\n');
  }

  beginNode(_n: Node, _job: RenderJob): void { /* no-op */ }

  endNode(n: Node, job: RenderJob): void {
    const attrs = formatNodeAttrs(n);
    job.write('\t' + n.name + ' [' + attrs + '];\n');
  }

  beginEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }

  endEdge(e: Edge, job: RenderJob): void {
    const directed = isDirected(e.tail.root);
    const conn = edgeConnector(directed);
    const posAttr = formatEdgePos(e);
    const attrList = posAttr ? ' [' + posAttr + ']' : '';
    job.write('\t' + e.tail.name + ' ' + conn + ' ' + e.head.name + attrList + ';\n');
  }

  textspan(_pos: Point, _span: TextSpan, _job: RenderJob): void { /* no-op */ }
  ellipse(_c: Point, _rx: number, _ry: number, _f: boolean, _j: RenderJob): void { /* no-op */ }
  polygon(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  bezier(_pts: Point[], _filled: boolean, _job: RenderJob): void { /* no-op */ }
  polyline(_pts: Point[], _job: RenderJob): void { /* no-op */ }
}

// ---------------------------------------------------------------------------
// XdotRenderer
// ---------------------------------------------------------------------------

/**
 * XDOT format renderer — annotates DOT with _draw_ and _ldraw_ xdot ops.
 *
 * @see plugin/core/gvrender_core_dot.c:xdot_engine
 */
export class XdotRenderer implements RendererPlugin {
  readonly type = 'xdot';
  /** @see plugin/core/gvplugin_core.c registration table */
  readonly quality = 0;

  /** Per-render draw buffers. Indices 8/9 alias 1; 10/11 alias 5. */
  private bufs: string[][] = makeXbufs();
  /** bb.ur.y for Y-axis inversion. @see xdot_begin_graph */
  private yOff = 0;

  beginGraph(g: Graph, job: RenderJob): void {
    this.bufs = makeXbufs();
    this.yOff = g.info.bb.ur.y;
    const kw = isDirected(g) ? 'digraph' : 'graph';
    job.write(kw + ' ' + g.name + ' {\n');
    const bb = g.info.bb;
    const bbStr = printNum(bb.ll.x) + ',' + printNum(bb.ll.y) + ','
      + printNum(bb.ur.x) + ',' + printNum(bb.ur.y);
    job.write('\tgraph [bb="' + bbStr + '" xdotversion="' + XDOT_VERSION + '"];\n');
  }

  endGraph(_g: Graph, job: RenderJob): void {
    job.write('}\n');
  }

  beginNode(_n: Node, _job: RenderJob): void { /* no-op */ }

  endNode(n: Node, job: RenderJob): void {
    const ndraw = this.bufs[EmitState.NDraw]!;
    const nlabel = this.bufs[EmitState.NLabel]!;
    const drawStr = ndraw.join('');
    const labelStr = nlabel.join('');
    const info = n.info;
    const x = printNum(info.coord.x);
    const y = printNum(info.coord.y);
    const w = printNum(info.width);
    const h = printNum(info.height);
    let attrs = `pos="${x},${y}" width=${w} height=${h}`;
    if (drawStr) attrs += ' _draw_="' + drawStr + '"';
    if (labelStr) attrs += ' _ldraw_="' + labelStr + '"';
    job.write('\t' + n.name + ' [' + attrs + '];\n');
    ndraw.length = 0;
    nlabel.length = 0;
  }

  beginEdge(_e: Edge, _job: RenderJob): void { /* no-op */ }

  endEdge(e: Edge, job: RenderJob): void {
    const edraw = this.bufs[EmitState.EDraw]!;
    const elabel = this.bufs[EmitState.ELabel]!;
    const drawStr = edraw.join('');
    const labelStr = elabel.join('');
    const directed = isDirected(e.tail.root);
    const conn = edgeConnector(directed);
    let attrs = '';
    if (drawStr) attrs += '_draw_="' + drawStr + '"';
    if (labelStr) attrs += (attrs ? ' ' : '') + '_ldraw_="' + labelStr + '"';
    const attrList = attrs ? ' [' + attrs + ']' : '';
    job.write('\t' + e.tail.name + ' ' + conn + ' ' + e.head.name + attrList + ';\n');
    edraw.length = 0;
    elabel.length = 0;
  }

  textspan(pos: Point, span: TextSpan, job: RenderJob): void {
    const buf = this.getBuf(job);
    const j = span.just === 'l' ? -1 : span.just === 'r' ? 1 : 0;
    const p = { x: pos.x, y: pos.y + span.yoffset_centerline };
    const fontOp = xdotFont(span);
    const colorOp = xdotPenColor(span.fontColor ?? '#000000');
    const pt = xdotPoint(p, this.yOff);
    const w = printNum(span.size.x);
    const str = span.str;
    const textOp = 'T ' + pt + String(j) + ' ' + w + ' ' + String(str.length) + ' -' + str + ' ';
    buf.push(fontOp, colorOp, textOp);
  }

  ellipse(center: Point, rx: number, ry: number, filled: boolean, job: RenderJob): void {
    const buf = this.getBuf(job);
    const op = filled ? 'E ' : 'e ';
    const penOp = xdotPenColor('#000000');
    const fillOp = filled ? xdotFillColor('#000000') : '';
    const pt = xdotPoint(center, this.yOff);
    buf.push(penOp, fillOp, op, pt, printNum(rx) + ' ', printNum(ry) + ' ');
  }

  polygon(pts: Point[], filled: boolean, job: RenderJob): void {
    const buf = this.getBuf(job);
    const op = filled ? 'P' : 'p';
    const penOp = xdotPenColor('#000000');
    const fillOp = filled ? xdotFillColor('#000000') : '';
    buf.push(penOp, fillOp, xdotPoints(op, pts, this.yOff));
  }

  bezier(pts: Point[], filled: boolean, job: RenderJob): void {
    const buf = this.getBuf(job);
    const op = filled ? 'b' : 'B';
    const penOp = xdotPenColor('#000000');
    const fillOp = filled ? xdotFillColor('#000000') : '';
    buf.push(penOp, fillOp, xdotPoints(op, pts, this.yOff));
  }

  polyline(pts: Point[], job: RenderJob): void {
    const buf = this.getBuf(job);
    buf.push(xdotPenColor('#000000'), xdotPoints('L', pts, this.yOff));
  }

  /** Return the active xdot buffer for the current emit state. */
  private getBuf(job: RenderJob): string[] {
    const obj = job.obj;
    const state = obj !== null ? obj.emitState : EmitState.GDraw;
    return this.bufs[state]!;
  }
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/** @see plugin/core/gvrender_core_dot.c FORMAT_DOT */
export function createDotRenderer(): RendererPlugin {
  return new DotRenderer();
}

/** @see plugin/core/gvrender_core_dot.c FORMAT_XDOT */
export function createXdotRenderer(): RendererPlugin {
  return new XdotRenderer();
}
