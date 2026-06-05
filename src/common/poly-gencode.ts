// SPDX-License-Identifier: EPL-2.0

/**
 * Shape rendering (polygon/ellipse + label) for polygon nodes.
 *
 * @see lib/common/shapes.c:poly_gencode
 */

import type { Node } from '../model/node.js';
import type { Point } from '../model/geom.js';
import type { RenderJob } from '../gvc/job.js';
import type { RendererPlugin } from '../gvc/context.js';
import type { PolygonT, TextlabelT } from './types.js';
import type { TextSpan } from './emit-types.js';
import { transformPoint } from '../gvc/device.js'; // used by renderEllipse/renderPolygon

/** Render an ellipse shape for a node. */
export function renderEllipse(
  poly: PolygonT,
  coord: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const verts = poly.vertices!;
  const rx = Math.abs((verts[1]!.x - verts[0]!.x) / 2);
  const ry = Math.abs((verts[1]!.y - verts[0]!.y) / 2);
  const center = transformPoint(coord, job);
  renderer.ellipse(center, rx, ry, false, job);
}

/** Render a polygon shape for a node. */
export function renderPolygon(
  poly: PolygonT,
  coord: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const pts = poly.vertices!.map(
    (v) => transformPoint({ x: v.x + coord.x, y: v.y + coord.y }, job),
  );
  renderer.polygon(pts, false, job);
}

/**
 * Render the text label for a node.
 *
 * Text position follows C emit_label (center valign):
 *   py = pos.y + dimen.y / 2.0 - fontsize
 * Then svgTextspan negates it (matches C's -p.y write).
 *
 * @see lib/common/labels.c:emit_label
 * @see lib/common/shapes.c:poly_gencode (sets ND_label.pos = ND_coord)
 */
export function renderLabel(
  label: TextlabelT,
  coord: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  if (label.u.kind !== 'txt' || label.u.nspans < 1) return;
  label.pos = coord;
  label.set = true;
  // Center-valign y: pos.y + dimen.y/2 - fontsize  (graphviz y-up space)
  const py = coord.y + label.dimen.y / 2.0 - label.fontsize;
  for (let i = 0; i < label.u.nspans; i++) {
    const span = label.u.span[i] as TextSpan;
    // Pass graphviz y; svgTextspan negates it per C svg_textspan behavior
    renderer.textspan({ x: coord.x, y: py }, span, job);
  }
}

/**
 * Render node shape (polygon/ellipse) and label.
 * Shape codefn — called from walkNodes.
 * @see lib/common/shapes.c:poly_gencode
 */
export function polyGencode(rawJob: unknown, rawNode: unknown): void {
  const job = rawJob as RenderJob;
  const n = rawNode as Node;
  const renderer = job.renderer;
  if (!renderer) return;

  const poly = n.info.shape_info as PolygonT | undefined;
  if (!poly?.vertices) return;

  const coord = n.info.coord ?? { x: 0, y: 0 };
  const sides = poly.sides <= 2 ? 2 : poly.sides;

  if (sides <= 2) {
    renderEllipse(poly, coord, renderer, job);
  } else {
    renderPolygon(poly, coord, renderer, job);
  }

  const label = n.info.label as TextlabelT | undefined;
  if (label) renderLabel(label, coord, renderer, job);
}
