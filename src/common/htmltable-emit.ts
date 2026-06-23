// SPDX-License-Identifier: EPL-2.0

/**
 * HTML label rendering: emits a positioned HTML label (cell borders,
 * text runs, table border) through the renderer plugin.
 *
 * emitHtmlLabel is the port of emit_html_tbl.
 * emitHtmlCell  is the port of emit_html_cell.
 *
 * Decoration (bgcolor fill, per-side borders, anchors, rules) fires
 * only when the corresponding metadata fields are present on the
 * PlacedCell / PlacedHtml — mirroring C's conditional structure.
 * Undecorated tables emit byte-identically to before T6.
 *
 * @see lib/common/htmltable.c:emit_html_tbl
 * @see lib/common/htmltable.c:emit_html_cell
 * @see lib/common/htmltable.c:emit_htextspans
 * @see lib/common/htmltable.c:setFill
 * @see lib/common/htmltable.c:initAnchor
 * @see lib/common/htmltable.c:endAnchor
 * @see lib/common/htmltable.c:doBorder
 * @see lib/common/htmltable.c:emit_html_rules
 */

import type { Point, Box } from '../model/geom.js';
import type { RenderJob } from '../gvc/job.js';
import type { RendererPlugin } from '../gvc/context.js';
import type { TextSpan } from './emit-types.js';
import type { PlacedHtml, PlacedCell, PlacedLine, PlacedImage } from './htmltable-pos.js';
import { transformPoint } from '../gvc/device.js';
import { withHtmlPaint, parseGradientSpec, doBorder, type HtmlPaint } from './htmltable-emit-fill.js';
import { emitHtmlRules, initHtmlAnchor, endHtmlAnchor, htmlObjImgscale } from './htmltable-emit-rules.js';

export type { PlacedHtml, PlacedCell, PlacedLine, PlacedImage };

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/** Box outline polygon: LL, (LL.x,UR.y), UR, (UR.x,LL.y). */
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

/** Build a TextSpan from a PlacedLine. */
function lineToSpan(line: PlacedLine): TextSpan {
  return {
    str: line.text,
    fontName: line.fontName,
    fontSize: line.fontSize,
    fontColor: line.fontColor,
    fontFlags: line.fontFlags,
    yoffset_layout: 0,
    // simple blocks: 0 (cancelled in the lfsize math); non-simple: 1.
    // @see lib/common/htmltable.c:emit_htextspans (lines 177-180)
    yoffset_centerline: line.yoffsetCenterline ?? 0,
    size: { x: line.width, y: line.fontSize },
    just: 'l',
  };
}

/** Emit one text run. @see lib/common/htmltable.c:emit_htextspans */
export function emitHtmlLine(
  line: PlacedLine, pos: Point, renderer: RendererPlugin, job: RenderJob,
): void {
  renderer.textspan({ x: line.x + pos.x, y: line.baseline + pos.y }, lineToSpan(line), job);
}

// ---------------------------------------------------------------------------
// Shared decoration helpers
// ---------------------------------------------------------------------------

/** Context for bgcolor fill emission. */
interface BgFillCtx {
  bgcolor: string;
  box: Box;
  pos: Point;
  renderer: RendererPlugin;
  job: RenderJob;
  /** Gradient angle (degrees) from the table/cell; 0 when absent. */
  gradientangle?: number;
  /** Style string; a "radial" substring selects a radial gradient. */
  style?: string;
}

/**
 * Build the paint for a bgcolor: a gradient for "c1:c2" specs (linear, or
 * radial when style includes "radial"), else a solid fill. Mirrors C setFill:
 * clrs[0] = fill, clrs[1] = gradient stop, angle from gradientangle.
 * @see lib/common/htmltable.c:setFill
 */
function bgFillPaint(ctx: BgFillCtx): HtmlPaint {
  const spec = parseGradientSpec(ctx.bgcolor);
  if (spec === null) return { fill: ctx.bgcolor };
  return {
    fill: spec[0], stop: spec[1], gradientAngle: ctx.gradientangle ?? 0,
    radial: ctx.style !== undefined && ctx.style.includes('radial'),
  };
}

/** Emit a filled bgcolor polygon (solid or gradient). */
function emitBgFill(ctx: BgFillCtx): void {
  const { box, pos, renderer, job } = ctx;
  withHtmlPaint(bgFillPaint(ctx), job, () => {
    const pts = [
      { x: box.ll.x + pos.x, y: box.ll.y + pos.y },
      { x: box.ll.x + pos.x, y: box.ur.y + pos.y },
      { x: box.ur.x + pos.x, y: box.ur.y + pos.y },
      { x: box.ur.x + pos.x, y: box.ll.y + pos.y },
    ].map((p) => transformPoint(p, job));
    renderer.polygon(pts, true, job);
  });
}

/** Decoration fields shared by PlacedCell and PlacedHtml for border emission. */
interface BorderDecor {
  box: Box;
  pos: Point;
  border: number;
  color?: string;
  sides?: number;
  style?: string;
}

/**
 * Emit a border via doBorder (penwidth = border, box inset by border/2 when
 * border > 1); the default border=1/no-decoration case is byte-identical to a
 * plain box outline. @see lib/common/htmltable.c:emit_html_cell
 */
function emitBorder(
  d: BorderDecor,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  doBorder({ box: d.box, pos: d.pos, border: d.border, color: d.color ?? 'black', sides: d.sides, style: d.style }, renderer, job);
}

// ---------------------------------------------------------------------------
// emitHtmlCell — port of emit_html_cell
// ---------------------------------------------------------------------------

/** Emit fill + border for a cell. */
function emitCellDecoration(
  cell: PlacedCell,
  pos: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  if (cell.bgcolor !== undefined) {
    emitBgFill({ bgcolor: cell.bgcolor, box: cell.box, pos, renderer, job,
      gradientangle: cell.gradientangle, style: cell.style });
  }
  if (cell.border > 0) {
    emitBorder({ box: cell.box, pos, border: cell.border, color: cell.color, sides: cell.sides, style: cell.style }, renderer, job);
  }
}

/** Scale the intrinsic image size per the IMG SCALE attribute. */
function scaleImage(d: { iw: number; ih: number; pw: number; ph: number; scale?: string }):
    { iw: number; ih: number } {
  const sx = d.pw / d.iw;
  const sy = d.ph / d.ih;
  const mode = (d.scale ?? '').toLowerCase();
  if (mode === 'width') return { iw: d.iw * sx, ih: d.ih };
  if (mode === 'height') return { iw: d.iw, ih: d.ih * sy };
  if (mode === 'both') return { iw: d.iw * sx, ih: d.ih * sy };
  if (mode === 'true' || mode === 'yes' || mode === '1') {
    const f = Math.min(sx, sy);
    return { iw: d.iw * f, ih: d.ih * f };
  }
  return { iw: d.iw, ih: d.ih };
}

/**
 * Emit a placed HTML IMG through the renderer's usershape hook.
 *
 * Ports gvrender_usershape: compute the target box from the placed
 * box, apply the SCALE modes against the intrinsic size, then center
 * the result (imagepos "mc" — hardcoded by emit_html_img).
 *
 * SCALE falls back to the object's imagescale attribute (C
 * env->imgscale, default "false") when the IMG has no SCALE attr.
 *
 * @see lib/common/htmltable.c:emit_html_img (line 597)
 * @see lib/gvc/gvrender.c:gvrender_usershape (line 670)
 */
export function emitHtmlImg(
  img: PlacedImage,
  pos: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  if (img.iw <= 0 && img.ih <= 0) return; // C: zero-size image → skip
  const b: Box = {
    ll: { x: img.box.ll.x + pos.x, y: img.box.ll.y + pos.y },
    ur: { x: img.box.ur.x + pos.x, y: img.box.ur.y + pos.y },
  };
  const pw = b.ur.x - b.ll.x;
  const ph = b.ur.y - b.ll.y;
  // @see lib/common/htmltable.c:emit_html_img (:615-618)
  const scale = img.scale !== undefined ? img.scale : htmlObjImgscale();
  const { iw, ih } = scaleImage({ iw: img.iw, ih: img.ih, pw, ph, scale });
  // imagepos "mc": center the (possibly scaled) image in the target box
  if (iw < pw) {
    b.ll.x += (pw - iw) / 2.0;
    b.ur.x -= (pw - iw) / 2.0;
  }
  if (ih < ph) {
    b.ll.y += (ph - ih) / 2.0;
    b.ur.y -= (ph - ih) / 2.0;
  }
  renderer.usershape?.(img.src, b, job);
}

/**
 * Emit one positioned HTML cell.
 *
 * Draw order mirrors C emit_html_cell:
 *   1. Open anchor   2. BGCOLOR fill   3. Border   4. Content   5. Close anchor
 *
 * @see lib/common/htmltable.c:emit_html_cell
 */
export function emitHtmlCell(
  cell: PlacedCell,
  pos: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const inAnchor = initHtmlAnchor(
    { href: cell.href, title: cell.title, target: cell.target, id: cell.id },
    renderer, job,
  );
  emitCellDecoration(cell, pos, renderer, job);
  if (cell.image !== undefined) {
    emitHtmlImg(cell.image, pos, renderer, job);
  } else {
    for (const line of cell.lines) emitHtmlLine(line, pos, renderer, job);
  }
  if (inAnchor) endHtmlAnchor(renderer, job);
}

// ---------------------------------------------------------------------------
// emitHtmlLabel — port of emit_html_tbl
// ---------------------------------------------------------------------------

/** Emit vrule/hrule rules for all ruled cells. */
function emitTableRules(
  placed: PlacedHtml,
  pos: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const color = placed.color ?? 'black';
  placed.cells.forEach((cell, i) => {
    if (cell.vruled === true || cell.hruled === true) {
      emitHtmlRules({
        cell, tbl: placed, pos, color,
        nextCell: placed.cells[i + 1], renderer, job,
      });
    }
  });
}

/**
 * Emit a fully positioned HTML table label.
 *
 * Draw order mirrors C emit_html_tbl:
 *   1. Open anchor   2. Table BGCOLOR   3. Cells   4. Rules   5. Border   6. Close anchor
 *
 * @see lib/common/htmltable.c:emit_html_tbl
 */
export function emitHtmlLabel(
  placed: PlacedHtml,
  pos: Point,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  const inAnchor = initHtmlAnchor(
    { href: placed.href, title: placed.title, target: placed.target, id: placed.id },
    renderer, job,
  );
  if (placed.bgcolor !== undefined) {
    emitBgFill({ bgcolor: placed.bgcolor, box: placed.box, pos, renderer, job,
      gradientangle: placed.gradientangle, style: placed.style });
  }
  for (const cell of placed.cells) emitHtmlCell(cell, pos, renderer, job);
  emitTableRules(placed, pos, renderer, job);
  if (placed.border > 0) {
    emitBorder({ box: placed.box, pos, border: placed.border, color: placed.color, sides: placed.sides, style: placed.style }, renderer, job);
  }
  if (inAnchor) endHtmlAnchor(renderer, job);
}
