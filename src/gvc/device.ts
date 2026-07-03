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
import { parseDrawingSize, initJobViewportZoom, parseLandscape, parseGraphPad, parseGraphMargin } from './viewport.js';
import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { RendererPlugin, GvcContext } from './context.js';
import { PenType } from './context.js';
import { gvrenderTextspan } from './textspan-emit.js';
import { resolveEdgeAnchor, resolveObjAnchor, beginAnchorIf } from './anchor.js';
import type { ShapeDesc, TextlabelT } from '../common/types.js';
import type { TextSpan } from '../common/emit-types.js';
import { type LayerInfo, parseLayers } from '../common/layers.js';
import { RenderJob, GVRENDER_DOES_TRANSFORM, createObjState, ObjType, EmitState } from './job.js';
import { walkNodesAndEdges } from './emit-walk.js';
import { computeSubgraphBB } from '../layout/pack/index.js';
import { polyInit } from '../common/poly-init.js';
import { emitHtmlLabel } from '../common/htmltable-emit.js';
import {
  setHtmlAnchorObj,
  setHtmlObjImgscale,
  resetHtmlAnchorIds,
} from '../common/htmltable-emit-rules.js';
import { nodeAttr } from '../common/poly-init.js';
import type { PlacedHtml } from '../common/htmltable-pos.js';
import {
  parseStyleFlags,
  resolvePenColor,
  resolvePenType,
  resolvePenWidth,
} from '../common/style-resolve.js';
import { resolveRenderColor, withColorScheme } from '../render/color-resolve.js';
import { emitRoundedBezier } from '../common/poly-shapes.js';
import { applyClusterObjState, clusterStyle, clusterPeripheries } from './device-cluster.js';
/** Cluster labels go through the single emit_label port. @see labels.c:emit_label */
export function renderClusterLabel(sg: Graph, renderer: RendererPlugin, job: RenderJob): void {
  renderOneLabel(sg.info.label as TextlabelT | undefined, renderer, job);
}
import { svgNodeId, svgEdgeId, svgClusterId, svgGraphId } from '../render/svg-id.js';

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
  // ADR-2: SVG landscape rotation lives entirely in the graph `<g>` group
  // transform (svg_begin_page emits rotate(-job->rotation)); inner coords stay
  // in the unrotated frame. The ptf rotation branch (applyRotation) is the
  // raster/imagemap path and must NOT fire here, else job.rotation=90 would
  // double-rotate every SVG coordinate. applyRotation stays exported as the
  // faithful gvrender_ptf port (currently dead). @see ADR-2; gvrender.c:gvrender_ptf
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

/** Label text for anchor tooltip defaults (C: obj->label). */
function labelTextOf(lp: unknown): string | null {
  return (lp as TextlabelT | undefined)?.text ?? null;
}

/**
 * Inner body of renderNode — runs inside the push/pop try block.
 * Extracted to keep renderNode under the 30-line hook limit.
 * @see lib/common/emit.c:emit_begin_node:1654
 */
function emitNodeBody(n: Node, renderer: RendererPlugin, job: RenderJob): void {
  setHtmlAnchorObj(svgNodeId(n, job), labelTextOf(n.info.label), job.obj ?? undefined);
  setHtmlObjImgscale(nodeAttr(n, n.root, 'imagescale'));
  renderer.beginNode(n, job);
  const shape = n.info.shape as ShapeDesc | undefined;
  if (shape?.fns?.codefn) shape.fns.codefn(job, n);
  renderNodeXLabel(n, renderer, job);
  renderer.endNode(n, job);
}

/**
 * Render a single node if not already rendered.
 * push_obj_state before emit_begin_node; pop_obj_state in emit_end_node.
 * @see lib/common/emit.c:emit_node
 * @see lib/common/emit.c:emit_begin_node:1654
 * @see lib/common/emit.c:emit_end_node:1794
 */
export function renderNode(n: Node, renderer: RendererPlugin, job: RenderJob, done: Set<Node>): void {
  if (done.has(n)) return;
  done.add(n);
  // Shortcircuit invisible nodes: C omits the whole node before emit_begin_node.
  // @see lib/common/emit.c:emit_node (style "invis" return)
  if (parseStyleFlags(n.attrs.get('style')).invis) return;
  const obj = createObjState(ObjType.Node);
  obj.emitState = EmitState.NDraw;
  job.pushObj(obj);
  try {
    emitNodeBody(n, renderer, job);
  } finally {
    job.popObj();
  }
}

/**
 * Render a single edge.
 * push_obj_state before beginEdge; pop_obj_state after endEdge.
 * @see lib/common/emit.c:emit_edge
 * @see lib/common/emit.c:emit_begin_edge:2715
 * @see lib/common/emit.c:emit_end_edge:3028
 * @see lib/common/emit.c:emit_edge_graphics:2350 (color/pencolor/penwidth)
 */
/**
 * Set the edge pen color/type/width on job.obj from the edge's attrs — mirrors
 * emit_edge_graphics. (AD1: style flows through job.obj, not ad-hoc renderer reads.)
 */
function setEdgePen(e: Edge, job: RenderJob): void {
  if (job.obj === null) return;
  const obj = job.obj;
  const flags = parseStyleFlags(e.attrs.get('style'));
  obj.penColor = withColorScheme(e.attrs.get('colorscheme'),
    () => resolveRenderColor(resolvePenColor(e.attrs.get('color'))));
  obj.pen = resolvePenType(flags);
  obj.penWidth = resolvePenWidth(flags, e.attrs.get('penwidth'));
}

export function renderEdge(e: Edge, renderer: RendererPlugin, job: RenderJob): void {
  // Shortcircuit invisible edges: C omits the whole edge (no group/title/path)
  // before emit_begin_edge. @see lib/common/emit.c:emit_edge (style "invis" return)
  if (parseStyleFlags(e.attrs.get('style')).invis) return;
  // push_obj_state in emit_begin_edge (line 2715)
  const obj = createObjState(ObjType.Edge);
  obj.emitState = EmitState.EDraw;
  job.pushObj(obj);
  setEdgePen(e, job);
  try {
    // @see lib/common/emit.c:emit_begin_edge / getObjId
    setHtmlAnchorObj(svgEdgeId(e, job), labelTextOf(e.info.label), job.obj ?? undefined);
    // Resolve edge url/tooltip/target/id into obj for the whole-edge anchor
    // (svg endEdge) and the per-label sub-anchors (renderEdgeLabels).
    resolveEdgeAnchor(e, svgEdgeId(e, job), obj);
    // Activate the edge's colorscheme around the whole emission so label
    // textspans resolve numeric color indices (e.g. fontcolor=2) against it,
    // mirroring C's setColorScheme window in emit_edge.
    // @see lib/common/emit.c:emit_edge (begin/end color context)
    withColorScheme(e.attrs.get('colorscheme'), () => {
      renderer.beginEdge(e, job);
      renderer.endEdge(e, job);
    });
  } finally {
    // pop_obj_state in emit_end_edge (line 3028)
    job.popObj();
  }
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
  // HTML branch: @see lib/common/labels.c:emit_label (226-230)
  // C routes to emit_html_label(job, lp->u.html, lp) using lp->pos as anchor.
  if (lp.html) {
    if (lp.u.kind === 'html') {
      emitHtmlLabel(lp.u.html as PlacedHtml, lp.pos, renderer, job);
    }
    return;
  }
  if (lp.u.kind !== 'txt' || lp.u.nspans < 1) return;
  let y = labelFirstSpanY(lp);
  for (let i = 0; i < lp.u.nspans; i++) {
    const span = lp.u.span[i] as TextSpan | undefined;
    if (!span) break;
    // Emit only visible spans; the baseline still advances below so blank
    // lines reserve vertical space. @see gvrender_textspan (gvrender.c:419).
    gvrenderTextspan(renderer, { x: labelSpanX(lp, span.just), y }, span, job);
    y -= span.size.y; // UL position for next span (unconditional)
  }
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
  // @see lib/common/emit.c:emit_begin_graph / getObjId (root graph → graph0)
  setHtmlAnchorObj(svgGraphId(g, job), labelTextOf(g.info.label), job.obj ?? undefined);
  renderOneLabel(g.info.label as TextlabelT | undefined, renderer, job);
}

// ---------------------------------------------------------------------------
// renderGraph — @see lib/gvc/gvrender.c:gvrender_begin_graph / end_graph
// ---------------------------------------------------------------------------

/**
 * Draw a cluster boundary: a rounded bezier `<path>` when `style=rounded`,
 * else the sharp `<polygon>`. Rounded mirrors emit.c's round_corners AF order
 * LL,(UR.x,LL.y),UR,(LL.x,UR.y); sharp keeps gvrender_box's order.
 * @see lib/common/emit.c:3877-3892 / lib/gvc/gvrender.c:gvrender_box
 */
function renderClusterBox(
  sg: Graph, filled: boolean, renderer: RendererPlugin, job: RenderJob,
): void {
  const { ll, ur } = sg.info.bb!;
  if (parseStyleFlags(clusterStyle(sg)).rounded) {
    const af = [{ x: ll.x, y: ll.y }, { x: ur.x, y: ll.y }, { x: ur.x, y: ur.y }, { x: ll.x, y: ur.y }];
    emitRoundedBezier(af, { x: 0, y: 0 }, filled, { renderer, job });
    return;
  }
  const rawPts = [{ x: ll.x, y: ll.y }, { x: ll.x, y: ur.y }, { x: ur.x, y: ur.y }, { x: ur.x, y: ll.y }];
  renderer.polygon(rawPts.map(p => transformPoint(p, job)), filled, job);
}

/**
 * Render one cluster: box, label, endCluster, then recurse into sub-clusters.
 * push_obj_state in emit_begin_cluster (3762); pop in emit_end_cluster (3774).
 * Sub-cluster recursion follows emit_end_cluster (line 3940-3941) — the pop
 * completes before recursing; sub-clusters are separate pushes on a clean stack.
 * @see lib/common/emit.c:emit_clusters:3777
 */
function renderOneCluster(sg: Graph, renderer: RendererPlugin, job: RenderJob): void {
  // push_obj_state in emit_begin_cluster (line 3762), before beginCluster
  const obj = createObjState(ObjType.Cluster);
  obj.emitState = EmitState.CDraw;
  job.pushObj(obj);
  try {
    // Resolve and wire cluster fill/pen into job.obj before the polygon.
    // emit_clusters:3805-3874 — must happen before gvrender_box.
    const filled = applyClusterObjState(sg, job);
    // Cluster id is clust<AGSEQ seq> (getObjId); obj.id feeds emitGradientDefs
    // the "clustN_l_0" gradient prefix. seq is stable on the subgraph, so the
    // begin/assign order below is no longer load-bearing.
    // @see lib/common/emit.c:209 getObjId (AGRAPH/cluster: pfx="clust")
    renderer.beginCluster?.(sg, job);
    if (job.obj !== null) job.obj.id = svgClusterId(sg, job);
    // @see lib/common/emit.c:emit_begin_cluster / getObjId
    setHtmlAnchorObj(svgClusterId(sg, job), labelTextOf(sg.info.label), job.obj ?? undefined);
    // Resolve and open the cluster anchor around the box + label (closed before
    // the cluster's child nodes — sibling of them). @see emit.c:3803.
    if (job.obj !== null) {
      resolveObjAnchor(sg, labelTextOf(sg.info.label), svgClusterId(sg, job), job.obj);
    }
    const anchored = beginAnchorIf(renderer, job);
    // C draws the boundary box only when peripheries != 0, or (peripheries == 0
    // and the cluster is filled). peripheries=0 + unfilled emits nothing.
    // style=invis sets PEN_NONE and gvrender_polygon skips the whole box
    // (fill included); the group/title still emit.
    // @see lib/common/emit.c:3907-3917, lib/gvc/gvrender.c:543
    if ((clusterPeripheries(sg) !== 0 || filled) && job.obj?.pen !== PenType.None) {
      renderClusterBox(sg, filled, renderer, job);
    }
    renderClusterLabel(sg, renderer, job);
    if (anchored) renderer.endAnchor?.(job);
    renderer.endCluster?.(sg, job);
  } finally {
    // pop_obj_state in emit_end_cluster (line 3774), before sub-cluster recursion
    job.popObj();
  }
  // C recurses AFTER emit_end_cluster (line 3940-3941): sub-clusters are drawn
  // with the parent already popped — each has its own independent push/pop.
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
  // push_obj_state in emit_begin_graph (line 3573), before beginGraph call
  const obj = createObjState(ObjType.RootGraph);
  obj.emitState = EmitState.GDraw;
  job.pushObj(obj);
  try {
    const info = parseLayers(g);
    // Only layer-capable renderers (SVG) do the layer loop; others collapse to
    // one pass. @see lib/common/emit.c:1140 (GVDEVICE_DOES_LAYERS)
    const layered = renderer.beginLayer !== undefined && info.numLayers > 1;
    job.numLayers = layered ? info.numLayers : 1;
    job.layerIDs = info.layerIDs;
    renderer.beginGraph(g, job);
    for (let ln = 1; ln <= job.numLayers; ln++) {
      job.layerNum = ln;
      if (layered) renderer.beginLayer!(info.layerIDs[ln]!, job);
      renderPage(g, renderer, job, info);
      if (layered) renderer.endLayer!(job);
    }
    renderer.endGraph(g, job);
  } finally {
    // pop_obj_state in emit_end_graph (line 3586), after endGraph
    job.popObj();
  }
  return job.output.join('');
}

/** One page (per layer): graph group, background+label (in the graph anchor),
 * clusters, nodes/edges. The graph anchor wraps emit_background + the graph
 * label, closing before emit_view (clusters/nodes) — siblings.
 * @see lib/common/emit.c:emit_page (3651-3660) */
function renderPage(g: Graph, renderer: RendererPlugin, job: RenderJob, info: LayerInfo): void {
  renderer.beginPage?.(g, job);
  if (job.obj !== null) {
    resolveObjAnchor(g, labelTextOf(g.info.label), svgGraphId(g, job), job.obj);
  }
  const anchored = beginAnchorIf(renderer, job);
  renderer.pageBackground?.(g, job);
  // emit root-graph label before clusters/nodes @see lib/common/emit.c:emit_page
  renderGraphLabel(g, renderer, job);
  if (anchored) renderer.endAnchor?.(job);
  renderClusters(g, renderer, job);
  walkNodesAndEdges(g, renderer, job, info);
  renderer.endPage?.(g, job);
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
  // init_job_pad: resolve job.pad from the `pad=` graph attribute before the
  // size= fit is computed — C calls init_job_pad before init_job_viewport
  // (emit.c:4289-4291) because the fit uses the padded bb.
  // @see lib/common/emit.c:3241-3251 (attr read); :3290-3304 (fallback)
  job.pad = parseGraphPad(g.attrs.get('pad'));
  // init_job_margin: resolve job.margin from the `margin=` graph attribute,
  // immediately after init_job_pad (C's call order, emit.c:4290-4291).
  // margin does NOT feed the size= zoom fit below (only pad does) -- it is
  // read here and consumed later, after Z is known, by emitSvgTag/svgBeginPage
  // (job.width/height and the page group translate), matching C's
  // init_job_margin -> init_job_dpi -> init_job_viewport -> init_job_pagination
  // order where margin is resolved before Z but only used after it.
  // @see lib/common/emit.c:3229-3239 (attr read); :3309-3331 (fallback)
  job.margin = parseGraphMargin(g.attrs.get('margin'));
  // init_job_viewport: fit the drawing into size= via a zoom Z carried by the
  // SVG group transform (D1: parse here, not graph_init).
  //
  // Correction to D3: only the trailing `!` on size= sets the *filled* flag
  // that init_job_viewport reads (input.c:694 GD_drawing->filled =
  // getdoubles2ptf). `ratio=fill` instead sets ratio_kind=R_FILL (setRatio),
  // which reshapes the *layout* (out of scope, D3) and does NOT feed
  // init_job_viewport — so it is not OR-ed into filled here (doing so upscales
  // ~31x where the oracle reshapes to ~1x). ratio=fill graphs therefore diverge
  // on node positions, the deferred ratio-aspect-layout mission.
  //
  // Deviation from D4's stated mechanism: the brief assumed transformPoint
  // short-circuits on GVRENDER_DOES_TRANSFORM for SVG, leaving job.zoom free to
  // scale coordinates. In this port that flag is never set, so transformPoint
  // (the shared raster ptf path — do not touch) applies job.zoom*devscale to
  // every coordinate. To keep SVG coords full-size (D4's intent) WITHOUT
  // altering the ptf path, carry Z in job.scale instead — which is exactly what
  // C's SVG group emits (svg_begin_page prints job->scale.x/y = zoom*dpi/72 = Z
  // for dpi=72), not job->zoom. job.scale is read only by the SVG group/dims.
  const z = initJobViewportZoom(job.bb, parseDrawingSize(g.attrs.get('size')), job.pad);
  job.scale = { x: z, y: z };
  // init_job_viewport: job->rotation = gvc->rotation (= 90 for landscape, set in
  // emit_graph from GD_drawing->landscape). Emit-only — drives the SVG group
  // transform + dim swap (T2), never layout/routing (ADR-1). transformPoint is
  // guarded against the ptf rotation branch (ADR-2).
  // @see lib/common/emit.c:3260 (gvc->rotation=90); :3390 (job->rotation)
  job.rotation = parseLandscape(g) ? 90 : 0;
  job.renderer = renderer;
  resetHtmlAnchorIds(); // C: fresh anchorId per dot invocation
  for (const n of g.nodes.values()) polyInit(n, g, job.measurer);
  return renderGraph(g, job, renderer);
}
