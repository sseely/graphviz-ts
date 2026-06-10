// SPDX-License-Identifier: EPL-2.0

/**
 * HTML label positioning: converts a sized HtmlLabel into a placed
 * structure with cell boxes and text baselines relative to the label
 * center, mirroring pos_html_tbl / pos_html_cell / emit_htextspans
 * geometry.
 *
 * @see lib/common/htmltable.c:pos_html_tbl
 * @see lib/common/htmltable.c:pos_html_cell
 * @see lib/common/htmltable.c:emit_htextspans
 */

import type { Box } from '../model/geom.js';
import type { TextlabelT } from './types.js';
import type { TextMeasurer } from './textmeasure.js';
import type { HtmlCell, HtmlLabel, HtmlTable, HtmlText, HtmlTextItem } from './htmltable-types.js';
import { layoutHtmlTable, cellPad, cellBorder, sizeHtmlLabel, parseHtmlLabel } from './htmltable.js';
import { freetypeAscent } from './textmeasure.js';
import { makeLabel } from './make-label.js';

/** One emitted run of text. Coordinates relative to the label center. */
export interface PlacedLine {
  text: string;
  x: number;        // left edge of the run
  baseline: number; // text baseline y
  width: number;
  fontSize: number;
  fontName: string | null;
  fontColor: string | null;
}

/** A positioned cell: border box plus its text runs. */
export interface PlacedCell {
  box: Box;
  border: number;
  lines: PlacedLine[];
}

/** A fully positioned HTML label. */
export interface PlacedHtml {
  box: Box;
  border: number;
  cells: PlacedCell[];
}

/** Font info inherited from the enclosing label. */
export interface HtmlFontInfo {
  fontname: string;
  fontsize: number;
  fontcolor: string;
}

interface LineRun { items: HtmlTextItem[]; width: number; fontSize: number; height: number; }

/** Split text content into lines at <BR/> items. @see size_html_txt */
export function buildLineRuns(
  texts: HtmlText[],
  finfo: HtmlFontInfo,
  measurer: TextMeasurer,
): LineRun[] {
  const runs: LineRun[] = [];
  let cur: LineRun = { items: [], width: 0, fontSize: 0, height: 0 };
  const flush = (): void => { runs.push(cur); cur = { items: [], width: 0, fontSize: 0, height: 0 }; };
  for (const txt of texts) {
    for (const item of txt.items) {
      if (item.br) { flush(); continue; }
      if (item.text === undefined) continue;
      const fs = item.fontSize !== undefined ? item.fontSize : finfo.fontsize;
      const face = item.fontFace !== undefined ? item.fontFace : finfo.fontname;
      const sz = measurer.measure(item.text, face, fs);
      cur.items.push(item);
      cur.width += sz.w;
      cur.fontSize = Math.max(cur.fontSize, fs);
      cur.height = Math.max(cur.height, sz.h);
    }
    flush();
  }
  return runs.filter(r => r.items.length > 0);
}

/** Place one run's items left-to-right at a fixed baseline. */
export function placeRunItems(
  run: LineRun,
  startX: number,
  baseline: number,
  finfo: HtmlFontInfo,
  measurer: TextMeasurer,
): PlacedLine[] {
  const lines: PlacedLine[] = [];
  let x = startX;
  for (const item of run.items) {
    const fs = item.fontSize !== undefined ? item.fontSize : finfo.fontsize;
    const face = item.fontFace !== undefined ? item.fontFace : finfo.fontname;
    const sz = measurer.measure(item.text!, face, fs);
    lines.push({
      text: item.text!, x, baseline, width: sz.w, fontSize: fs,
      fontName: face, fontColor: item.fontColor ?? finfo.fontcolor,
    });
    x += sz.w;
  }
  return lines;
}

/** Place text runs centered in `box`. @see emit_htextspans */
export function placeTextRuns(
  runs: LineRun[],
  box: Box,
  finfo: HtmlFontInfo,
  measurer: TextMeasurer,
): PlacedLine[] {
  const centerX = (box.ll.x + box.ur.x) / 2;
  const lines: PlacedLine[] = [];
  let baseline = box.ur.y;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    // First baseline sits one ascent below the block top; later lines
    // advance by the measured line height. @see size_html_txt (lfsize)
    baseline -= i === 0 ? freetypeAscent(run.fontSize) : run.height;
    lines.push(...placeRunItems(run, centerX - run.width / 2, baseline, finfo, measurer));
  }
  return lines;
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

/** Position one cell's text inside its box. @see pos_html_cell */
export function placeCell(
  cell: HtmlCell,
  tbl: HtmlTable,
  box: Box,
  finfo: HtmlFontInfo,
  measurer: TextMeasurer,
): PlacedCell {
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
  const tbox = centerContentBox(cbox, w, h);
  return { box, border, lines: placeTextRuns(runs, tbox, finfo, measurer) };
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
  const { entries, widths, heights, spacing, border } = layoutHtmlTable(tbl, measurer);
  const colX: number[] = [];
  let x = pos.ll.x + border + spacing;
  for (let i = 0; i <= widths.length - 1; i++) { colX[i] = x; x += widths[i] + spacing; }
  const rowY: number[] = [];
  let y = pos.ur.y - border - spacing;
  for (let i = 0; i <= heights.length - 1; i++) { rowY[i] = y; y -= heights[i] + spacing; }
  const cells = entries.map((e) => {
    const box: Box = {
      ll: { x: colX[e.col], y: rowY[e.row + e.rowspan] + spacing },
      ur: { x: colX[e.col + e.colspan] - spacing, y: rowY[e.row] },
    };
    return placeCell(e.cell, tbl, box, finfo, measurer);
  });
  return { box: pos, border, cells };
}

/** Position a sized HtmlLabel relative to its center. */
export function posHtmlLabel(
  label: HtmlLabel,
  finfo: HtmlFontInfo,
  measurer: TextMeasurer,
): PlacedHtml {
  if (label.kind === 'table') return posHtmlTable(label.table, finfo, measurer);
  const dim = label.dimen ?? { w: 0, h: 0 };
  const box: Box = {
    ll: { x: -dim.w / 2, y: -dim.h / 2 },
    ur: { x: dim.w / 2, y: dim.h / 2 },
  };
  const runs = buildLineRuns(label.texts, finfo, measurer);
  return {
    box, border: 0,
    cells: [{ box, border: 0, lines: placeTextRuns(runs, box, finfo, measurer) }],
  };
}

/**
 * Build a TextlabelT for an HTML label string: parse, size, position.
 * Falls back to a plain-text label on parse failure (C reverts to the
 * object name; we keep the markup text).
 * @see lib/common/htmltable.c:make_html_label
 */
export function makeHtmlLabel(
  content: string,
  fontname: string,
  fontsize: number,
  fontcolor: string,
  measurer: TextMeasurer,
): TextlabelT {
  let lbl: HtmlLabel;
  try {
    lbl = parseHtmlLabel(content);
  } catch {
    return makeLabel(content, fontname, fontsize, fontcolor, measurer);
  }
  sizeHtmlLabel(lbl, measurer);
  const placed = posHtmlLabel(lbl, { fontname, fontsize, fontcolor }, measurer);
  const dim = lbl.dimen ?? { w: 0, h: 0 };
  return {
    text: content,
    fontname, fontcolor, charset: 0, fontsize,
    dimen: { x: dim.w, y: dim.h },
    space: { x: dim.w, y: dim.h },
    pos: { x: 0, y: 0 },
    u: { kind: 'html', html: placed },
    valign: 'c'.charCodeAt(0),
    set: false,
    html: true,
  };
}
