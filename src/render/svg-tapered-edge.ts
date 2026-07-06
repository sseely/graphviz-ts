// SPDX-License-Identifier: EPL-2.0
//
// SVG emit for `style="tapered"` edges. Ports the `if (tapered)` branch of
// emit_edge_graphics: draw the first Bézier as a filled taper polygon
// (pencolor transparent, fillcolor = edge color) and then the arrowheads.
//
// @see lib/common/emit.c:2422 emit_edge_graphics (tapered branch)

import type { Edge } from '../model/edge.js';
import type { RenderJob } from '../gvc/job.js';
import { taper, taperfun } from '../common/taper.js';
import { svgPolygon, svgArrowPolygons } from './svg-helpers.js';
import { transformPoint } from '../gvc/device.js';
import { isDirected } from './dot.js';

/**
 * True if `style="tapered"` is among the edge's style tokens, mirroring
 * emit_edge_graphics' scan of the parse_style list. Tokens are comma-separated
 * (parse_style), so a bare `tapered` matches. @see lib/common/emit.c:2371
 */
export function edgeIsTapered(e: Edge): boolean {
  const style = e.attrs.get('style');
  if (style === undefined || style === '') return false;
  return style.split(',').some((t) => t.trim() === 'tapered');
}

/**
 * Emit a tapered edge: the taper polygon followed by the arrowheads. C sets
 * pencolor "transparent" and fillcolor = edge color for the polygon, then
 * restores pencolor = color before the arrows. The port carries pen/fill on
 * job.obj, so we swap them around the polygon and restore for
 * svgArrowPolygons (which paints in obj.penColor).
 * @see lib/common/emit.c:2422
 */
export function svgTaperedEdge(e: Edge, job: RenderJob): void {
  const spl = e.info.spl;
  const obj = job.obj;
  if (spl === undefined || spl.list.length === 0 || obj === null) return;
  const bz = spl.list[0]!;
  const radfunc = taperfun(e.attrs.get('dir'), isDirected(e.tail.root));
  // taper() works in layout coords (y-up); svgPolygon emits emit-space points,
  // so map through transformPoint (devscale.y=-1 + translation) like node polys.
  const verts = taper(bz, radfunc, obj.penWidth).map((p) => transformPoint(p, job));

  const savedPen = obj.penColor;
  const savedFill = obj.fillColor;
  // pencolor -> transparent (renders stroke="none"); fillcolor -> edge color.
  obj.fillColor = savedPen;
  obj.penColor = { type: 'string', s: 'transparent' };
  svgPolygon(verts, true, job);
  obj.penColor = savedPen;
  obj.fillColor = savedFill;

  // Arrowheads (bz.sflag/eflag) — precomputed head/tail ops, painted in color.
  svgArrowPolygons(e, job);
}
