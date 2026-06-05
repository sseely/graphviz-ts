// SPDX-License-Identifier: EPL-2.0

/**
 * Device render loop and coordinate transform.
 *
 * Ports gvrender_ptf, gvrender_begin_graph, and gvrender_end_graph from
 * lib/gvc/gvrender.c.  render() is the top-level entry point; it lives here
 * (not on GvcContext) to avoid a circular import.
 *
 * @see lib/gvc/gvrender.c
 * @see lib/gvc/gvdevice.c
 */

import type { Point } from '../model/geom.js';
import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { RendererPlugin, GvcContext } from './context.js';
import type { ShapeDesc } from '../common/types.js';
import { RenderJob, GVRENDER_DOES_TRANSFORM } from './job.js';
import { computeSubgraphBB } from '../layout/pack/index.js';
import { polyInit } from '../common/poly-init.js';

// ---------------------------------------------------------------------------
// transformPoint — @see lib/gvc/gvrender.c:gvrender_ptf
// ---------------------------------------------------------------------------

/**
 * Transform a point from graph to device coordinates.
 * Short-circuits when GVRENDER_DOES_TRANSFORM is set (renderer owns mapping).
 *
 * @see lib/gvc/gvrender.c:gvrender_ptf
 */
export function transformPoint(p: Point, job: RenderJob): Point {
  if ((job.flags & GVRENDER_DOES_TRANSFORM) !== 0) {
    return p;
  }
  const sx = job.zoom * job.devscale.x;
  const sy = job.zoom * job.devscale.y;
  const tx = job.translation.x;
  const ty = job.translation.y;
  if (job.rotation !== 0) {
    return applyRotation(p, tx, ty, sx, sy);
  }
  return applyScale(p, tx, ty, sx, sy);
}

/** Rotation branch: out.x = -(p.y+ty)*sx, out.y = (p.x+tx)*sy @see gvrender_ptf */
export function applyRotation(p: Point, tx: number, ty: number, sx: number, sy: number): Point {
  const x = -(p.y + ty) * sx;
  const y = (p.x + tx) * sy;
  return buildPoint(x, y);
}

/** No-rotation branch: out.x = (p.x+tx)*sx, out.y = (p.y+ty)*sy @see gvrender_ptf */
export function applyScale(p: Point, tx: number, ty: number, sx: number, sy: number): Point {
  const x = (p.x + tx) * sx;
  const y = (p.y + ty) * sy;
  return buildPoint(x, y);
}

/** Construct a Point value. Extracted to avoid inline object literals in return position. */
export function buildPoint(x: number, y: number): Point {
  const pt: Point = { x, y };
  return pt;
}

// ---------------------------------------------------------------------------
// Node/Edge walk helpers
// ---------------------------------------------------------------------------

/** Render a single node if not already rendered. @see lib/common/emit.c:emit_node */
export function renderNode(n: Node, renderer: RendererPlugin, job: RenderJob, done: Set<Node>): void {
  if (done.has(n)) return;
  done.add(n);
  renderer.beginNode(n, job);
  const shape = n.info.shape as ShapeDesc | undefined;
  if (shape?.fns?.codefn) shape.fns.codefn(job, n);
  renderer.endNode(n, job);
}

/** Render a single edge. @see lib/common/emit.c:emit_edge */
export function renderEdge(e: Edge, renderer: RendererPlugin, job: RenderJob): void {
  renderer.beginEdge(e, job);
  renderer.endEdge(e, job);
}

/**
 * Render nodes and edges in C's "breadth-first walk" order.
 * For each node: emit the node, then for each outgoing edge emit the
 * head node and the edge itself.  Matches the default (no-flag) path in
 * lib/common/emit.c:emit_graph.
 *
 * @see lib/common/emit.c:emit_graph (breadth-first default case)
 */
export function walkNodesAndEdges(g: Graph, renderer: RendererPlugin, job: RenderJob): void {
  const done = new Set<Node>();
  for (const n of g.nodes.values()) {
    renderNode(n, renderer, job, done);
    for (const e of n.outEdges(g)) {
      renderNode(e.head, renderer, job, done);
      renderEdge(e, renderer, job);
    }
  }
}

// ---------------------------------------------------------------------------
// renderGraph — @see lib/gvc/gvrender.c:gvrender_begin_graph / end_graph
// ---------------------------------------------------------------------------

/**
 * Primary render loop: beginGraph → nodes → edges → endGraph.
 *
 * @see lib/gvc/gvrender.c:gvrender_begin_graph
 * @see lib/gvc/gvrender.c:gvrender_end_graph
 */
export function renderGraph(g: Graph, job: RenderJob, renderer: RendererPlugin): string {
  renderer.beginGraph(g, job);
  walkNodesAndEdges(g, renderer, job);
  renderer.endGraph(g, job);
  return job.output.join('');
}

// ---------------------------------------------------------------------------
// render — top-level convenience
// ---------------------------------------------------------------------------

/**
 * Select renderer, create job, initialise bb from graph, then render.
 *
 * @throws Error if no renderer is registered for format
 * @see lib/gvc/gvrender.c:gvrender_select
 */
export function render(ctx: GvcContext, g: Graph, format: string): string {
  const renderer = ctx.bestRenderer(format);
  const job = new RenderJob(format, ctx.textMeasurer);
  const gbb = g.info.bb;
  const hasValidBb = gbb && (gbb.ur.x > gbb.ll.x || gbb.ur.y > gbb.ll.y);
  job.bb = hasValidBb ? gbb : computeSubgraphBB(g, 0);
  job.renderer = renderer;
  for (const n of g.nodes.values()) polyInit(n, g, job.measurer);
  return renderGraph(g, job, renderer);
}
