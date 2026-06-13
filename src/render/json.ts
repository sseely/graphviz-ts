// SPDX-License-Identifier: EPL-2.0

/**
 * JSON and JSON0 renderer plugins.
 *
 * Ports plugin/core/gvrender_core_json.c — FORMAT_JSON and FORMAT_JSON0.
 * FORMAT_DOT_JSON and FORMAT_XDOT_JSON are out of scope (AD-12).
 *
 * All output is emitted in endGraph; all other callbacks are no-ops.
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
import { printNum } from './dot.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const XDOT_ATTR_NAMES: ReadonlySet<string> = new Set([
  '_draw_', '_ldraw_', '_hdraw_', '_tdraw_', '_hldraw_', '_tldraw_',
]);

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
// EdgeJsonCtx — groups per-edge gvid and node-id references
// ---------------------------------------------------------------------------

export interface EdgeJsonCtx {
  gvid: number;
  tailId: number;
  headId: number;
}

// ---------------------------------------------------------------------------
// writeNodeAttrs — writes extra node attrs and optional _draw_ placeholder
// ---------------------------------------------------------------------------

export function writeNodeAttrs(
  n: Node,
  il: string,
  doXDot: boolean,
  out: string[],
): void {
  for (const [k, v] of n.attrs) {
    if (k !== 'pos' && k !== 'width' && k !== 'height' && !XDOT_ATTR_NAMES.has(k)) {
      out[out.length - 1] += ',';
      out.push(il + stoj(k) + ': ' + stoj(v));
    }
  }
  if (doXDot) {
    out[out.length - 1] += ',';
    out.push(il + '"_draw_": []');
  }
}

// ---------------------------------------------------------------------------
// writeNodeBlock — @see plugin/core/gvrender_core_json.c:write_node
// ---------------------------------------------------------------------------

export function writeNodeBlock(
  n: Node,
  gvid: number,
  level: number,
  doXDot: boolean,
  out: string[],
): void {
  const pos = printNum(n.info.coord.x) + ',' + printNum(n.info.coord.y);
  out.push(ind(level) + '{');
  const il = ind(level + 1);
  out.push(il + '"_gvid": ' + String(gvid) + ',');
  out.push(il + '"name": ' + stoj(n.name) + ',');
  out.push(il + '"pos": ' + stoj(pos) + ',');
  out.push(il + '"width": ' + stoj(printNum(n.info.width)) + ',');
  out.push(il + '"height": ' + stoj(printNum(n.info.height)));
  writeNodeAttrs(n, il, doXDot, out);
  out.push(ind(level) + '}');
}

// ---------------------------------------------------------------------------
// writeEdgeAttrs — writes extra edge attrs and optional _draw_ placeholder
// ---------------------------------------------------------------------------

export function writeEdgeAttrs(
  e: Edge,
  il: string,
  doXDot: boolean,
  out: string[],
): void {
  for (const [k, v] of e.attrs) {
    if (!XDOT_ATTR_NAMES.has(k)) {
      out[out.length - 1] += ',';
      out.push(il + stoj(k) + ': ' + stoj(v));
    }
  }
  if (doXDot) {
    out[out.length - 1] += ',';
    out.push(il + '"_draw_": []');
  }
}

// ---------------------------------------------------------------------------
// writeEdgeBlock — @see plugin/core/gvrender_core_json.c:write_edge
// ---------------------------------------------------------------------------

export function writeEdgeBlock(
  e: Edge,
  ctx: EdgeJsonCtx,
  level: number,
  doXDot: boolean,
  out: string[],
): void {
  out.push(ind(level) + '{');
  const il = ind(level + 1);
  out.push(il + '"_gvid": ' + String(ctx.gvid) + ',');
  out.push(il + '"tail": ' + String(ctx.tailId) + ',');
  out.push(il + '"head": ' + String(ctx.headId));
  writeEdgeAttrs(e, il, doXDot, out);
  out.push(ind(level) + '}');
}

// ---------------------------------------------------------------------------
// assignNodeIds — assign sequential _gvid values to nodes
// ---------------------------------------------------------------------------

export function assignNodeIds(g: Graph): Map<Node, number> {
  const nodeIds = new Map<Node, number>();
  let ncnt = 0;
  for (const [, n] of g.nodes) {
    nodeIds.set(n, ncnt++);
  }
  return nodeIds;
}

// ---------------------------------------------------------------------------
// collectEdgeCtxs — collect edges in tail-node order, assign gvids
// ---------------------------------------------------------------------------

export function collectEdgeCtxs(
  g: Graph,
  nodeIds: Map<Node, number>,
): Array<{ e: Edge; ctx: EdgeJsonCtx }> {
  const result: Array<{ e: Edge; ctx: EdgeJsonCtx }> = [];
  const seen = new Set<Edge>();
  let ecnt = 0;
  for (const [, n] of g.nodes) {
    for (const e of n.outEdges(g)) {
      if (!seen.has(e)) {
        seen.add(e);
        const ctx: EdgeJsonCtx = {
          gvid: ecnt++,
          tailId: nodeIds.get(e.tail)!,
          headId: nodeIds.get(e.head)!,
        };
        result.push({ e, ctx });
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// writeObjects — emit "objects" array section
// ---------------------------------------------------------------------------

export function writeObjects(
  g: Graph,
  nodeIds: Map<Node, number>,
  doXDot: boolean,
  out: string[],
): void {
  out.push(ind(1) + '"objects": [');
  let first = true;
  for (const [, n] of g.nodes) {
    if (!first) out[out.length - 1] += ',';
    first = false;
    writeNodeBlock(n, nodeIds.get(n)!, 2, doXDot, out);
  }
  out.push(ind(1) + '],');
}

// ---------------------------------------------------------------------------
// writeEdgesList — emit "edges" array section
// ---------------------------------------------------------------------------

export function writeEdgesList(
  pairs: Array<{ e: Edge; ctx: EdgeJsonCtx }>,
  doXDot: boolean,
  out: string[],
): void {
  out.push(ind(1) + '"edges": [');
  for (let i = 0; i < pairs.length; i++) {
    if (i > 0) out[out.length - 1] += ',';
    const { e, ctx } = pairs[i]!;
    writeEdgeBlock(e, ctx, 2, doXDot, out);
  }
  out.push(ind(1) + ']');
}

// ---------------------------------------------------------------------------
// buildJson — @see plugin/core/gvrender_core_json.c:write_graph
// ---------------------------------------------------------------------------

export function buildJson(g: Graph, doXDot: boolean): string {
  const directed = g.kind === 'directed' || g.kind === 'strict-directed';
  const strict = g.kind === 'strict-directed' || g.kind === 'strict-undirected';
  const nodeIds = assignNodeIds(g);
  const pairs = collectEdgeCtxs(g, nodeIds);

  const out: string[] = ['{'];
  out.push(ind(1) + '"name": ' + stoj(g.name) + ',');
  out.push(ind(1) + '"directed": ' + (directed ? 'true' : 'false') + ',');
  out.push(ind(1) + '"strict": ' + (strict ? 'true' : 'false') + ',');
  out.push(ind(1) + '"_subgraph_cnt": 0,');
  writeObjects(g, nodeIds, doXDot, out);
  writeEdgesList(pairs, doXDot, out);
  out.push('}');

  return out.join('\n') + '\n';
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
