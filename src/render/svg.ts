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
import type { Point } from '../model/geom.js';
import type { TextSpan } from '../common/emit-types.js';
import type { RendererPlugin, LabelType } from '../gvc/context.js';
import type { RenderJob } from '../gvc/job.js';
import { renderEdgeLabels } from '../gvc/device.js';
import {
  svgBeginGraph,
  svgEndGraph,
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
  svgArrowPolygons,
} from './svg-helpers.js';
import { svgBeginCluster, svgEndCluster } from './svg-cluster.js';

// ---------------------------------------------------------------------------
// SvgRenderer — delegates all work to module-level helpers in svg-helpers.ts
// @see plugin/core/gvrender_core_svg.c:svg_engine
// ---------------------------------------------------------------------------

export class SvgRenderer implements RendererPlugin {
  readonly type = 'svg';
  /** @see plugin/core/gvplugin_core.c registration table */
  readonly quality = 0;

  beginGraph(g: Graph, job: RenderJob): void { svgBeginGraph(g, job); }
  endGraph(_g: Graph, job: RenderJob): void { svgEndGraph(job); }
  beginNode(n: Node, job: RenderJob): void { svgBeginNode(n, job); }
  endNode(_n: Node, job: RenderJob): void { svgEndNode(job); }
  beginEdge(e: Edge, job: RenderJob): void { svgBeginEdge(e, job); }

  /**
   * Close the edge group.  Edge graphics (path + arrowhead) are emitted here
   * because the full spline is available on e.info.spl only after layout has
   * run routeDotEdges.
   *
   * @see plugin/core/gvrender_core_svg.c:svg_end_edge
   */
  endEdge(e: Edge, job: RenderJob): void {
    svgEdgePath(e, job);
    svgArrowPolygons(e, job);
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
