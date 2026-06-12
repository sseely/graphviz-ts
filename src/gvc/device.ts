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
import type { ShapeDesc, TextlabelT } from '../common/types.js';
import type { TextSpan } from '../common/emit-types.js';
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
  // emit xlabel inside the node group, after codefn @see lib/common/emit.c:emit_node (1829-1830)
  renderNodeXLabel(n, renderer, job);
  renderer.endNode(n, job);
}

/** Render a single edge. @see lib/common/emit.c:emit_edge */
export function renderEdge(e: Edge, renderer: RendererPlugin, job: RenderJob): void {
  renderer.beginEdge(e, job);
  renderer.endEdge(e, job);
}

/** valign codes stored on textlabel_t. @see lib/common/types.h:textlabel_t.valign */
const VALIGN_TOP = 't'.charCodeAt(0);
const VALIGN_BOTTOM = 'b'.charCodeAt(0);

/** First-span baseline y per valign. @see lib/common/labels.c:emit_label (240-251) */
function labelFirstSpanY(lp: TextlabelT): number {
  if (lp.valign === VALIGN_TOP) return lp.pos.y + lp.space.y / 2.0 - lp.fontsize;
  if (lp.valign === VALIGN_BOTTOM) {
    return lp.pos.y - lp.space.y / 2.0 + lp.dimen.y - lp.fontsize;
  }
  return lp.pos.y + lp.dimen.y / 2.0 - lp.fontsize;
}

/** Span x position per justification. @see lib/common/labels.c:emit_label (254-266) */
function labelSpanX(lp: TextlabelT, just: 'l' | 'n' | 'r'): number {
  if (just === 'l') return lp.pos.x - lp.space.x / 2.0;
  if (just === 'r') return lp.pos.x + lp.space.x / 2.0;
  return lp.pos.x;
}

/**
 * Emit one label's text spans if present and placed.
 * Shared by edge-label, node-xlabel, and graph-label slots.
 * URL/anchor/map machinery and E_decorate attachment (emit.c:emit_attachment)
 * are not ported, matching the live path's AD-2 scope.
 * @see lib/common/emit.c:emit_label
 * @see lib/common/labels.c:emit_label
 */
export function renderOneLabel(
  lp: TextlabelT | undefined,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  if (!lp?.set) return; // emit_label: lbl == NULL || !lbl->set
  if (lp.html) return; // HTML labels not ported (AD-2)
  if (lp.u.kind !== 'txt' || lp.u.nspans < 1) return;
  let y = labelFirstSpanY(lp);
  for (let i = 0; i < lp.u.nspans; i++) {
    const span = lp.u.span[i] as TextSpan | undefined;
    if (!span) break;
    renderer.textspan({ x: labelSpanX(lp, span.just), y }, span, job);
    y -= span.size.y; // UL position for next span
  }
}

/**
 * Emit all four edge label slots in C order: label, xlabel, head, tail.
 * Must run inside the edge group, after the path and arrow polygons.
 * @see lib/common/emit.c:emit_end_edge (3010-3025)
 */
export function renderEdgeLabels(e: Edge, renderer: RendererPlugin, job: RenderJob): void {
  renderOneLabel(e.info.label as TextlabelT | undefined, renderer, job);
  renderOneLabel(e.info.xlabel as TextlabelT | undefined, renderer, job);
  renderOneLabel(e.info.head_label, renderer, job);
  renderOneLabel(e.info.tail_label, renderer, job);
}

/**
 * Emit node external label (ND_xlabel) if placed.
 * Must run inside the node group, after codefn (shape draw), matching C order.
 * @see lib/common/emit.c:emit_node (1829-1830)
 */
export function renderNodeXLabel(n: Node, renderer: RendererPlugin, job: RenderJob): void {
  renderOneLabel(n.info.xlabel as TextlabelT | undefined, renderer, job);
}

/**
 * Emit root-graph label (GD_label) if present and placed.
 * Must run before clusters and nodes (emit_page order: background, then label,
 * then emit_view which contains clusters+nodes+edges).
 * @see lib/common/emit.c:emit_page (3656-3657)
 */
export function renderGraphLabel(g: Graph, renderer: RendererPlugin, job: RenderJob): void {
  renderOneLabel(g.info.label as TextlabelT | undefined, renderer, job);
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

/** @see lib/common/emit.c:emit_clusters (label text spans) */
function renderClusterLabel(sg: Graph, renderer: RendererPlugin, job: RenderJob): void {
  const lab = sg.info.label as TextlabelT | undefined;
  if (!lab?.set || lab.u.kind !== 'txt' || lab.u.nspans <= 0) return;
  const py = lab.pos.y + lab.dimen.y / 2.0 - lab.fontsize;
  for (let i = 0; i < lab.u.nspans; i++) {
    const span = lab.u.span[i] as TextSpan | undefined;
    if (!span) break;
    renderer.textspan({ x: lab.pos.x, y: py }, span, job);
  }
}

/** @see lib/common/emit.c:emit_clusters (single cluster: box, label, then recurse) */
function renderOneCluster(sg: Graph, renderer: RendererPlugin, job: RenderJob): void {
  renderer.beginCluster?.(sg, job);
  const bb = sg.info.bb!;
  const rawPts = [
    { x: bb.ll.x, y: bb.ll.y },
    { x: bb.ll.x, y: bb.ur.y },
    { x: bb.ur.x, y: bb.ur.y },
    { x: bb.ur.x, y: bb.ll.y },
  ];
  renderer.polygon(rawPts.map(p => transformPoint(p, job)), false, job);
  renderClusterLabel(sg, renderer, job);
  renderer.endCluster?.(sg, job);
  // C lays down clusters before sub-clusters when drawing.
  renderClusters(sg, renderer, job);
}

/**
 * Render cluster boundary polygons and labels, depth-first.
 * Corner order matches C's gvrender_box: LL, (LL.x,UR.y), UR, (UR.x,LL.y).
 * @see lib/gvc/gvrender.c:gvrender_box
 * @see lib/common/emit.c:emit_clusters
 */
export function renderClusters(g: Graph, renderer: RendererPlugin, job: RenderJob): void {
  const nClust = g.info.n_cluster ?? 0;
  const clust = g.info.clust;
  if (nClust === 0 || !clust) return;
  for (let c = 0; c < nClust; c++) {
    const sg = clust[c];
    if (sg) renderOneCluster(sg, renderer, job);
  }
}

/**
 * Primary render loop: beginGraph → graph-label → clusters → nodes → edges → endGraph.
 * Graph label emits before clusters/nodes to match C's emit_page order
 * (emit_background, GD_label, then emit_view).
 *
 * @see lib/gvc/gvrender.c:gvrender_begin_graph
 * @see lib/gvc/gvrender.c:gvrender_end_graph
 * @see lib/common/emit.c:emit_page (3655-3660)
 */
export function renderGraph(g: Graph, job: RenderJob, renderer: RendererPlugin): string {
  renderer.beginGraph(g, job);
  // emit root-graph label before clusters/nodes @see lib/common/emit.c:emit_page (3656-3657)
  renderGraphLabel(g, renderer, job);
  renderClusters(g, renderer, job);
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
