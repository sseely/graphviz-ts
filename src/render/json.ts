// SPDX-License-Identifier: EPL-2.0

/**
 * JSON and JSON0 renderer plugins.
 *
 * Ports plugin/core/gvrender_core_json.c — FORMAT_JSON and FORMAT_JSON0.
 * FORMAT_DOT_JSON and FORMAT_XDOT_JSON are out of scope (AD-12).
 *
 * ## Draw-op / layout-attr sourcing (mirrors C's json_begin_graph)
 *
 * C's `json_begin_graph` (FORMAT_JSON) clones the GVC and runs a full
 * `gvRender(gvc, g, "xdot", NULL)` over the already-laid-out graph. That xdot
 * pass attaches every draw string (`_draw_`, `_ldraw_`, ...) plus the layout
 * attributes (`pos`, `width`, `height`, `bb`, `xdotversion`) to the graph
 * objects as cgraph string attributes; `json_end_graph` then serializes them,
 * re-parsing each xdot draw string into an array of typed op objects
 * (`write_xdot`). This port mirrors that literally: it re-renders the laid-out
 * graph to xdot text via a fresh context and parses the text back (the same
 * technique as `getDrawOps`/`layoutAndRenderXdot`), then looks each object's
 * draw + layout attributes up by identity. Structure (subgraph tree, node/edge
 * membership) and user/inherited attributes come from the ORIGINAL laid-out
 * graph — the same object C's `json_end_graph` walks — because the port's xdot
 * writer omits user attributes (color/label/shape) and filters "irrelevant"
 * subgraphs, so the xdot re-parse alone is not a faithful source of structure.
 *
 * Output is emitted as a semantically-equivalent JSON value tree
 * (`JSON.stringify`); byte-for-byte formatting is not required — the
 * conformance bar is the semantic `compare-json` comparator (±0.01, colors /
 * fonts canonicalized). `stoj`/`ind` are retained as the C-faithful string
 * helpers referenced by the unit tests.
 *
 * @see plugin/core/gvrender_core_json.c
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { Point } from '../model/geom.js';
import type { TextSpan } from '../common/emit-types.js';
import type { RendererPlugin } from '../gvc/context.js';
import type { RenderJob } from '../gvc/job.js';
import type { XdotOp, XdotColor } from '../xdot/types.js';
import type { TextlabelT, FieldT } from '../common/types.js';
import { printNum, gfmt5, XdotRenderer, type XdotDraws } from './dot.js';
import { CHAR_LATIN1 } from '../common/graph-init.js';
import { parse } from '../parser/index.js';
import { render as deviceRender } from '../gvc/device.js';
import { createDefaultContext } from '../gvc/default-context.js';
import { parseXDot } from '../xdot/index.js';
import { isHtmlValue, htmlValueContent } from '../common/html-string.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Draw-op attribute names re-serialized as typed op arrays. @see isXDot */
const XDOT_ATTR_NAMES: ReadonlySet<string> = new Set([
  '_draw_', '_ldraw_', '_hdraw_', '_tdraw_', '_hldraw_', '_tldraw_',
]);

/** Built-in node label default installed by graphviz (`\N`). Emitted for every
 *  node with no explicit/inherited label. @see lib/common/input.c NODENAME */
const DEFAULT_NODE_LABEL = '\\N';

/** Loosely-typed JSON value tree, serialized with JSON.stringify. */
type JVal = string | number | boolean | JVal[] | JObj;
interface JObj { [k: string]: JVal; }

// ---------------------------------------------------------------------------
// stoj — @see plugin/core/gvrender_core_json.c:stoj
// ---------------------------------------------------------------------------

/** Convert a dot string to a JSON-embedded string (with surrounding quotes). */
export function stoj(s: string): string {
  let r = '"';
  for (const c of s) {
    switch (c) {
      case '"': r += '\\"'; break;
      case '\\': r += '\\\\'; break;
      case '/': r += '\\/'; break;
      case '\b': r += '\\b'; break;
      case '\f': r += '\\f'; break;
      case '\n': r += '\\n'; break;
      case '\r': r += '\\r'; break;
      case '\t': r += '\\t'; break;
      default: r += c;
    }
  }
  return r + '"';
}

// ---------------------------------------------------------------------------
// indent — @see plugin/core/gvrender_core_json.c:indent
// ---------------------------------------------------------------------------

export function ind(level: number): string {
  return '  '.repeat(level);
}

// ---------------------------------------------------------------------------
// isXDot — @see plugin/core/gvrender_core_json.c:isXDot
// ---------------------------------------------------------------------------

function isXDot(name: string): boolean {
  return XDOT_ATTR_NAMES.has(name);
}

// ---------------------------------------------------------------------------
// Draw-op serialization — @see plugin/core/gvrender_core_json.c:write_xdot
// ---------------------------------------------------------------------------

/** Flatten an xdot polyline to `[[x,y],...]`. @see write_polyline */
function opPoints(pts: ReadonlyArray<{ x: number; y: number }>): JVal[] {
  return pts.map((p) => [p.x, p.y] as JVal);
}

/** Gradient stops as `[{frac,color},...]`. @see write_stops */
function gradStops(stops: ReadonlyArray<{ frac: number; color: string }>): JVal[] {
  return stops.map((s) => ({ frac: s.frac, color: s.color } as JObj));
}

/** Serialize a gradient color op. @see write_xdot xd_grad_* / write_*_grad */
function gradColorOp(op: 'C' | 'c', c: XdotColor): JObj {
  if (c.type === 'none') {
    return { op, grad: 'none', color: c.clr };
  }
  if (c.type === 'linear') {
    const g = c.ling;
    return { op, grad: 'linear', p0: [g.x0, g.y0], p1: [g.x1, g.y1], stops: gradStops(g.stops) };
  }
  const g = c.ring;
  return {
    op, grad: 'radial',
    p0: [g.x0, g.y0, g.r0], p1: [g.x1, g.y1, g.r1], stops: gradStops(g.stops),
  };
}

/** Serialize one parsed xdot op to its JSON op-object shape. @see write_xdot */
function opToJson(op: XdotOp, isLatin: boolean): JObj {
  switch (op.kind) {
    case 'filled_ellipse':
    case 'unfilled_ellipse': {
      const e = op.ellipse;
      return { op: op.kind === 'filled_ellipse' ? 'E' : 'e', rect: [e.x, e.y, e.w, e.h] };
    }
    case 'filled_polygon':
    case 'unfilled_polygon':
      return { op: op.kind === 'filled_polygon' ? 'P' : 'p', points: opPoints(op.polygon.pts) };
    case 'filled_bezier':
    case 'unfilled_bezier':
      return { op: op.kind === 'filled_bezier' ? 'B' : 'b', points: opPoints(op.bezier.pts) };
    case 'polyline':
      return { op: 'L', points: opPoints(op.polyline.pts) };
    case 'text': {
      const t = op.text;
      const align = t.align === 'left' ? 'l' : t.align === 'center' ? 'c' : 'r';
      // charset=latin1: draw text is stored already-UTF-8, so C's stoj pass
      // double-encodes it (unlike raw-stored attribute values). @see latin1Reencode
      return { op: 'T', pt: [t.x, t.y], align, width: t.width,
        text: isLatin ? latin1Reencode(t.text) : t.text };
    }
    case 'fill_color':
    case 'pen_color':
      return { op: op.kind === 'fill_color' ? 'C' : 'c', grad: 'none', color: op.color };
    case 'grad_fill_color':
    case 'grad_pen_color':
      return gradColorOp(op.kind === 'grad_fill_color' ? 'C' : 'c', op.gradColor);
    case 'font':
      return { op: 'F', size: op.font.size, face: op.font.name };
    case 'style':
      return { op: 'S', style: op.style };
    case 'fontchar':
      return { op: 't', fontchar: op.fontchar };
    case 'image':
      // C's write_xdot emits an empty op object for xd_image (no fields).
      return {};
  }
}

/** Parse an xdot draw string into its JSON op-object array. @see write_xdots */
function drawStringToOps(val: string, isLatin: boolean): JVal[] {
  if (val === '') return [];
  const parsed = parseXDot(val);
  if (parsed === null) return [];
  return parsed.ops.map((op) => opToJson(op, isLatin));
}

// ---------------------------------------------------------------------------
// Draw / layout attribute lookup — mirrors json_begin_graph's xdot render
// ---------------------------------------------------------------------------

/** Per-object xdot/layout attribute strings, keyed by identity. */
interface DrawLookup {
  /** Root-graph xdot attrs (`_draw_`, `bb`, `xdotversion`, ...). */
  graph: Map<string, string>;
  /** Node xdot/layout attrs by node name. */
  node: Map<string, Map<string, string>>;
  /** Cluster xdot/layout attrs, keyed by the original-graph cluster object
   *  (name is ambiguous — see collectDrawLookup). */
  cluster: Map<Graph, Map<string, string>>;
  /** Edge xdot/layout attrs by the original graph's Edge object. */
  edge: Map<Edge, Map<string, string>>;
}

/** Root edges in agfstnode/agfstout order, each tagged with its canonical
 *  `tail head occurrence` key (stable across the port/xdot re-parse). */
function canonicalRootEdges(g: Graph): Array<{ e: Edge; key: string }> {
  const out: Array<{ e: Edge; key: string }> = [];
  const counter = new Map<string, number>();
  for (const [, n] of g.nodes) {
    for (const e of n.outEdges(g)) {
      const base = e.tail.name + ' ' + e.head.name;
      const occ = counter.get(base) ?? 0;
      counter.set(base, occ + 1);
      out.push({ e, key: base + ' ' + occ });
    }
  }
  return out;
}

/** XdotDraws field → xdot draw-attribute name. */
const DRAW_FIELDS: ReadonlyArray<readonly [keyof XdotDraws, string]> = [
  ['draw', '_draw_'], ['ldraw', '_ldraw_'], ['hdraw', '_hdraw_'],
  ['tdraw', '_tdraw_'], ['hldraw', '_hldraw_'], ['tldraw', '_tldraw_'],
];

/** Overlay an object's pre-serialization draw strings onto its attr map,
 *  replacing the DOT-round-trip values (which drop a `\` before a `"`). */
function applyDraws(attrs: Map<string, string> | undefined, d: XdotDraws | undefined): void {
  if (attrs === undefined || d === undefined) return;
  for (const [field, attr] of DRAW_FIELDS) {
    const v = d[field];
    if (v !== undefined) attrs.set(attr, v);
  }
}

/** Re-render the laid-out graph to xdot and index every object's draw/layout
 *  attributes by identity. Returns `undefined` if the re-render fails (e.g. a
 *  hand-built graph with no real layout state) so callers fall back cleanly. */
function collectDrawLookup(g: Graph): DrawLookup | undefined {
  let xg: Graph;
  // Inject our own XdotRenderer (last-registered wins bestRenderer) so we can
  // read its per-object draw strings AFTER the render: the DOT-text re-parse
  // below is faithful for coordinates but LOSSY for draw text containing `"`
  // (a DOT quoted string cannot hold `\` before `"`; a cluster label's `\"`
  // round-trips to `"`, id 2239). The draws map holds the pre-serialization
  // strings C's -Tjson reads directly, so we overlay them onto the re-parse.
  const xr = new XdotRenderer();
  try {
    const ctx = createDefaultContext();
    ctx.register(xr);
    const xdotText = deviceRender(ctx, g, 'xdot');
    xg = parse(xdotText);
  } catch {
    return undefined;
  }
  const draws = xr.drawStringsByObject();
  const node = new Map<string, Map<string, string>>();
  for (const [nm, xn] of xg.nodes) node.set(nm, new Map(xn.attrs));
  // Correlate each original-graph cluster with its xdot-re-render attrs by a
  // PARALLEL walk keyed on the cluster OBJECT, not its name. A bare-name Map
  // collides when two clusters share a name at different tree depths (empty
  // `cluster_1` in `cluster_0` + a real top-level `cluster_1` — graphs-b7).
  // xg holds only the drawable clusters (the xdot writer drops anonymous/rank
  // subgraphs), so when a g-child has no same-named xg-child at this level it
  // is a filtered non-cluster (or a cluster nested under one): descend g but
  // hold the xg position, matching xg's flattened cluster tree (1436).
  const cluster = new Map<Graph, Map<string, string>>();
  const correlate = (gSub: Graph, xgSub: Graph): void => {
    for (const [nm, gChild] of gSub.subgraphs) {
      const xgChild = xgSub.subgraphs.get(nm);
      if (xgChild !== undefined) {
        cluster.set(gChild, new Map(xgChild.attrs));
        correlate(gChild, xgChild);
      } else {
        correlate(gChild, xgSub);
      }
    }
  };
  correlate(g, xg);
  // Edge draw attrs: match g-edges to xg-edges by the shared canonical key.
  const xByKey = new Map<string, Map<string, string>>();
  for (const { e, key } of canonicalRootEdges(xg)) xByKey.set(key, new Map(e.attrs));
  const edge = new Map<Edge, Map<string, string>>();
  for (const { e, key } of canonicalRootEdges(g)) {
    const a = xByKey.get(key);
    if (a !== undefined) edge.set(e, a);
  }
  const graphAttrs = new Map(xg.attrs);
  // Overlay the lossless per-object draw strings, keyed by the ORIGINAL object,
  // over the (coordinate-faithful but draw-text-lossy) re-parsed attrs.
  applyDraws(graphAttrs, draws.get(g));
  for (const [nm, gn] of g.nodes) applyDraws(node.get(nm), draws.get(gn));
  for (const [gc, attrs] of cluster) applyDraws(attrs, draws.get(gc));
  for (const [ge, attrs] of edge) applyDraws(attrs, draws.get(ge));
  return { graph: graphAttrs, node, cluster, edge };
}

// ---------------------------------------------------------------------------
// Object-id assignment — @see write_graph / label_subgs
// ---------------------------------------------------------------------------

interface BuildCtx {
  doXDot: boolean;
  draws?: DrawLookup;
  sgcnt: number;
  subgGid: Map<Graph, number>;
  nodeGid: Map<Node, number>;
  edgeGid: Map<Edge, number>;
  /** All subgraphs in DFS preorder (the flat top-level "objects" ordering). */
  dfsSubs: Graph[];
  /** True once any edge (or edge default) declares `label`: cgraph then carries
   *  a global `label` edge symbol, and write_attrs emits `label` (its value or
   *  the empty default) on EVERY edge — the empty-value skip exempts `label`.
   *  @see write_attrs (`*attrval=='\0' && !streq(sym->name,"label")`) */
  edgeLabelDeclared: boolean;
  /** Same as `edgeLabelDeclared`, for the graph-type `label` symbol: once any
   *  graph or cluster carries a label, the root and every subgraph emit `label`
   *  (their own value or the empty default). @see write_attrs label exemption */
  graphLabelDeclared: boolean;
  /** charset=latin1: draw-op text was stored already-UTF-8, so C's `stoj`
   *  double-encodes it. @see latin1Reencode */
  isLatin: boolean;
}

/** Whether a graph-type `label` symbol is declared anywhere (root, any cluster,
 *  or subgraph carries a label). @see BuildCtx.graphLabelDeclared */
function isGraphLabelDeclared(g: Graph): boolean {
  if (g.attrs.has('label')) return true;
  const lbl = graphLabel(g.info);
  if (lbl !== undefined && lbl.text !== '') return true;
  for (const [, sg] of g.subgraphs) if (isGraphLabelDeclared(sg)) return true;
  return false;
}

/** Effective graph attributes: a subgraph inherits its enclosing graphs'
 *  graph-attribute values (agxget inheritance), captured at build time in
 *  `graphDefaultsSnapshot`; the root uses only its own. */
function graphEffectiveAttrs(g: Graph, top: boolean): Map<string, string> {
  if (top) return g.attrs;
  const m = new Map<string, string>(g.graphDefaultsSnapshot ?? []);
  for (const [k, v] of g.attrs) m.set(k, v);
  return m;
}

/** Whether a `label` edge attribute symbol is declared anywhere in the graph
 *  (an explicit edge label or an `edge [label=...]` default). */
function isEdgeLabelDeclared(g: Graph): boolean {
  for (const e of g.edges) if (e.attrs.has('label')) return true;
  const walk = (sg: Graph): boolean => {
    if (sg.edgeDefaults.has('label')) return true;
    for (const [, sub] of sg.subgraphs) if (walk(sub)) return true;
    return false;
  };
  return walk(g);
}

/** DFS preorder over the subgraph tree. @see label_subgs recursion order */
function dfsSubgraphs(g: Graph, out: Graph[]): void {
  for (const [, sg] of g.subgraphs) {
    out.push(sg);
    dfsSubgraphs(sg, out);
  }
}

/** Assign every object its `_gvid`, mirroring write_graph's top-level pass:
 *  subgraphs DFS-preorder 0..sgcnt-1, then nodes sgcnt.., then edges 0.. in
 *  agfstnode/agfstout order. @see plugin/core/gvrender_core_json.c:write_graph */
function assignIds(g: Graph, doXDot: boolean, draws?: DrawLookup): BuildCtx {
  const dfsSubs: Graph[] = [];
  dfsSubgraphs(g, dfsSubs);
  const subgGid = new Map<Graph, number>();
  dfsSubs.forEach((sg, i) => subgGid.set(sg, i));
  const sgcnt = dfsSubs.length;
  const nodeGid = new Map<Node, number>();
  let ncnt = 0;
  for (const [, n] of g.nodes) nodeGid.set(n, sgcnt + ncnt++);
  const edgeGid = new Map<Edge, number>();
  let ecnt = 0;
  for (const { e } of canonicalRootEdges(g)) edgeGid.set(e, ecnt++);
  return {
    doXDot, draws, sgcnt, subgGid, nodeGid, edgeGid, dfsSubs,
    edgeLabelDeclared: isEdgeLabelDeclared(g),
    graphLabelDeclared: isGraphLabelDeclared(g),
    isLatin: g.info.charset === CHAR_LATIN1,
  };
}

// ---------------------------------------------------------------------------
// Attribute emission — @see write_attrs
// ---------------------------------------------------------------------------

/**
 * Emit an object's attributes into `o`, mirroring C's write_attrs: `agxget`
 * returns HTML-string content with the marker stripped, empty non-`label`
 * values are skipped, and xdot draw attrs are re-serialized as op arrays.
 * `base` carries user/inherited attrs; `overlay` (from the xdot re-render)
 * supplies the post-layout `pos`/`width`/`height`/`bb`/draw strings and wins
 * on conflict.
 */
function emitAttrs(
  o: JObj,
  base: Map<string, string>,
  overlay: Map<string, string> | undefined,
  ctx: BuildCtx,
): void {
  const merged = new Map(base);
  if (overlay !== undefined) for (const [k, v] of overlay) merged.set(k, v);
  for (const [k, rawV] of merged) {
    // agxget mirror: HTML strings surface as their marker-stripped content.
    const v = isHtmlValue(rawV) ? htmlValueContent(rawV) : rawV;
    if (v === '' && k !== 'label') continue;
    if (ctx.doXDot && isXDot(k)) {
      o[k] = drawStringToOps(v, ctx.isLatin);
    } else if (!isXDot(k)) {
      o[k] = v;
    }
    // json0 (!doXDot): xdot draw attrs are not emitted at all.
  }
}

// ---------------------------------------------------------------------------
// Label geometry — @see attach_attrs_and_arrows / rec_attach_bb (output.c)
// ---------------------------------------------------------------------------
//
// The port's xdot writer omits the label-geometry attributes that native
// attach_attrs sets (`lp` for labeled edges; `lp`/`lwidth`/`lheight` for
// labeled graphs and clusters), so they are sourced here directly from the
// laid-out model. yDir is identity for the common (non-rankdir=BT/RL) case —
// coordinates are stored post-layout in the output frame, matching node `pos`.

/** The TextlabelT on a graph/cluster info, or undefined. */
function graphLabel(info: { label?: unknown }): TextlabelT | undefined {
  const l = info.label;
  if (l !== undefined && l !== null && typeof l === 'object' && 'pos' in l) {
    return l as TextlabelT;
  }
  return undefined;
}

/** Format a label position as `x,y`. @see attach_attrs (yDir identity). */
function labelPos(l: TextlabelT): string {
  return gfmt5(l.pos.x) + ',' + gfmt5(l.pos.y);
}

/** Attach edge label positions the port's xdot writer omits: `lp` (center
 *  label), `head_lp`/`tail_lp` (end labels), and `xlp` (exterior label, only
 *  when its position is set). @see attach_attrs ED_label/head_label/tail_label/xlabel */
function attachEdgeLabelPositions(o: JObj, e: Edge): void {
  // C attaches pos/lp/head_lp/tail_lp/xlp only inside `if (ED_spl(e))`: a
  // concentrated/merged edge with no spline of its own carries none of them, so
  // its label position must be omitted (2368_1, 2470). @see attach_attrs
  if (!e.info.spl) return;
  if (e.info.label !== undefined) o.lp = labelPos(e.info.label);
  if (e.info.head_label !== undefined) o.head_lp = labelPos(e.info.head_label);
  if (e.info.tail_label !== undefined) o.tail_lp = labelPos(e.info.tail_label);
  const xl = e.info.xlabel as TextlabelT | undefined;
  if (xl !== undefined && xl.set) o.xlp = labelPos(xl);
}

/** Attach a node's exterior-label position `xlp` when set.
 *  @see attach_attrs (ND_xlabel && ->set -> "xlp") */
function attachNodeXlp(o: JObj, n: Node): void {
  const xl = n.info.xlabel as TextlabelT | undefined;
  if (xl !== undefined && xl.set) o.xlp = labelPos(xl);
}

/** Attach `lp`/`lwidth`/`lheight` for a labeled graph/cluster.
 *  @see rec_attach_bb (GD_label -> "lp"/"lwidth"/"lheight") */
function attachGraphLabelGeom(o: JObj, g: Graph): void {
  const lbl = graphLabel(g.info);
  if (lbl !== undefined && lbl.text !== '') {
    o.lp = gfmt5(lbl.pos.x) + ',' + gfmt5(lbl.pos.y);
    o.lwidth = (lbl.dimen.x / 72).toFixed(2);
    o.lheight = (lbl.dimen.y / 72).toFixed(2);
  }
}

/** Recursively collect a record node's leaf-field rectangles (node-relative
 *  box + node coord), each `LLx,LLy,URx,URy` rounded. @see set_record_rects */
function setRecordRects(f: FieldT, coord: Point, out: string[]): void {
  if (f.n_flds === 0) {
    out.push(
      gfmt5(f.b.ll.x + coord.x) + ',' + gfmt5(f.b.ll.y + coord.y) + ',' +
      gfmt5(f.b.ur.x + coord.x) + ',' + gfmt5(f.b.ur.y + coord.y),
    );
  } else if (f.fld !== null) {
    for (const sub of f.fld) setRecordRects(sub, coord, out);
  }
}

/** Attach `rects` for a record-shape node. @see attach_attrs (ND_shape==record) */
function attachNodeRects(o: JObj, n: Node): void {
  const shape = n.info.shape as { name?: string } | undefined;
  if (shape?.name !== 'record') return;
  const f = n.info.shape_info as FieldT | undefined;
  if (f === undefined) return;
  const parts: string[] = [];
  setRecordRects(f, n.info.coord, parts);
  if (parts.length > 0) o.rects = parts.join(' ');
}

// ---------------------------------------------------------------------------
// Node / edge object builders — @see write_node / write_edge
// ---------------------------------------------------------------------------

/** Effective node attributes: inherited defaults, explicit overrides, and the
 *  built-in `\N` label default. Mirrors agnxtattr/agxget resolution. */
function nodeEffectiveAttrs(n: Node): Map<string, string> {
  const m = new Map<string, string>(n.nodeDefaultsSnapshot ?? []);
  for (const [k, v] of n.attrs) m.set(k, v);
  if (!m.has('label')) m.set('label', DEFAULT_NODE_LABEL);
  return m;
}

/** @see plugin/core/gvrender_core_json.c:write_node (top) */
function buildNodeObject(n: Node, ctx: BuildCtx): JObj {
  const o: JObj = { _gvid: ctx.nodeGid.get(n)!, name: n.name };
  const eff = nodeEffectiveAttrs(n);
  const xd = ctx.draws?.node.get(n.name);
  if (xd === undefined) {
    // Fallback (json0 / hand-built graph): synthesize the layout attrs the
    // xdot render would otherwise supply, from the laid-out node.
    eff.set('pos', printNum(n.info.coord.x) + ',' + printNum(n.info.coord.y));
    eff.set('width', printNum(n.info.width));
    eff.set('height', printNum(n.info.height));
  }
  emitAttrs(o, eff, xd, ctx);
  attachNodeRects(o, n);
  attachNodeXlp(o, n);
  // Only synthesize an empty `_draw_` when the whole xdot re-render failed
  // (hand-built graph / no layout state). When the re-render succeeded, an
  // object with no draw string genuinely has no `_draw_` — the oracle omits
  // the key too, so forcing it here would be a spurious divergence.
  if (ctx.doXDot && ctx.draws === undefined && !('_draw_' in o)) o._draw_ = [];
  return o;
}

/** @see plugin/core/gvrender_core_json.c:write_edge (top) */
function buildEdgeObject(e: Edge, ctx: BuildCtx): JObj {
  const o: JObj = {
    _gvid: ctx.edgeGid.get(e)!,
    tail: ctx.nodeGid.get(e.tail)!,
    head: ctx.nodeGid.get(e.head)!,
  };
  emitAttrs(o, e.attrs, ctx.draws?.edge.get(e), ctx);
  // A declared `label` edge symbol makes write_attrs emit `label` on every
  // edge — the empty value included. @see BuildCtx.edgeLabelDeclared
  if (ctx.edgeLabelDeclared && !('label' in o)) o.label = '';
  attachEdgeLabelPositions(o, e);
  if (ctx.doXDot && ctx.draws === undefined && !('_draw_' in o)) o._draw_ = [];
  return o;
}

// ---------------------------------------------------------------------------
// Graph / subgraph object builder — @see write_graph / write_subgs
// ---------------------------------------------------------------------------

/** Member edges of a (sub)graph in AGSEQ order, as `_gvid` ints.
 *  @see write_edges (agfstnode/agfstout collection + agseqasc qsort) */
function memberEdgeGids(g: Graph, ctx: BuildCtx): number[] {
  const edges: Edge[] = [];
  for (const [, n] of g.nodes) {
    for (const e of n.outEdges(g)) {
      if (ctx.edgeGid.has(e)) edges.push(e);
    }
  }
  edges.sort((a, b) => a.seq - b.seq);
  return edges.map((e) => ctx.edgeGid.get(e)!);
}

/** Full edge objects for the top graph, AGSEQ-ordered. @see write_edges (top) */
function buildEdgesArray(g: Graph, ctx: BuildCtx): JObj[] {
  const edges = canonicalRootEdges(g).map(({ e }) => e);
  edges.sort((a, b) => a.seq - b.seq);
  return edges.map((e) => buildEdgeObject(e, ctx));
}

/** @see plugin/core/gvrender_core_json.c:write_graph */
function buildGraphObject(g: Graph, top: boolean, ctx: BuildCtx): JObj {
  const o: JObj = {};
  // write_hdr
  o.name = g.name;
  if (top) {
    o.directed = g.kind === 'directed' || g.kind === 'strict-directed';
    o.strict = g.kind === 'strict-directed' || g.kind === 'strict-undirected';
  }
  // write_attrs (subgraphs inherit enclosing graph attrs via agxget)
  const overlay = top ? ctx.draws?.graph : ctx.draws?.cluster.get(g);
  emitAttrs(o, graphEffectiveAttrs(g, top), overlay, ctx);
  attachGraphLabelGeom(o, g);
  // A declared graph `label` symbol makes write_attrs emit `label` on every
  // graph object — the empty value included. @see BuildCtx.graphLabelDeclared
  if (ctx.graphLabelDeclared && !('label' in o)) o.label = '';
  // _subgraph_cnt (top) / _gvid (subgraph)
  if (top) {
    o._subgraph_cnt = ctx.sgcnt;
  } else {
    o._gvid = ctx.subgGid.get(g)!;
  }

  if (top) {
    // "objects": all subgraphs (DFS preorder) then all node objects. Emitted
    // only when the graph has any subgraph or node. @see write_subgs/write_nodes
    if (ctx.dfsSubs.length > 0 || g.nodes.size > 0) {
      const objects: JObj[] = [];
      for (const sg of ctx.dfsSubs) objects.push(buildGraphObject(sg, false, ctx));
      for (const [, n] of g.nodes) objects.push(buildNodeObject(n, ctx));
      o.objects = objects;
    }
  } else {
    // Member reference lists (int _gvid arrays), each only when non-empty.
    const childGids: number[] = [];
    for (const [, sg] of g.subgraphs) childGids.push(ctx.subgGid.get(sg)!);
    if (childGids.length > 0) o.subgraphs = childGids;
    const nodeGids: number[] = [];
    for (const [, n] of g.nodes) {
      const gid = ctx.nodeGid.get(n);
      if (gid !== undefined) nodeGids.push(gid);
    }
    if (nodeGids.length > 0) o.nodes = nodeGids;
    const eGids = memberEdgeGids(g, ctx);
    if (eGids.length > 0) o.edges = eGids;
  }

  // write_edges (top only — the flat full-edge array)
  if (top) {
    const edges = buildEdgesArray(g, ctx);
    if (edges.length > 0) o.edges = edges;
  }
  return o;
}

// ---------------------------------------------------------------------------
// buildJson — @see plugin/core/gvrender_core_json.c:write_graph (top entry)
// ---------------------------------------------------------------------------

/**
 * Reinterpret a string's UTF-8 bytes as Latin-1 code points. Mirrors C's
 * `stoj` applying `latin1ToUTF8` a SECOND time to text that input processing
 * already converted latin1→UTF-8, when `charset=latin1`. The double pass is a
 * graphviz quirk (the SVG backend does not do it), so `-Tjson` on a latin1
 * graph emits mojibake — `á` becomes `Ã¡`. No-op on pure ASCII.
 * @see plugin/core/gvrender_core_json.c:82,121 stoj (sp->isLatin branch)
 */
function latin1Reencode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

export function buildJson(g: Graph, doXDot: boolean): string {
  const draws = doXDot ? collectDrawLookup(g) : undefined;
  const ctx = assignIds(g, doXDot, draws);
  const root = buildGraphObject(g, true, ctx);
  return JSON.stringify(root, null, 2) + '\n';
}

// ---------------------------------------------------------------------------
// Json0Renderer
// ---------------------------------------------------------------------------

/**
 * JSON0 renderer — position data only, no xdot draw operations.
 *
 * @see plugin/core/gvrender_core_json.c FORMAT_JSON0
 */
export class Json0Renderer implements RendererPlugin {
  readonly type = 'json0';
  /** @see plugin/core/gvplugin_core.c registration table */
  readonly quality = 0;

  beginGraph(_g: Graph, _job: RenderJob): void { /* no-op */ }

  endGraph(g: Graph, job: RenderJob): void {
    job.write(buildJson(g, false));
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
}

// ---------------------------------------------------------------------------
// JsonRenderer
// ---------------------------------------------------------------------------

/**
 * JSON renderer — position data plus _draw_ arrays.
 *
 * @see plugin/core/gvrender_core_json.c FORMAT_JSON
 */
export class JsonRenderer implements RendererPlugin {
  readonly type = 'json';
  /** @see plugin/core/gvplugin_core.c registration table */
  readonly quality = 0;

  beginGraph(_g: Graph, _job: RenderJob): void { /* no-op */ }

  endGraph(g: Graph, job: RenderJob): void {
    job.write(buildJson(g, true));
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
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/** @see plugin/core/gvrender_core_json.c FORMAT_JSON0 */
export function createJson0Renderer(): RendererPlugin {
  return new Json0Renderer();
}

/** @see plugin/core/gvrender_core_json.c FORMAT_JSON */
export function createJsonRenderer(): RendererPlugin {
  return new JsonRenderer();
}
