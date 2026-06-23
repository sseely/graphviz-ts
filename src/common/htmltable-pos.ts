// SPDX-License-Identifier: EPL-2.0

/**
 * HTML label positioning: converts a sized HtmlLabel into a placed
 * structure with cell boxes and text baselines relative to the label
 * center, mirroring pos_html_tbl / pos_html_cell / emit_htextspans
 * geometry.
 *
 * Decoration metadata (bgcolor, color, sides, href, title, target, id,
 * style, vruled, hruled, col, row, colspan, rowspan) is carried directly
 * on PlacedCell/PlacedHtml — matching C's htmlcell_t/htmltbl_t layout.
 *
 * @see lib/common/htmltable.c:pos_html_tbl
 * @see lib/common/htmltable.c:pos_html_cell
 * @see lib/common/htmltable.c:emit_htextspans
 */

import type { Box } from '../model/geom.js';
import type { TextlabelT } from './types.js';
import type { TextMeasurer } from './textmeasure.js';
import type { HtmlCell, HtmlImage, HtmlLabel, HtmlTable, HtmlText, ImageSizer } from './htmltable-types.js';
import { layoutHtmlTable, cellPad, cellBorder, sizeHtmlLabel, parseHtmlLabel } from './htmltable.js';
import { makeLabel } from './make-label.js';
import type { PlacedLine, HtmlFontInfo } from './htmltable-pos-runs.js';
import {
  itemFontFlags, buildLineRuns, runsAreSimple, placeRunItems, placeTextRuns,
} from './htmltable-pos-runs.js';

// Re-export the text-run layout API (moved to htmltable-pos-runs.ts) so existing
// importers of './htmltable-pos.js' keep working unchanged.
export type { PlacedLine, HtmlFontInfo };
export { itemFontFlags, buildLineRuns, runsAreSimple, placeRunItems, placeTextRuns };

/**
 * A placed IMG element inside a cell.
 * Carries the sized box (relative to label center) and scale attribute.
 *
 * Geometry: emit_html_img centers the image in the cell box, applying scale.
 * @see lib/common/htmltable.c:emit_html_img (line 597)
 */
export interface PlacedImage {
  src: string;
  /** Scale attribute from <IMG SCALE="..."/>. */
  scale?: string;
  /** Intrinsic image width (from the ImageSizer), pre-scale. */
  iw: number;
  /** Intrinsic image height (from the ImageSizer), pre-scale. */
  ih: number;
  /** Target box for the image (alignment-adjusted cell content area). */
  box: Box;
}

/**
 * A positioned cell: border box plus its text runs and optional image.
 * Carries decoration metadata from htmlcell_t so the emitter can apply
 * bgcolor fill, per-side borders, anchors, and rules without a separate
 * decorated type.
 *
 * @see lib/common/htmltable.h:htmlcell_t
 */
export interface PlacedCell {
  box: Box;
  border: number;
  lines: PlacedLine[];
  /** Placed image, present when the cell contains an <IMG> element. */
  image?: PlacedImage;
  /** BGCOLOR attribute (solid color or "color1:color2" gradient spec). */
  bgcolor?: string;
  /** Pen (border) color override. */
  color?: string;
  /** SIDES bitmask (BORDER_LEFT|TOP|RIGHT|BOTTOM). */
  sides?: number;
  /** HREF for this cell's anchor. */
  href?: string;
  /** TOOLTIP for this cell's anchor. */
  title?: string;
  /** TARGET for this cell's anchor. */
  target?: string;
  /** ID attribute. */
  id?: string;
  /** Style string (dashed, dotted, rounded, …). */
  style?: string;
  /** Gradient angle (deg) for a gradient bgcolor. @see htmltable.h:htmlcell_t */
  gradientangle?: number;
  /** Column index (0-based). @see lib/common/htmltable.h:htmlcell_t.col */
  col: number;
  /** Row index (0-based). @see lib/common/htmltable.h:htmlcell_t.row */
  row: number;
  /** Column span (≥1). */
  colspan: number;
  /** Row span (≥1). */
  rowspan: number;
  /**
   * True when this cell has a vertical rule to its right.
   * Set by table vrule (COLUMNS="*") or explicit <VR/> in the row.
   * @see lib/common/htmltable.h:htmlcell_t.vruled
   */
  vruled?: boolean;
  /**
   * True when this cell has a horizontal rule below it.
   * Set by table hrule (ROWS="*") propagated via row_t.ruled.
   * @see lib/common/htmltable.h:htmlcell_t.hruled
   */
  hruled?: boolean;
}

/**
 * A fully positioned HTML label (table).
 * Carries table-level decoration metadata from htmltbl_t.
 *
 * @see lib/common/htmltable.h:htmltbl_t
 */
export interface PlacedHtml {
  box: Box;
  border: number;
  cells: PlacedCell[];
  /** BGCOLOR attribute for the table background. */
  bgcolor?: string;
  /** Pen color for the table border. */
  color?: string;
  /** SIDES bitmask. */
  sides?: number;
  /** Table HREF anchor. */
  href?: string;
  /** Table TOOLTIP. */
  title?: string;
  /** Table TARGET. */
  target?: string;
  /** Table ID. */
  id?: string;
  /** Table style string. */
  style?: string;
  /** Gradient angle (deg) for a gradient bgcolor. @see htmltable.h:htmltbl_t */
  gradientangle?: number;
  /**
   * Total number of columns (used for vruled boundary check).
   * @see lib/common/htmltable.h:htmltbl_t.column_count
   */
  columnCount: number;
  /**
   * Total number of rows (used for hruled boundary check).
   * @see lib/common/htmltable.h:htmltbl_t.row_count
   */
  rowCount: number;
  /**
   * Cell spacing (cellspacing attribute or default).
   * @see lib/common/htmltable.h:htmldata_t.space
   */
  spacing: number;
}

/** Shrink `box` to `dimen`, centered (default align/valign). @see pos_html_cell */
export function centerContentBox(box: Box, w: number, h: number): Box {
  const dx = Math.max(0, box.ur.x - box.ll.x - w) / 2;
  const dy = Math.max(0, box.ur.y - box.ll.y - h) / 2;
  return {
    ll: { x: box.ll.x + dx, y: box.ll.y + dy },
    ur: { x: box.ur.x - dx, y: box.ur.y - dy },
  };
}

/** Cell placement context: geometry + grid position, used by placeCell. */
export interface CellPlaceCtx {
  cell: HtmlCell;
  tbl: HtmlTable;
  box: Box;
  finfo: HtmlFontInfo;
  measurer: TextMeasurer;
  col: number;
  row: number;
  colspan: number;
  rowspan: number;
}

/** Place text runs for a cell, returning the inset content box. */
function placeCellRuns(
  ctx: CellPlaceCtx,
): PlacedLine[] {
  const { cell, tbl, box, finfo, measurer } = ctx;
  const border = cellBorder(cell, tbl);
  const inset = border + cellPad(cell, tbl);
  const cbox: Box = {
    ll: { x: box.ll.x + inset, y: box.ll.y + inset },
    ur: { x: box.ur.x - inset, y: box.ur.y - inset },
  };
  const texts = cell.content.filter((c): c is HtmlText => c.kind === 'text');
  const runs = buildLineRuns(texts, finfo, measurer);
  const w = Math.max(...runs.map(r => r.width), 0);
  const h = runs.reduce((a, r) => a + r.height, 0);
  return placeTextRuns(runs, centerContentBox(cbox, w, h), finfo, measurer);
}

/**
 * Build the placed image for a cell containing an <IMG> element.
 *
 * The target box is the inset content area, shrunk per the cell's
 * halign/valign exactly as pos_html_cell's image branch does
 * ("alignment trumps scaling"); the default alignment leaves the full
 * content box, and emission centers/scales the intrinsic image within
 * it (gvrender_usershape with imagepos "mc").
 *
 * @see lib/common/htmltable.c:pos_html_cell (image branch, :1456-1486)
 */
function placeCellImage(cell: HtmlCell, tbl: HtmlTable, box: Box): PlacedImage | undefined {
  const img = cell.content.find((c): c is HtmlImage => c.kind === 'image');
  if (img === undefined) return undefined;
  const inset = cellBorder(cell, tbl) + cellPad(cell, tbl);
  const iw = img.width ?? 0;
  const ih = img.height ?? 0;
  const cbox: Box = {
    ll: { x: box.ll.x + inset, y: box.ll.y + inset },
    ur: { x: box.ur.x - inset, y: box.ur.y - inset },
  };
  alignImageBox(cbox, cell, iw, ih);
  return { src: img.src, scale: img.scale, iw, ih, box: cbox };
}

/**
 * Shrink the content box per the cell's halign/valign so the intrinsic
 * image sits flush ("alignment trumps scaling"); default alignment is a
 * no-op. @see lib/common/htmltable.c:pos_html_cell (image branch)
 */
function alignImageBox(cbox: Box, cell: HtmlCell, iw: number, ih: number): void {
  const delx = cbox.ur.x - cbox.ll.x - iw;
  if (delx > 0) {
    if (cell.align === 'left') cbox.ur.x -= delx;
    else if (cell.align === 'right') cbox.ll.x += delx;
  }
  const dely = cbox.ur.y - cbox.ll.y - ih;
  if (dely > 0) {
    if (cell.valign === 'bottom') cbox.ur.y -= dely;
    else if (cell.valign === 'top') cbox.ll.y += dely;
  }
}

/** Position one cell's text inside its box, copying decoration metadata. @see pos_html_cell */
export function placeCell(ctx: CellPlaceCtx): PlacedCell {
  const { cell, tbl, box, col, row, colspan, rowspan } = ctx;
  const border = cellBorder(cell, tbl);
  // vruled is fully resolved at parse time (setCell for COLUMNS="*",
  // "cells VR cell" for explicit <VR>); copy it through.
  // @see lib/common/htmlparse.y:329,434-435
  const vruled = cell.vruled;
  const image = placeCellImage(cell, tbl, box);
  return {
    box, border,
    lines: placeCellRuns(ctx),
    image,
    bgcolor: cell.bgcolor,
    color: cell.color,
    sides: cell.sides,
    href: cell.href,
    title: cell.title,
    target: cell.target,
    id: cell.id,
    style: cell.style,
    gradientangle: cell.gradientangle,
    col, row, colspan, rowspan,
    vruled,
    // hruled set post-construction in posHtmlTable from hrule propagation
  };
}

/** Compute column X-offsets from layout widths. */
function buildColX(pos: Box, border: number, spacing: number, widths: number[]): number[] {
  const colX: number[] = [];
  let x = pos.ll.x + border + spacing;
  for (let i = 0; i < widths.length; i++) { colX[i] = x; x += widths[i] + spacing; }
  return colX;
}

/** Compute row Y-offsets from layout heights. */
function buildRowY(pos: Box, border: number, spacing: number, heights: number[]): number[] {
  const rowY: number[] = [];
  let y = pos.ur.y - border - spacing;
  for (let i = 0; i < heights.length; i++) { rowY[i] = y; y -= heights[i] + spacing; }
  return rowY;
}

/** Build table-level decoration fields from htmltbl_t. */
function tblDecoration(tbl: HtmlTable): Partial<PlacedHtml> {
  return {
    bgcolor: tbl.bgcolor,
    color: tbl.color,
    sides: tbl.sides,
    href: tbl.href,
    title: tbl.title,
    target: tbl.target,
    id: tbl.id,
    style: tbl.style,
    gradientangle: tbl.gradientangle,
  };
}

/** Context for placeCells, grouping grid and font state. */
interface PlaceCellsCtx {
  tbl: HtmlTable;
  entries: ReturnType<typeof layoutHtmlTable>['entries'];
  colX: number[];
  rowY: number[];
  spacing: number;
  nrows: number;
  finfo: HtmlFontInfo;
  measurer: TextMeasurer;
}

/**
 * Mark hruled cells: C processTbl sets bit r+1 for each row with
 * ruled=true, then any cell whose bottom edge (row + rowspan) lands on
 * a set bit becomes hruled. The bottom-boundary draw guard lives at
 * emit time (htmltable.c:488), as in C.
 * @see lib/common/htmltable.c:processTbl (bitarray, :1199-1224)
 */
function ruledBoundaries(tbl: HtmlTable): Set<number> {
  const bits = new Set<number>();
  tbl.rows.forEach((row, r) => { if (row.ruled === true) bits.add(r + 1); });
  return bits;
}

/** Place all cells for a table, marking ruled cells per C processTbl. */
function placeCells(ctx: PlaceCellsCtx): PlacedCell[] {
  const { tbl, entries, colX, rowY, spacing, finfo, measurer } = ctx;
  const boundaries = ruledBoundaries(tbl);
  return entries.map((e) => {
    const box: Box = {
      ll: { x: colX[e.col], y: rowY[e.row + e.rowspan] + spacing },
      ur: { x: colX[e.col + e.colspan] - spacing, y: rowY[e.row] },
    };
    const placed = placeCell({
      cell: e.cell, tbl, box, finfo, measurer,
      col: e.col, row: e.row, colspan: e.colspan, rowspan: e.rowspan,
    });
    if (boundaries.has(e.row + e.rowspan)) placed.hruled = true;
    return placed;
  });
}

/** Position the table and all cells. @see pos_html_tbl */
export function posHtmlTable(
  tbl: HtmlTable,
  finfo: HtmlFontInfo,
  measurer: TextMeasurer,
): PlacedHtml {
  const dim = tbl.dimen ?? { w: 0, h: 0 };
  const pos: Box = {
    ll: { x: -dim.w / 2, y: -dim.h / 2 },
    ur: { x: dim.w / 2, y: dim.h / 2 },
  };
  const { entries, widths, heights, spacing, border } = layoutHtmlTable(tbl, measurer, {
    fontsize: finfo.fontsize, fontname: finfo.fontname,
  });
  const ncols = widths.length > 0 ? Math.max(...entries.map(e => e.col + e.colspan)) : 0;
  const nrows = heights.length > 0 ? Math.max(...entries.map(e => e.row + e.rowspan)) : 0;
  const colX = buildColX(pos, border, spacing, widths);
  const rowY = buildRowY(pos, border, spacing, heights);
  const cells = placeCells({ tbl, entries, colX, rowY, spacing, nrows, finfo, measurer });
  return { box: pos, border, cells, spacing, columnCount: ncols, rowCount: nrows, ...tblDecoration(tbl) };
}

/** Build a single-cell PlacedHtml for a plain text label. */
function posTextLabel(label: Extract<HtmlLabel, { kind: 'text' }>, finfo: HtmlFontInfo, measurer: TextMeasurer): PlacedHtml {
  const dim = label.dimen ?? { w: 0, h: 0 };
  const box: Box = {
    ll: { x: -dim.w / 2, y: -dim.h / 2 },
    ur: { x: dim.w / 2, y: dim.h / 2 },
  };
  const runs = buildLineRuns(label.texts, finfo, measurer);
  return {
    box, border: 0, columnCount: 1, rowCount: 1, spacing: 0,
    cells: [{
      box, border: 0, col: 0, row: 0, colspan: 1, rowspan: 1,
      lines: placeTextRuns(runs, box, finfo, measurer),
    }],
  };
}

/** Position a sized HtmlLabel relative to its center. */
export function posHtmlLabel(
  label: HtmlLabel,
  finfo: HtmlFontInfo,
  measurer: TextMeasurer,
): PlacedHtml {
  if (label.kind === 'table') return posHtmlTable(label.table, finfo, measurer);
  return posTextLabel(label, finfo, measurer);
}

/**
 * Build a TextlabelT for an HTML label string: parse, size, position.
 * Falls back to a plain-text label on parse failure (C reverts to the
 * object name; we keep the markup text).
 *
 * The optional `imageSizer` on `finfo` resolves `<IMG SRC="..."/>` dims.
 * Absent → C missing-image behavior (zero size + warning).
 *
 * @see lib/common/htmltable.c:make_html_label
 */
export function makeHtmlLabel(
  content: string,
  finfo: HtmlFontInfo & { imageSizer?: ImageSizer },
  measurer: TextMeasurer,
): TextlabelT {
  const { fontname, fontsize, fontcolor, imageSizer } = finfo;
  let lbl: HtmlLabel;
  try {
    lbl = parseHtmlLabel(content);
  } catch {
    return makeLabel(content, fontname, fontsize, fontcolor, measurer);
  }
  sizeHtmlLabel(lbl, measurer, {
    fontsize, fontname, imageSizer,
  });
  const placed = posHtmlLabel(lbl, { fontname, fontsize, fontcolor }, measurer);
  const dim = lbl.dimen ?? { w: 0, h: 0 };
  // C replaces table-label text: "this may be used for the title and
  // alt fields in image maps" — anchors inherit it as default tooltip.
  // @see lib/common/htmltable.c:make_html_label (line 1935)
  const text = lbl.kind === 'table' ? '<TABLE>' : content;
  return htmlTextLabel(text, { fontname, fontsize, fontcolor }, placed, dim);
}

/** Build the TextlabelT wrapper around a positioned HTML label. */
function htmlTextLabel(
  text: string,
  finfo: HtmlFontInfo,
  placed: PlacedHtml,
  dim: { w: number; h: number },
): TextlabelT {
  return {
    text,
    fontname: finfo.fontname, fontcolor: finfo.fontcolor, charset: 0,
    fontsize: finfo.fontsize,
    dimen: { x: dim.w, y: dim.h },
    space: { x: dim.w, y: dim.h },
    pos: { x: 0, y: 0 },
    u: { kind: 'html', html: placed },
    valign: 'c'.charCodeAt(0),
    set: false,
    html: true,
  };
}
