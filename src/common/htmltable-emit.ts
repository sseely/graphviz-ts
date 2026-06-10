// SPDX-License-Identifier: EPL-2.0

/**
 * HTML label rendering: emits a positioned HTML label (cell borders,
 * text runs, table border) through the renderer plugin.
 * Draw order matches C: cells first, table border last.
 *
 * @see lib/common/htmltable.c:emit_html_tbl
 * @see lib/common/htmltable.c:emit_html_cell
 * @see lib/common/htmltable.c:emit_htextspans
 */

import type { Point, Box } from '../model/geom.js';
import type { RenderJob } from '../gvc/job.js';
import type { RendererPlugin } from '../gvc/context.js';
import type { TextSpan } from './emit-types.js';
import type { PlacedHtml, PlacedCell, PlacedLine } from './htmltable-pos.js';
import { transformPoint } from '../gvc/device.js';

/** Box outline corner order matches gvrender_box: LL, (LL.x,UR.y), UR, (UR.x,LL.y). */
export function emitHtmlBox(
  box: Box,
  pos: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const pts = [
    { x: box.ll.x + pos.x, y: box.ll.y + pos.y },
    { x: box.ll.x + pos.x, y: box.ur.y + pos.y },
    { x: box.ur.x + pos.x, y: box.ur.y + pos.y },
    { x: box.ur.x + pos.x, y: box.ll.y + pos.y },
  ].map((p) => transformPoint(p, job));
  renderer.polygon(pts, false, job);
}

/** Emit one text run. The baseline is final: no centerline offset is added. */
export function emitHtmlLine(
  line: PlacedLine,
  pos: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const span: TextSpan = {
    str: line.text,
    fontName: line.fontName,
    fontSize: line.fontSize,
    fontColor: line.fontColor,
    fontFlags: 0,
    yoffset_layout: 0,
    yoffset_centerline: 0,
    size: { x: line.width, y: line.fontSize },
    just: 'l',
  };
  renderer.textspan({ x: line.x + pos.x, y: line.baseline + pos.y }, span, job);
}

/** Emit a cell: border box (if any) then text. @see emit_html_cell */
export function emitHtmlCell(
  cell: PlacedCell,
  pos: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  if (cell.border > 0) emitHtmlBox(cell.box, pos, renderer, job);
  for (const line of cell.lines) emitHtmlLine(line, pos, renderer, job);
}

/**
 * Emit a positioned HTML label anchored at `pos` (the label center).
 * @see lib/common/htmltable.c:emit_html_tbl
 */
export function emitHtmlLabel(
  placed: PlacedHtml,
  pos: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  for (const cell of placed.cells) emitHtmlCell(cell, pos, renderer, job);
  if (placed.border > 0) emitHtmlBox(placed.box, pos, renderer, job);
}
