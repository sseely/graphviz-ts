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
import type { ArrowDrawOp } from '../common/arrows-types.js';
import type { GVColor } from '../common/color.js';
import { colorxlate } from '../common/color.js';
import { resolveRenderColor } from './color-resolve.js';
import { getGradientPoints } from './svg-gradient.js';
import { edgeIsTapered } from './svg-tapered-edge.js';
import { findStopColor, parseStyleFlags } from '../common/style-resolve.js';
import { parseSegs } from '../common/multicolor.js';
import { buildOffsetLists, advanceTmpList } from '../common/edge-offset.js';
import type { Bezier } from '../model/geom.js';
import type { RendererPlugin } from '../gvc/context.js';
import { PenType, FillType } from '../gvc/context.js';
import type { RenderJob, ObjState } from '../gvc/job.js';
import { EmitState } from '../gvc/job.js';
import { renderEdgeLabels } from '../gvc/edge-labels.js';

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

/**
 * Format one xdot draw-op number: 2 decimals, trailing zeros and point trimmed
 * — mirroring xdot_fmt_num ("%.02f" + agxbuf_trim_zeros). Distinct from
 * `printNum` (used for the DOT `pos`/`bb`/`width`/`height` attributes), which
 * keeps more precision; xdot's DRAW ops are emitted at 2 dp by the C engine.
 * @see plugin/core/gvrender_core_dot.c:126 xdot_fmt_num
 */
export function xdotNum(v: number): string {
  let s = v.toFixed(2);
  if (s.indexOf('.') >= 0) {
    let end = s.length;
    while (end > 0 && s[end - 1] === '0') end--;
    if (s[end - 1] === '.') end--;
    s = s.slice(0, end);
  }
  return s === '-0' ? '0' : s;
}

/**
 * Format a single xdot point "x y ". xdot is y-up: `Y_invert` defaults false, so
 * `yDir(y, yOff)` returns `y` unchanged for xdot (only `-Ty` plain/dot invert).
 * The layout coordinate passes through with NO inversion — unlike the SVG path.
 * @see lib/common/output.c:36 yDir · plugin/core/gvrender_core_dot.c:132 xdot_point
 */
export function xdotPoint(p: Point): string {
  return xdotNum(p.x) + ' ' + xdotNum(p.y) + ' ';
}

/** Format N points preceded by opcode and count: "<c> <n> x0 y0 x1 y1 …". */
export function xdotPoints(c: string, pts: Point[]): string {
  let s = c + ' ' + String(pts.length) + ' ';
  for (const p of pts) s += xdotPoint(p);
  return s;
}

/**
 * UTF-8 byte length of a string — the value C's `xdot_str` writes as the length
 * prefix (`strlen(s)` over the UTF-8 bytes), NOT the JS UTF-16 code-unit count.
 * A label like `ÿ` (U+00FF) is 2 UTF-8 bytes, so its `T`/`F` op prefix is 2.
 * @see plugin/core/gvrender_core_dot.c:83 xdot_str_xbuf (`%zu`, strlen)
 */
export function utf8Len(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } // surrogate pair → 4 bytes
    else n += 3;
  }
  return n;
}

/** Clamp a normalized [0,1] float channel to a 0-255 byte (round-to-nearest). */
function chanByte(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 255);
}

/**
 * Resolve a GVColor to RGBA bytes — the value the C xdot callbacks read from
 * `job->obj->pencolor.u.rgba` (already resolved by gvrender_set_pencolor). A
 * plain `rgba` passes through; named/hex/HSV specs run through colorxlate; a
 * `none` color is fully transparent black (callers gate on PEN_NONE).
 */
export function gvColorRgba(c: GVColor): [number, number, number, number] {
  if (c.type === 'rgba') return [chanByte(c.r), chanByte(c.g), chanByte(c.b), chanByte(c.a)];
  if (c.type === 'none') return [0, 0, 0, 0];
  const out: GVColor = { type: 'rgba', r: 0, g: 0, b: 0, a: 0 };
  colorxlate(c.type === 'string' ? c.s : '', out, 'rgba');
  return out.type === 'rgba'
    ? [chanByte(out.r), chanByte(out.g), chanByte(out.b), chanByte(out.a)]
    : [0, 0, 0, 255];
}

/**
 * Bare xdot color body (no `c `/`C ` prefix): the CONSTANT length prefix
 * (7 for `#rrggbb`, 9 for `#rrggbbaa`) plus `-#hex`, the alpha byte present only
 * when not fully opaque. Used both by the color ops and by gradient color stops.
 * @see plugin/core/gvrender_core_dot.c:99 xdot_str_color_xbuf
 */
export function xdotColorBody(rgba: [number, number, number, number]): string {
  const hx = (n: number): string => n.toString(16).padStart(2, '0');
  const body = '#' + hx(rgba[0]) + hx(rgba[1]) + hx(rgba[2]);
  return rgba[3] === 0xff ? '7 -' + body : '9 -' + body + hx(rgba[3]);
}

/**
 * Format an xdot color op ("c "/"C ") from RGBA bytes.
 * @see plugin/core/gvrender_core_dot.c:99 xdot_str_color_xbuf
 */
export function xdotColorOp(prefix: 'c ' | 'C ', rgba: [number, number, number, number]): string {
  return prefix + xdotColorBody(rgba) + ' ';
}

/**
 * Build the linear-gradient `C len -[x0 y0 x1 y1 2 <stops>]` fill op. Endpoints
 * come from getGradientPoints (the same geometry the SVG gradient uses); stops
 * are (frac,fill)/(frac,stop) when frac>0, else (0,fill)/(1,stop). Shared by
 * node/cluster gradient fills and the graph-background gradient.
 * @see plugin/core/gvrender_core_dot.c:544-598 xdot_gradient_fillcolor
 */
export function linearGradientOp(
  pts: Point[],
  fillColor: GVColor,
  stopColor: GVColor,
  frac: number,
  angleDeg: number,
): string {
  const { g0, g1 } = getGradientPoints(pts, (angleDeg * Math.PI) / 180, false);
  const inner =
    '[' + xdotNum(g0.x) + ' ' + xdotNum(g0.y) + ' ' + xdotNum(g1.x) + ' ' + xdotNum(g1.y) +
    ' 2 ' + gradientStops(fillColor, stopColor, frac) + ']';
  return 'C ' + String(utf8Len(inner)) + ' -' + inner + ' ';
}

/** The `<frac> <colorbody>` stop pairs for a gradient (frac>0 vs the 0/1 form). */
function gradientStops(fillColor: GVColor, stopColor: GVColor, frac: number): string {
  const fill = gvColorRgba(fillColor);
  const stop = gvColorRgba(stopColor);
  const stops: Array<[number, [number, number, number, number]]> =
    frac > 0 ? [[frac, fill], [frac, stop]] : [[0, fill], [1, stop]];
  return stops.map(([f, c]) => trimFixed3(f) + ' ' + xdotColorBody(c)).join(' ');
}

/**
 * Build the radial-gradient `C len -(c1x c1y r1 c2x c2y r2 2 <stops>)` fill op.
 * Reuses getGradientPoints (radial) for the center/radii, un-negating its SVG
 * y. r1 = outerR/4, r2 = outerR; c2 is the center, c1 the center offset by r1
 * along the gradient angle (== center when angle 0).
 * @see plugin/core/gvrender_core_dot.c:562-585 xdot_gradient_fillcolor (radial)
 */
export function radialGradientOp(
  pts: Point[],
  fillColor: GVColor,
  stopColor: GVColor,
  frac: number,
  angleDeg: number,
): string {
  const rad = (angleDeg * Math.PI) / 180;
  const gp = getGradientPoints(pts, rad, true);
  const cx = gp.g0.x;
  const cy = -gp.g0.y; // un-negate the SVG y-down convention
  const r1 = gp.g1.x;
  const r2 = gp.g1.y;
  const c1x = angleDeg === 0 ? cx : cx + r1 * Math.cos(rad);
  const c1y = angleDeg === 0 ? cy : cy + r1 * Math.sin(rad);
  const inner =
    '(' + xdotNum(c1x) + ' ' + xdotNum(c1y) + ' ' + xdotNum(r1) + ' ' +
    xdotNum(cx) + ' ' + xdotNum(cy) + ' ' + xdotNum(r2) + ' 2 ' +
    gradientStops(fillColor, stopColor, frac) + ')';
  return 'C ' + String(utf8Len(inner)) + ' -' + inner + ' ';
}

/** Pen ("c ") color op from a resolved GVColor. */
export function xdotPenColor(c: GVColor): string {
  return xdotColorOp('c ', gvColorRgba(c));
}

/** Fill ("C ") color op from a resolved GVColor. */
export function xdotFillColor(c: GVColor): string {
  return xdotColorOp('C ', gvColorRgba(c));
}

/**
 * Build the xdot "F size len -name " font op. Mirrors xdot_textspan's `F` +
 * `xdot_str(job, "", font->name)` — the length prefix is the byte length of the
 * face name. @see plugin/core/gvrender_core_dot.c:498 xdot_textspan
 */
export function xdotFont(size: number, name: string): string {
  return 'F ' + xdotNum(size > 0 ? size : 0) + ' ' + String(utf8Len(name)) + ' -' + name + ' ';
}

/**
 * Build an xdot length-prefixed string op ("S "/"" prefix): "<pfx><len> -<s> ".
 * @see plugin/core/gvrender_core_dot.c:83 xdot_str_xbuf
 */
function xdotStrOp(prefix: string, s: string): string {
  return prefix + String(utf8Len(s)) + ' -' + s + ' ';
}

/**
 * Quote a DOT identifier unless it is a bare id or numeral, mirroring agwrite's
 * agcanonStr so the serialized graph reparses (the comparator reparses both
 * sides). Only `"` is escaped (→ `\"`); a `\` is left as-is — it is already the
 * start of a stored escape like `\n`/`\l` that agcanonStr keeps verbatim, so
 * doubling it (`\\n`) would change the name (`a\n(b\n"c")` must stay `a\n…`, not
 * `a\\n…`). Over-quoting a value native leaves bare is harmless: both parse to
 * the same name. @see lib/cgraph/write.c:_agstrcanon (escapes '"', keeps '\')
 */
export function xdotId(s: string): string {
  if (/^[A-Za-z_][A-Za-z_0-9]*$/.test(s)) return s;
  if (/^-?(\.[0-9]+|[0-9]+(\.[0-9]*)?)$/.test(s)) return s;
  return '"' + s.replace(/"/g, '\\"') + '"';
}

/**
 * Format a number as C's `%.5g` — 5 significant figures, trailing zeros and
 * point trimmed, switching to `e±NN` (min 2 exponent digits) when the exponent
 * is < -4 or ≥ 5. Native writes the DOT `pos`/`bb`/`width`/`height` attributes
 * with `%.5g` (output.c:71/294/302), so large coordinates round to 5 sig figs
 * (`2219962` → `2.2201e+06`); `printNum`'s fixed 3 dp keeps too much precision.
 * @see lib/common/output.c:71 (agxbprint "%.5g")
 */
export function gfmt5(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return '0';
  let s = v.toPrecision(5);
  const e = s.indexOf('e');
  if (e >= 0) {
    let mant = s.slice(0, e);
    if (mant.indexOf('.') >= 0) mant = mant.replace(/0+$/, '').replace(/\.$/, '');
    const ei = parseInt(s.slice(e + 1), 10);
    return mant + 'e' + (ei < 0 ? '-' : '+') + String(Math.abs(ei)).padStart(2, '0');
  }
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
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

/**
 * Format edge spline points for the DOT `pos` attribute. Per bezier: the start
 * endpoint `s,sp` when `sflag` set, then the end endpoint `e,ep` when `eflag`
 * set, then `bez.size` control points — all at `%.5g`, exactly as native's
 * spline serialization. @see lib/common/output.c:357-372
 */
export function formatEdgePos(e: Edge): string {
  const spl = e.info.spl;
  if (!spl || spl.list.length === 0) return '';
  const parts: string[] = [];
  for (const bez of spl.list) {
    if (bez.sflag) parts.push('s,' + gfmt5(bez.sp.x) + ',' + gfmt5(bez.sp.y));
    if (bez.eflag) parts.push('e,' + gfmt5(bez.ep.x) + ',' + gfmt5(bez.ep.y));
    const pts = bez.list.slice(0, bez.size);
    for (const p of pts) parts.push(gfmt5(p.x) + ',' + gfmt5(p.y));
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

/** Accumulated xdot draw strings for one model object (agset side-table). */
interface XdotDraws {
  draw?: string;
  ldraw?: string;
  hdraw?: string;
  tdraw?: string;
  hldraw?: string;
  tldraw?: string;
}

/** Trim a "%.3f" fixed string like C's agxbuf_trim_zeros (trailing 0s + dot). */
function trimFixed3(v: number): string {
  let s = v.toFixed(3);
  if (s.indexOf('.') < 0) return s;
  let end = s.length;
  while (end > 0 && s[end - 1] === '0') end--;
  if (s[end - 1] === '.') end--;
  return s.slice(0, end);
}

/**
 * XDOT format renderer — mirrors plugin/core/gvrender_core_dot.c's xdot engine.
 *
 * Draw ops accumulate in per-emit-state xbufs during the shared emit pass; at
 * the end of each object they are attached as `_draw_`/`_ldraw_`/`_hdraw_`/
 * `_tdraw_` strings (a side-table here, `agset` in C), and the whole graph is
 * serialized at `endGraph` — the model-attribute + agwrite-at-end model that
 * lets the graph-level `_draw_` (canvas background, cluster boxes) precede `bb`
 * even though it is only known after the body has been drawn.
 *
 * xdot is y-up (no coordinate inversion); colors come from the resolved
 * graphics state (`job.obj.penColor`/`fillColor`), not hardcoded black.
 *
 * @see plugin/core/gvrender_core_dot.c xdot_begin_graph / xdot_end_graph
 */
export class XdotRenderer implements RendererPlugin {
  readonly type = 'xdot';
  /** @see plugin/core/gvplugin_core.c registration table */
  readonly quality = 0;

  /** Per-render draw buffers. Indices 8/9 alias 1; 10/11 alias 5. */
  private bufs: string[][] = makeXbufs();
  /** setlinewidth state per emit_state. @see gvrender_core_dot.c penwidth[] */
  private penwidth: number[] = new Array(12).fill(1);
  /** text-flag state per emit_state. @see gvrender_core_dot.c textflags[] */
  private textflags: number[] = new Array(12).fill(0);
  /** Accumulated draw strings keyed by model object (C: agset on the object). */
  private draws = new Map<Node | Edge | Graph, XdotDraws>();

  beginGraph(g: Graph, _job: RenderJob): void {
    this.bufs = makeXbufs();
    this.penwidth = new Array(12).fill(1);
    this.textflags = new Array(12).fill(0);
    this.draws = new Map();
  }

  endGraph(g: Graph, job: RenderJob): void {
    // Flush the graph-level GDRAW/GLABEL buffers (canvas background + graph
    // label) onto the root graph, then serialize the whole graph.
    // @see gvrender_core_dot.c:427 xdot_end_graph
    const gd = this.flush(EmitState.GDraw);
    const gl = this.flush(EmitState.GLabel);
    if (gd || gl) {
      const set = this.drawsFor(g);
      if (gd) set.draw = gd;
      if (gl) set.ldraw = gl;
    }
    job.write(this.serialize(g));
  }

  /** Emit the canvas background polygon into the GDRAW buffer.
   *  @see lib/common/emit.c:1476 emit_background */
  pageBackground(g: Graph, job: RenderJob): void {
    const bg = g.attrs.get('bgcolor');
    const fillSpec = bg !== undefined && bg !== '' ? bg : 'white';
    const clip = job.bb;
    const corners: Point[] = [
      { x: clip.ll.x, y: clip.ll.y },
      { x: clip.ll.x, y: clip.ur.y },
      { x: clip.ur.x, y: clip.ur.y },
      { x: clip.ur.x, y: clip.ll.y },
    ];
    const buf = this.bufs[EmitState.GDraw]!;
    buf.push(xdotPenColor(resolveRenderColor('transparent')));
    // A two-color bgcolor is a gradient (emit_background → findStopColor); a
    // linear one emits the bracketed fill, a radial one is deferred to the base.
    const stop = fillSpec.includes(':') ? findStopColor(fillSpec) : null;
    if (stop !== null) {
      const angle = Number(g.attrs.get('gradientangle') ?? 0) || 0;
      const radial = parseStyleFlags(g.attrs.get('style')).radial;
      const op = radial ? radialGradientOp : linearGradientOp;
      buf.push(
        op(corners, resolveRenderColor(stop.fillColor), resolveRenderColor(stop.stopColor), stop.frac, angle),
      );
    } else {
      buf.push(xdotFillColor(resolveRenderColor(fillSpec)));
    }
    buf.push(xdotPoints('P', corners));
  }

  beginNode(_n: Node, _job: RenderJob): void { /* no-op */ }

  endNode(n: Node, _job: RenderJob): void {
    const draw = this.flush(EmitState.NDraw);
    const ldraw = this.flush(EmitState.NLabel);
    if (draw || ldraw) {
      const set = this.drawsFor(n);
      if (draw) set.draw = draw;
      if (ldraw) set.ldraw = ldraw;
    }
    this.resetState(EmitState.NDraw, EmitState.NLabel);
  }

  /**
   * Emit the edge spline beziers (EDRAW) and arrowhead ops (TDRAW/HDRAW),
   * reading the already-routed geometry from `e.info`. Mirrors
   * emit_edge_graphics: each bezier under the edge pen, then tail/head arrows
   * under the default solid line style. The port draws SVG edges directly in
   * svg.ts (not via shared bezier/polygon callbacks), so the xdot edge draw is
   * self-contained here — the same per-renderer split the port already uses.
   * @see lib/common/emit.c:emit_edge_graphics
   */
  beginEdge(e: Edge, job: RenderJob): void {
    const spl = e.info.spl;
    if (spl === undefined) return;
    const edraw = this.bufs[EmitState.EDraw]!;
    const colorAttr = e.attrs.get('color') ?? '';
    const numc = (colorAttr.match(/:/g) ?? []).length;
    const numsemi = (colorAttr.match(/;/g) ?? []).length;
    // Plain `:` multicolor (no `;`, not tapered) → N parallel offset beziers,
    // one per color; else the single-color spline. @see emit.c:2443
    if (numc > 0 && numsemi === 0 && !edgeIsTapered(e)) {
      this.emitParallelSpline(spl.list as (Bezier | undefined)[], colorAttr, numc, edraw, job);
    } else {
      for (const bez of spl.list) {
        edraw.push(this.styleOp(job), this.penOp(job));
        edraw.push(xdotPoints('B', bez.list.slice(0, bez.size)));
      }
    }
    // Arrows: y-up ops already computed for the shared render path. C sets the
    // default line style ("solid") + penwidth before each arrow primitive.
    this.emitArrows(this.bufs[EmitState.TDraw]!, e.info.tailArrowOps, job);
    this.emitArrows(this.bufs[EmitState.HDraw]!, e.info.headArrowOps, job);
  }

  /**
   * Emit the parallel-multicolor edge spline: one offset Bézier per color,
   * offset SEP=2.0 perpendicular per pass — reusing the same offset geometry
   * (buildOffsetLists/advanceTmpList) as the SVG parallel-edge path.
   * @see lib/common/emit.c:2443 (parallel multicolor) / svg-parallel-edge.ts
   */
  private emitParallelSpline(
    bzList: (Bezier | undefined)[],
    colorAttr: string,
    numc: number,
    edraw: string[],
    job: RenderJob,
  ): void {
    const segData = bzList.map((bz) =>
      bz !== undefined && bz.size >= 4
        ? buildOffsetLists(bz.list, (2 + numc) / 2)
        : { offlist: [] as Point[], tmplist: [] as Point[] },
    );
    const colors = parseSegs(colorAttr).segs.map((s) => s.color ?? 'black');
    for (const color of colors) {
      const pen = xdotPenColor(resolveRenderColor(color));
      for (const sd of segData) {
        if (sd.offlist.length === 0) continue;
        advanceTmpList(sd.tmplist, sd.offlist);
        edraw.push(this.styleOp(job), pen, xdotPoints('B', sd.tmplist));
      }
    }
  }

  /** Emit one arrow's primitive ops into `buf` (pen/fill from the edge color). */
  private emitArrows(buf: string[], ops: ArrowDrawOp[] | undefined, job: RenderJob): void {
    if (ops === undefined) return;
    const pen = job.obj?.penColor ?? { type: 'string', s: 'black' };
    for (const op of ops) {
      buf.push(xdotStrOp('S ', 'solid'));
      buf.push(xdotPenColor(pen));
      switch (op.kind) {
        case 'polygon':
          if (op.filled) buf.push(xdotFillColor(pen));
          buf.push(xdotPoints(op.filled ? 'P' : 'p', op.points));
          break;
        case 'ellipse':
          if (op.filled) buf.push(xdotFillColor(pen));
          buf.push(
            (op.filled ? 'E ' : 'e ') + xdotPoint(op.center) +
              xdotNum(op.rx) + ' ' + xdotNum(op.ry) + ' ',
          );
          break;
        case 'polyline':
          buf.push(xdotPoints('L', op.points));
          break;
        case 'bezier':
          buf.push(xdotPoints('B', op.points));
          break;
      }
    }
  }

  endEdge(e: Edge, job: RenderJob): void {
    // Emit the edge's labels (center/xlabel/head/tail) — the port draws these
    // in svg.ts endEdge, not the shared path, so the xdot renderer runs them
    // itself, mirroring emit_edge's emit_edge_label. gvrenderTextspan routes
    // each span to the edge's ELABEL buffer → _ldraw_. @see emit.c:3010
    renderEdgeLabels(e, this, job);
    const draw = this.flush(EmitState.EDraw);
    const hdraw = this.flush(EmitState.HDraw);
    const tdraw = this.flush(EmitState.TDraw);
    const ldraw = this.flush(EmitState.ELabel);
    const hldraw = this.flush(EmitState.HLabel);
    const tldraw = this.flush(EmitState.TLabel);
    if (draw || hdraw || tdraw || ldraw || hldraw || tldraw) {
      const set = this.drawsFor(e);
      if (draw) set.draw = draw;
      if (hdraw) set.hdraw = hdraw;
      if (tdraw) set.tdraw = tdraw;
      if (ldraw) set.ldraw = ldraw;
      if (hldraw) set.hldraw = hldraw;
      if (tldraw) set.tldraw = tldraw;
    }
    this.resetState(EmitState.EDraw, EmitState.ELabel);
    this.resetState(EmitState.HDraw, EmitState.TDraw);
    this.penwidth[EmitState.HLabel] = 1;
    this.penwidth[EmitState.TLabel] = 1;
    this.textflags[EmitState.HLabel] = 0;
    this.textflags[EmitState.TLabel] = 0;
  }

  beginCluster(_sg: Graph, _job: RenderJob): void { /* no-op */ }

  endCluster(sg: Graph, _job: RenderJob): void {
    const draw = this.flush(EmitState.CDraw);
    const ldraw = this.flush(EmitState.CLabel);
    if (draw || ldraw) {
      const set = this.drawsFor(sg);
      if (draw) set.draw = draw;
      if (ldraw) set.ldraw = ldraw;
    }
    this.resetState(EmitState.CDraw, EmitState.CLabel);
  }

  textspan(pos: Point, span: TextSpan, job: RenderJob): void {
    const buf = this.getBuf(job);
    const st = job.obj !== null ? job.obj.emitState : EmitState.GDraw;
    const j = span.just === 'l' ? -1 : span.just === 'r' ? 1 : 0;
    const p = { x: pos.x, y: pos.y + span.yoffset_centerline };
    buf.push(xdotFont(span.fontSize, span.fontName ?? ''));
    buf.push(xdotPenColor(resolveRenderColor(span.fontColor ?? 'black')));
    // Text flags (xdot version >= 15): emit `t <bits>` only when they change.
    // @see gvrender_core_dot.c:520 xdot_textspan
    const bits = (span.fontFlags ?? 0) & 0x7f;
    if (this.textflags[st] !== bits) {
      buf.push('t ' + String(bits) + ' ');
      this.textflags[st] = bits;
    }
    buf.push(
      'T ' + xdotPoint(p) + String(j) + ' ' + xdotNum(span.size.x) + ' ' +
        String(utf8Len(span.str)) + ' -' + span.str + ' ',
    );
  }

  ellipse(center: Point, rx: number, ry: number, filled: boolean, job: RenderJob): void {
    const buf = this.getBuf(job);
    buf.push(this.styleOp(job), this.penOp(job));
    // C passes A=[center, corner] to the gradient; corner = center + (rx,ry).
    if (filled) buf.push(this.fillOp(job, [center, { x: center.x + rx, y: center.y + ry }]));
    buf.push(filled ? 'E ' : 'e ', xdotPoint(center), xdotNum(rx) + ' ' + xdotNum(ry) + ' ');
  }

  polygon(pts: Point[], filled: boolean, job: RenderJob): void {
    const buf = this.getBuf(job);
    buf.push(this.styleOp(job), this.penOp(job));
    if (filled) buf.push(this.fillOp(job, pts));
    buf.push(xdotPoints(filled ? 'P' : 'p', pts));
  }

  bezier(pts: Point[], filled: boolean, job: RenderJob): void {
    const buf = this.getBuf(job);
    buf.push(this.styleOp(job), this.penOp(job));
    if (filled) buf.push(this.fillOp(job, pts));
    // NB 'b'/'B' are reversed vs the other ops. @see gvrender_core_dot.c:632
    buf.push(xdotPoints(filled ? 'b' : 'B', pts));
  }

  polyline(pts: Point[], job: RenderJob): void {
    const buf = this.getBuf(job);
    buf.push(this.styleOp(job), this.penOp(job), xdotPoints('L', pts));
  }

  // --- graphics-state ops ------------------------------------------------

  /** Pen color op from the resolved graphics state (default black). */
  private penOp(job: RenderJob): string {
    return xdotPenColor(job.obj?.penColor ?? { type: 'string', s: 'black' });
  }

  /**
   * Fill op from the resolved graphics state. A linear gradient emits the
   * bracketed `C len -[G0 G1 2 <stops>]` form (xdot_gradient_fillcolor); a plain
   * fill emits `C len -#hex`. `pts` are the shape points the gradient endpoints
   * derive from. Radial gradients are deferred (emit the base fill).
   * @see plugin/core/gvrender_core_dot.c:544 xdot_gradient_fillcolor
   */
  private fillOp(job: RenderJob, pts: Point[]): string {
    const obj = job.obj;
    if (obj && obj.fill === FillType.Linear) {
      return linearGradientOp(pts, obj.fillColor, obj.stopColor, obj.gradientFrac, obj.gradientAngle);
    }
    if (obj && obj.fill === FillType.Radial) {
      return radialGradientOp(pts, obj.fillColor, obj.stopColor, obj.gradientFrac, obj.gradientAngle);
    }
    return xdotFillColor(obj?.fillColor ?? { type: 'string', s: 'black' });
  }

  /** Style ops (`S`): setlinewidth on a penwidth change, plus dash/dot pen.
   *  @see gvrender_core_dot.c:161 xdot_style */
  private styleOp(job: RenderJob): string {
    const obj = job.obj;
    if (obj === null) return '';
    let s = '';
    const st = obj.emitState;
    if (Math.abs(obj.penWidth - this.penwidth[st]!) >= 0.0005) {
      this.penwidth[st] = obj.penWidth;
      s += xdotStrOp('S ', 'setlinewidth(' + trimFixed3(obj.penWidth) + ')');
    }
    // Named styles carried in obj.rawStyle (e.g. the HTML paint's "solid" that
    // mirrors C's set_style before each table border) are emitted verbatim,
    // skipping the ones xdot_style filters (filled/bold/setlinewidth).
    for (const p of obj.rawStyle) {
      if (p === 'filled' || p === 'bold' || p === 'setlinewidth') continue;
      s += xdotStrOp('S ', p);
    }
    // The port resolves user edge/node style into a PenType rather than
    // rawStyle, so reconstruct the dash/dot token C would emit from it.
    if (obj.pen === PenType.Dashed) s += xdotStrOp('S ', 'dashed');
    else if (obj.pen === PenType.Dotted) s += xdotStrOp('S ', 'dotted');
    return s;
  }

  // --- buffer + side-table plumbing --------------------------------------

  /** Active xdot buffer for the current emit state. */
  private getBuf(job: RenderJob): string[] {
    const obj = job.obj;
    return this.bufs[obj !== null ? obj.emitState : EmitState.GDraw]!;
  }

  /** Join and clear the buffer for `state`; returns '' when empty. */
  private flush(state: EmitState): string {
    const buf = this.bufs[state]!;
    const s = buf.join('');
    buf.length = 0;
    return s;
  }

  /** Reset per-emit-state penwidth/textflags after an object (C's reset). */
  private resetState(draw: EmitState, label: EmitState): void {
    this.penwidth[draw] = 1;
    this.penwidth[label] = 1;
    this.textflags[draw] = 0;
    this.textflags[label] = 0;
  }

  private drawsFor(o: Node | Edge | Graph): XdotDraws {
    let d = this.draws.get(o);
    if (d === undefined) {
      d = {};
      this.draws.set(o, d);
    }
    return d;
  }

  // --- serialization (agwrite-at-end) ------------------------------------

  /**
   * Emit `key="value"`, escaping `"` as `\"` in the value the way agwrite's
   * agcanonStr does — a draw string carries label text that may contain a bare
   * `"` (e.g. a `"c")` span), which would otherwise close the attribute early.
   * The byte-length prefix stays on the UNescaped text (the parser un-escapes
   * `\"`→`"` before parseXDot re-reads it), matching native exactly.
   * @see lib/cgraph/write.c:_agstrcanon (escapes '"'; leaves other chars)
   */
  private drawAttr(key: string, value: string): string {
    return key + '="' + value.replace(/"/g, '\\"') + '"';
  }

  /** `llx,lly,urx,ury` from a graph's layout bb. */
  private bbStr(g: Graph): string {
    const bb = g.info.bb;
    return gfmt5(bb.ll.x) + ',' + gfmt5(bb.ll.y) + ',' +
      gfmt5(bb.ur.x) + ',' + gfmt5(bb.ur.y);
  }

  /** Serialize the whole laid-out graph to xdot DOT text. */
  private serialize(g: Graph): string {
    const out: string[] = [];
    const strict = g.kind === 'strict-directed' || g.kind === 'strict-undirected' ? 'strict ' : '';
    const kw = isDirected(g) ? 'digraph' : 'graph';
    const nm = g.name.length > 0 ? xdotId(g.name) + ' ' : '';
    out.push(strict + kw + ' ' + nm + '{\n');
    out.push('\tgraph [' + this.graphAttrs(g) + '];\n');
    out.push('\tnode [label="\\N"];\n');
    for (const sg of this.clustersWithDraw(g)) {
      out.push('\tsubgraph ' + xdotId(sg.name) + ' {\n');
      out.push('\t\tgraph [' + this.clusterAttrs(sg) + '];\n');
      out.push('\t}\n');
    }
    for (const n of this.allNodes(g)) {
      out.push('\t' + xdotId(n.name) + ' [' + this.nodeAttrs(n) + '];\n');
    }
    for (const e of g.edges) out.push('\t' + this.edgeLine(e, g) + '\n');
    out.push('}\n');
    return out.join('');
  }

  /** Root-graph attribute block: `_draw_`, `_ldraw_`, `bb`, `xdotversion`. */
  private graphAttrs(g: Graph): string {
    const d = this.draws.get(g);
    const parts: string[] = [];
    if (d?.draw) parts.push(this.drawAttr('_draw_', d.draw));
    if (d?.ldraw) parts.push(this.drawAttr('_ldraw_', d.ldraw));
    parts.push('bb="' + this.bbStr(g) + '"');
    parts.push('xdotversion="' + XDOT_VERSION + '"');
    return parts.join(' ');
  }

  /** Cluster attribute block: `_draw_`, `_ldraw_`, `bb`. */
  private clusterAttrs(sg: Graph): string {
    const d = this.draws.get(sg);
    const parts: string[] = [];
    if (d?.draw) parts.push(this.drawAttr('_draw_', d.draw));
    if (d?.ldraw) parts.push(this.drawAttr('_ldraw_', d.ldraw));
    if (sg.info.bb) parts.push('bb="' + this.bbStr(sg) + '"');
    return parts.join(' ');
  }

  /** Node attribute block: pos/width/height plus `_draw_`/`_ldraw_`. */
  private nodeAttrs(n: Node): string {
    const info = n.info;
    let s = 'pos="' + gfmt5(info.coord.x) + ',' + gfmt5(info.coord.y) + '"' +
      ' width=' + gfmt5(info.width) + ' height=' + gfmt5(info.height);
    const d = this.draws.get(n);
    if (d?.draw) s += ' ' + this.drawAttr('_draw_', d.draw);
    if (d?.ldraw) s += ' ' + this.drawAttr('_ldraw_', d.ldraw);
    return s;
  }

  /** One edge statement with its draw attributes and spline `pos`. */
  private edgeLine(e: Edge, g: Graph): string {
    const conn = edgeConnector(isDirected(g));
    const d = this.draws.get(e);
    const parts: string[] = [];
    if (d?.draw) parts.push(this.drawAttr('_draw_', d.draw));
    if (d?.ldraw) parts.push(this.drawAttr('_ldraw_', d.ldraw));
    if (d?.hdraw) parts.push(this.drawAttr('_hdraw_', d.hdraw));
    if (d?.tdraw) parts.push(this.drawAttr('_tdraw_', d.tdraw));
    if (d?.hldraw) parts.push(this.drawAttr('_hldraw_', d.hldraw));
    if (d?.tldraw) parts.push(this.drawAttr('_tldraw_', d.tldraw));
    const pos = formatEdgePos(e);
    if (pos) parts.push(pos);
    const attrs = parts.length > 0 ? ' [' + parts.join(' ') + ']' : '';
    return xdotId(e.tail.name) + ' ' + conn + ' ' + xdotId(e.head.name) + attrs + ';';
  }

  /** Every node once, root scope then sub-scopes, dedup by name. */
  private allNodes(g: Graph): Node[] {
    const seen = new Set<string>();
    const out: Node[] = [];
    const visit = (gr: Graph): void => {
      for (const [name, n] of gr.nodes) {
        if (!seen.has(name)) { seen.add(name); out.push(n); }
      }
      for (const sg of gr.subgraphs.values()) visit(sg);
    };
    visit(g);
    return out;
  }

  /** Subgraphs (recursively) that accumulated a draw string — the clusters. */
  private clustersWithDraw(g: Graph): Graph[] {
    const out: Graph[] = [];
    const visit = (gr: Graph): void => {
      for (const sg of gr.subgraphs.values()) {
        if (this.draws.has(sg)) out.push(sg);
        visit(sg);
      }
    };
    visit(g);
    return out;
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
