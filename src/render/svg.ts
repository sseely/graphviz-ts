// SPDX-License-Identifier: EPL-2.0

/**
 * SVG renderer plugin.
 *
 * Faithful TypeScript port of plugin/core/gvrender_core_svg.c.
 * Implements RendererPlugin to produce SVG 1.1 output.
 *
 * Y-coordinate investigation: The C svg_bzptarray and all shape emitters
 * negate Y with -A[i].y because they receive raw PostScript (Y-up)
 * coordinates and must convert to SVG (Y-down). In this TypeScript port
 * the Y-flip is applied upstream via transformPoint with devscale.y = -1
 * (src/gvc/device.ts). Coordinates received in all renderer callbacks are
 * therefore already in SVG Y-down space; no additional negation is needed.
 *
 * @see plugin/core/gvrender_core_svg.c
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { Point, Box } from '../model/geom.js';
import { boxOverlap } from '../model/geom.js';
import type { TextlabelT } from '../common/types.js';
import type { TextSpan } from '../common/emit-types.js';
import type { RendererPlugin, LabelType } from '../gvc/context.js';
import type { RenderJob } from '../gvc/job.js';
import { renderEdgeLabels } from '../gvc/edge-labels.js';
import { beginAnchorIf } from '../gvc/anchor.js';
import {
  svgBeginGraph,
  svgEndGraph,
  svgBeginPage,
  svgPageBackground,
  svgEndPage,
  svgBeginLayer,
  svgEndLayer,
  svgBeginNode,
  svgEndNode,
  svgBeginEdge,
  svgEndEdge,
  svgBeginAnchor,
  svgEndAnchor,
  svgTextspan,
  svgEllipse,
  svgPolygon,
  svgBezier,
  svgPolyline,
  svgComment,
  svgEdgePath,
  svgEdgePathOrthoRounded,
  orthoRoundedRadius,
  svgArrowPolygons,
  emitParallelEdgePaths,
  escapeXml,
  emitPoints,
} from './svg-helpers.js';
import { emitArrowOps } from './svg-arrow-ops.js';
import { resolveRenderColor, colorOpacity, colorPaint } from './color-resolve.js';
import { svgBeginCluster, svgEndCluster } from './svg-cluster.js';
import { emitSplitEdgePaths } from './svg-edge-split.js';
import { edgeIsTapered, svgTaperedEdge } from './svg-tapered-edge.js';

// ---------------------------------------------------------------------------
// Multicolor arrow helpers
// @see lib/common/emit.c:2508-2528 (tail/head arrow with headcolor/tailcolor)
// ---------------------------------------------------------------------------

/** Emit tail arrow with tailColor and head arrow with headColor (multicolor). */
function emitMulticolorArrows(e: Edge, job: RenderJob, headColor: string, tailColor: string): void {
  const obj = job.obj;
  const pw = obj !== null ? obj.penWidth : 1.0;
  const tailOps = e.info.tailArrowOps;
  if (tailOps?.length) {
    emitArrowOps(tailOps, tailColor, job, pw, colorOpacity(resolveRenderColor(tailColor)));
  }
  const headOps = e.info.headArrowOps;
  if (headOps?.length) {
    emitArrowOps(headOps, headColor, job, pw, colorOpacity(resolveRenderColor(headColor)));
  }
}

// ---------------------------------------------------------------------------
// SvgRenderer — delegates all work to module-level helpers in svg-helpers.ts
// @see plugin/core/gvrender_core_svg.c:svg_engine
// ---------------------------------------------------------------------------

/** overlap_label: does the label's box (pos ± dimen/2) overlap clip box b?
 * @see lib/common/utils.c:overlap_label */
function overlapLabel(lp: TextlabelT, b: Box): boolean {
  const sx = lp.dimen.x / 2;
  const sy = lp.dimen.y / 2;
  const bb: Box = {
    ll: { x: lp.pos.x - sx, y: lp.pos.y - sy },
    ur: { x: lp.pos.x + sx, y: lp.pos.y + sy },
  };
  return boxOverlap(b, bb);
}

/**
 * Faithful-to-outcome `edge_in_box`: true when the edge has something to draw.
 * C's gvrender defers the `<g>` until a draw op, so an edge whose content falls
 * entirely outside the clip emits no group (emit.c:edge_in_box tests each piece
 * vs job->clip via boxf_overlap/overlap_label).
 *
 * The only piece that can legitimately fall OUTSIDE the clip on this corpus is a
 * degenerate labeled-flat label: it is spline-less, so map_edge leaves it at its
 * internal (un-normalized) x-frame position while the clip is the final frame.
 * The `overlapLabel` test on the main label reproduces C's draw-iff-overlap for
 * exactly that case — on-canvas (2368) → drawn; off-canvas (2368_1, negative
 * un-normalized x) → suppressed. A present spline always lies within the clip
 * (GD_bb contains it), and head/tail/xlabels are positioned at on-canvas
 * endpoints, so those keep their existing unconditional triggers — adding an
 * overlap test there only risks suppressing legitimately-drawn content (it
 * regressed neato/circo edges whose spl.bb is computed differently). The `set`
 * guard on the main label is kept: the port retains an unplaced (`pos=0,0`,
 * `set=false`) label on merged back-edges where C has none.
 * @see lib/common/emit.c:edge_in_box, lib/common/utils.c:overlap_label
 */
export function edgeHasDrawableContent(e: Edge, clip: Box): boolean {
  const i = e.info;
  return i.spl !== undefined
    || (i.label !== undefined && i.label.set && overlapLabel(i.label, clip))
    || i.xlabel !== undefined
    || i.head_label !== undefined || i.tail_label !== undefined;
}

export class SvgRenderer implements RendererPlugin {
  readonly type = 'svg';
  /** @see plugin/core/gvplugin_core.c registration table */
  readonly quality = 0;
  /** Whether the current edge's <g> group was opened (deferred-emit state). */
  private edgeGroupOpen = false;

  beginGraph(g: Graph, job: RenderJob): void { svgBeginGraph(g, job); }
  endGraph(_g: Graph, job: RenderJob): void { svgEndGraph(job); }
  beginPage(g: Graph, job: RenderJob): void { svgBeginPage(g, job); }

  pageBackground(g: Graph, job: RenderJob): void { svgPageBackground(g, job); }
  endPage(_g: Graph, job: RenderJob): void { svgEndPage(job); }
  beginLayer(name: string, job: RenderJob): void { svgBeginLayer(name, job); }
  endLayer(job: RenderJob): void { svgEndLayer(job); }
  beginNode(n: Node, job: RenderJob): void { svgBeginNode(n, job); }
  endNode(_n: Node, job: RenderJob): void { svgEndNode(job); }
  beginEdge(e: Edge, job: RenderJob): void {
    // job.bb is the final drawing bbox (= GD_bb / job->clip); emit_edge gates
    // all edge drawing on edge_in_box(e, job->clip). @see lib/common/emit.c:emit_edge
    this.edgeGroupOpen = edgeHasDrawableContent(e, job.bb);
    if (this.edgeGroupOpen) svgBeginEdge(e, job);
  }

  /**
   * Close the edge group.  Edge graphics (path + arrowhead) are emitted here
   * because the full spline is available on e.info.spl only after layout has
   * run routeDotEdges.
   *
   * For multi-color edges (color="c1:c2:…"), emits parallel offset Béziers
   * (one per color, SEP=2.0 apart) then arrows in headcolor/tailcolor.
   * Single-color edges use the T4 path unchanged.
   *
   * @see plugin/core/gvrender_core_svg.c:svg_end_edge
   * @see lib/common/emit.c:2442-2528 (else if numc parallel-bezier branch)
   */
  endEdge(e: Edge, job: RenderJob): void {
    // No <g> opened (no spline/label) → nothing to draw or close, matching C's
    // deferred group emission for content-less edges.
    if (!this.edgeGroupOpen) return;
    this.edgeGroupOpen = false;
    // Whole-edge anchor wraps the spline + arrows only; it closes before the
    // labels, which carry their own sub-anchors (siblings, not nested).
    // @see lib/common/emit.c:2877 (begin) / emit_end_edge:2970 (end)
    const anchored = beginAnchorIf(this, job);
    const colorAttr = e.attrs.get('color') ?? '';
    const numc = (colorAttr.match(/:/g) ?? []).length;
    const numsemi = (colorAttr.match(/;/g) ?? []).length;
    if (numsemi > 0 && numc > 0) {
      // Split-along-length branch (semicolon syntax).
      // Arrow rule is inverted: tail = first color, head = endcolor.
      // @see lib/common/emit.c:2390 if (numsemi && numc) multicolor()
      const { firstColor, endColor } = emitSplitEdgePaths(e, job, colorAttr);
      emitMulticolorArrows(e, job, endColor, firstColor);
    } else if (edgeIsTapered(e)) {
      // Tapered edge: a filled taper polygon + arrows. Takes precedence over
      // colon-multicolor, matching C's `if (tapered) ... else if (numc)`.
      // @see lib/common/emit.c:2422
      svgTaperedEdge(e, job);
    } else if (numc > 0) {
      // Multicolor parallel-bezier branch
      // @see lib/common/emit.c:2443 else if (numc)
      const { headColor, tailColor } = emitParallelEdgePaths(e, job, colorAttr);
      emitMulticolorArrows(e, job, headColor, tailColor);
    } else {
      // Single-color branch. Ortho edges with rounded corners (splines=ortho +
      // radius/style=rounded) emit polyline segments + corner arcs; all other
      // edges keep the byte-stable bezier <path>. @see lib/common/emit.c:2553
      const orthoRadius = orthoRoundedRadius(e, job);
      // svgEdgePath interleaves each bezier's arrowheads per C's emit loop;
      // the rounded-ortho variant keeps the trailing arrow pass (its arrows
      // always sit on the single ortho bezier). @see lib/common/emit.c:2668
      if (orthoRadius !== null) {
        svgEdgePathOrthoRounded(e, orthoRadius, job);
        svgArrowPolygons(e, job);
      } else {
        svgEdgePath(e, job);
      }
    }
    if (anchored) this.endAnchor(job);
    // Edge labels go inside the group, after path + arrows.
    // @see lib/common/emit.c:emit_end_edge (3010-3025)
    renderEdgeLabels(e, this, job);
    svgEndEdge(job);
  }

  beginAnchor(
    href: string,
    tooltip: string,
    target: string,
    id: string,
    job: RenderJob,
  ): void {
    svgBeginAnchor(href, tooltip, target, id, job);
  }

  endAnchor(job: RenderJob): void { svgEndAnchor(job); }

  textspan(pos: Point, span: TextSpan, job: RenderJob): void {
    svgTextspan(pos, span, job);
  }

  ellipse(
    center: Point,
    rx: number,
    ry: number,
    filled: boolean,
    job: RenderJob,
  ): void {
    svgEllipse(center, rx, ry, filled, job);
  }

  polygon(pts: Point[], filled: boolean, job: RenderJob): void {
    svgPolygon(pts, filled, job);
  }

  bezier(pts: Point[], filled: boolean, job: RenderJob): void {
    svgBezier(pts, filled, job);
  }

  polyline(pts: Point[], job: RenderJob): void { svgPolyline(pts, job); }
  // C resets to the default line style and the label's fontcolor before the
  // attachment polyline (emit.c:1886-1893) — the edge's own dash/width must
  // not leak onto it.
  attachmentPolyline(pts: Point[], pencolor: string, job: RenderJob): void {
    // Resolve the label fontcolor through the SVG known-color gate before
    // emission, mirroring C's gvrender_set_pencolor in emit_attachment; a raw
    // attribute value must never reach stroke="..." unresolved/unescaped.
    job.write('<polyline fill="none" stroke="' + colorPaint(resolveRenderColor(pencolor)) + '" points="');
    emitPoints(job, pts);
    job.write('"/>\n');
  }

  /**
   * Emit an <image> element. C formats numbers with %g here (not the
   * svg_printdouble used elsewhere); toPrecision(6) reproduces %g.
   * Deviation: C writes us->name raw (gvputs); the port XML-escapes the
   * src so metacharacter paths cannot produce invalid SVG.
   * @see plugin/core/gvloadimage_core.c:core_loadimage_svg
   */
  usershape(src: string, b: Box, job: RenderJob): void {
    const g = (n: number): string => String(parseFloat(n.toPrecision(6)));
    const width = b.ur.x - b.ll.x;
    const height = b.ur.y - b.ll.y;
    const originx = (b.ur.x + b.ll.x - width) / 2;
    const originy = (b.ur.y + b.ll.y + height) / 2;
    job.write('<image xlink:href="' + escapeXml(src) + '" width="' + g(width)
      + 'px" height="' + g(height) + 'px" preserveAspectRatio="xMinYMin meet" x="'
      + g(originx) + '" y="' + g(-originy) + '"/>\n');
  }

  comment(text: string, job: RenderJob): void { svgComment(text, job); }

  beginLabel(_type: LabelType, _job: RenderJob): void { /* no-op */ }
  endLabel(_job: RenderJob): void { /* no-op */ }
  beginCluster(sg: Graph, job: RenderJob): void { svgBeginCluster(sg, job); }
  endCluster(_sg: Graph, job: RenderJob): void { svgEndCluster(job); }
}

// ---------------------------------------------------------------------------
// Factory — @see plugin/core/gvrender_core_svg.c:gvrender_svg_types
// ---------------------------------------------------------------------------

export function createSvgRenderer(): RendererPlugin {
  return new SvgRenderer();
}
