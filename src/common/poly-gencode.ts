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
import type { PlacedHtml } from './htmltable-pos.js';
import { emitHtmlLabel } from './htmltable-emit.js';
import { transformPoint } from '../gvc/device.js'; // used by renderEllipse/renderPolygon
import { nodeAttr } from './poly-init.js';
import { substObjAnchor, interpretCRNL } from './subst.js';

/** Render one ellipse periphery ring for a node. */
export function renderEllipse(
  ring: Point[],
  coord: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const rx = Math.abs((ring[1]!.x - ring[0]!.x) / 2);
  const ry = Math.abs((ring[1]!.y - ring[0]!.y) / 2);
  const center = transformPoint(coord, job);
  renderer.ellipse(center, rx, ry, false, job);
}

/** Render one polygon periphery ring for a node. */
export function renderPolygon(
  ring: Point[],
  coord: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const pts = ring.map(
    (v) => transformPoint({ x: v.x + coord.x, y: v.y + coord.y }, job),
  );
  renderer.polygon(pts, false, job);
}

/**
 * Draw the node boundary: one ring per periphery, innermost first.
 * peripheries < 1 (plaintext/none/plain) draws no boundary — C only
 * draws in that case for filled nodes (transparent pen), and fills are
 * not yet ported in the live path.
 * @see lib/common/shapes.c:poly_gencode (peripheries draw loop, :3013-3055)
 */
function renderPeripheries(
  poly: PolygonT,
  coord: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const sides = poly.sides <= 2 ? 2 : poly.sides;
  const verts = poly.vertices!;
  for (let j = 0; j < poly.peripheries; j++) {
    const ring = verts.slice(j * sides, (j + 1) * sides);
    if (ring.length < sides) break;
    if (poly.sides <= 2) renderEllipse(ring, coord, renderer, job);
    else renderPolygon(ring, coord, renderer, job);
  }
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

/** Non-empty node attr (root-default inheritance), or undefined. */
function anchorAttr(n: Node, key: string): string | undefined {
  const v = nodeAttr(n, n.root, key);
  return v !== undefined && v !== '' ? v : undefined;
}

/**
 * Open the whole-node anchor when the node has a URL or an explicit
 * tooltip; the tooltip defaults to the label text (initMapData).
 * Returns true when the caller must close the anchor after the label.
 * @see lib/common/shapes.c:poly_gencode (doMap)
 * @see lib/common/emit.c:initObjMapData / initMapData
 */
function beginNodeAnchor(n: Node, renderer: RendererPlugin, job: RenderJob): boolean {
  const url = anchorAttr(n, 'href') ?? anchorAttr(n, 'URL');
  const tooltip = anchorAttr(n, 'tooltip');
  if (url === undefined && tooltip === undefined) return false;
  const label = n.info.label as TextlabelT | undefined;
  renderer.beginAnchor?.(
    url !== undefined ? substObjAnchor(url, n) : '',
    // C: preprocessTooltip (CRNL) runs before initMapData's substitution.
    // @see lib/common/emit.c:initObjMapData
    tooltip !== undefined ? substObjAnchor(interpretCRNL(tooltip), n) : (label?.text ?? ''),
    anchorAttr(n, 'target') ?? '',
    'node' + (n.id + 1),
    job,
  );
  return true;
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
  const inAnchor = beginNodeAnchor(n, renderer, job);
  renderPeripheries(poly, coord, renderer, job);

  const label = n.info.label as TextlabelT | undefined;
  if (label?.html && label.u.kind === 'html') {
    label.pos = coord;
    label.set = true;
    emitHtmlLabel(label.u.html as PlacedHtml, coord, renderer, job);
  } else if (label) {
    renderLabel(label, coord, renderer, job);
  }
  if (inAnchor) renderer.endAnchor?.(job);
}
