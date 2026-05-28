// SPDX-License-Identifier: EPL-2.0
/**
 * Public API: HTML-like label parsing and layout sizing.
 * Sizing algorithm ported from lib/common/htmltable.c.
 *
 * @see lib/common/htmltable.c:size_html_tbl
 * @see lib/common/htmltable.c:set_cell_widths
 * @see lib/common/htmltable.c:set_cell_heights
 */

export { HtmlParseError } from './htmltable-types.js';
export type {
  HtmlAlign, HtmlVAlign,
  HtmlHR, HtmlVR, HtmlImage, HtmlTextItem, HtmlText,
  HtmlCellContent, HtmlCell, HtmlRow, HtmlTable, HtmlLabel,
} from './htmltable-types.js';
export { parseHtmlLabel } from './htmltable-parse.js';
export type { TextMeasurer } from './textmeasure.js';

import type {
  HtmlCell, HtmlCellContent, HtmlLabel, HtmlTable, HtmlText,
} from './htmltable-types.js';
import type { TextMeasurer } from './textmeasure.js';

const DEFAULT_BORDER = 1;
const DEFAULT_CELLPADDING = 2;
const DEFAULT_CELLSPACING = 2;
const DEFAULT_FONTSIZE = 14;

interface CellEntry {
  cell: HtmlCell; row: number; col: number;
  colspan: number; rowspan: number;
  w: number; h: number;
}

interface TableDimArgs {
  widths: number[]; heights: number[];
  ncols: number; nrows: number;
  spacing: number; border: number;
}

/** @see lib/common/htmltable.c:findCol */
const findCol = (
  used: Set<string>,
  row: number,
  startCol: number,
  colspan: number,
  rowspan: number,
): number => {
  let col = startCol;
  for (;;) {
    let conflict = false;
    for (let c = col; c < col + colspan && !conflict; c++) {
      for (let r = row; r < row + rowspan && !conflict; r++) {
        if (used.has(`${c},${r}`)) { conflict = true; col = c + 1; }
      }
    }
    if (!conflict) break;
  }
  for (let c = col; c < col + colspan; c++)
    for (let r = row; r < row + rowspan; r++)
      used.add(`${c},${r}`);
  return col;
};

const sizeOneItem = (
  item: HtmlText['items'][number],
  st: { lineW: number; lineH: number; maxW: number; totalH: number },
  measurer: TextMeasurer,
): void => {
  if (item.br) {
    st.maxW = Math.max(st.maxW, st.lineW);
    st.totalH += st.lineH > 0 ? st.lineH : DEFAULT_FONTSIZE;
    st.lineW = 0; st.lineH = 0;
    return;
  }
  if (!item.text) return;
  const fs = item.fontSize !== undefined ? item.fontSize : DEFAULT_FONTSIZE;
  const face = item.fontFace !== undefined ? item.fontFace : '';
  const sz = measurer.measure(item.text, face, fs);
  st.lineW += sz.w;
  if (sz.h > st.lineH) st.lineH = sz.h;
};

/** @see lib/common/htmltable.c:size_html_txt */
const sizeTextContent = (
  texts: HtmlText[],
  measurer: TextMeasurer,
): { w: number; h: number } => {
  const st = { lineW: 0, lineH: 0, maxW: 0, totalH: 0 };
  for (const txt of texts) {
    st.lineW = 0; st.lineH = 0;
    for (const item of txt.items) sizeOneItem(item, st, measurer);
    st.maxW = Math.max(st.maxW, st.lineW);
    st.totalH += st.lineH > 0 ? st.lineH : DEFAULT_FONTSIZE;
  }
  return { w: st.maxW, h: st.totalH };
};

const sizeContentItem = (
  item: HtmlCellContent,
  measurer: TextMeasurer,
): { w: number; h: number } => {
  if (item.kind === 'text') return sizeTextContent([item], measurer);
  if (item.kind === 'table') {
    sizeTableInner(item, measurer);
    return item.dimen !== undefined ? item.dimen : { w: 0, h: 0 };
  }
  return { w: 0, h: 0 };
};

const cellPad = (cell: HtmlCell, tbl: HtmlTable): number =>
  cell.cellpadding !== undefined ? cell.cellpadding
    : (tbl.cellpadding !== undefined ? tbl.cellpadding : DEFAULT_CELLPADDING);

const cellBorder = (cell: HtmlCell, tbl: HtmlTable): number => {
  if (cell.border !== undefined) return cell.border;
  const cb = tbl.cellborder;
  return cb !== undefined && cb >= 0 ? cb : DEFAULT_BORDER;
};

/** @see lib/common/htmltable.c:size_html_cell */
const getCellSize = (
  cell: HtmlCell,
  tbl: HtmlTable,
  measurer: TextMeasurer,
): { w: number; h: number } => {
  const margin = 2 * (cellPad(cell, tbl) + cellBorder(cell, tbl));
  let cw = 0, ch = 0;
  for (const item of cell.content) {
    const s = sizeContentItem(item, measurer);
    cw = Math.max(cw, s.w); ch += s.h;
  }
  if (cell.fixedsize && cell.width !== undefined && cell.height !== undefined)
    return { w: 0, h: 0 };
  const bw = cell.width !== undefined ? cell.width : 0;
  const bh = cell.height !== undefined ? cell.height : 0;
  return { w: Math.max(cw + margin, bw), h: Math.max(ch + margin, bh) };
};

/** @see lib/common/htmltable.c:processTbl */
const buildLayouts = (
  tbl: HtmlTable,
  measurer: TextMeasurer,
): CellEntry[] => {
  const entries: CellEntry[] = [];
  const used = new Set<string>();
  let rowIdx = 0;
  for (const row of tbl.rows) {
    let col = 0;
    for (const c of row.cells) {
      if (c.kind !== 'cell') { continue; }
      const colspan = c.colspan !== undefined ? c.colspan : 1;
      const rowspan = c.rowspan !== undefined ? c.rowspan : 1;
      const { w, h } = getCellSize(c, tbl, measurer);
      col = findCol(used, rowIdx, col, colspan, rowspan);
      entries.push({ cell: c, row: rowIdx, col, colspan, rowspan, w, h });
      col += colspan;
    }
    rowIdx++;
  }
  return entries;
};

/** @see lib/common/htmltable.c:set_cell_widths */
const setColWidths = (
  entries: CellEntry[],
  ncols: number,
  spacing: number,
): number[] => {
  const widths = new Array<number>(ncols + 1).fill(0);
  for (const e of entries)
    if (e.colspan === 1) widths[e.col] = Math.max(widths[e.col], e.w);
  for (const e of entries) {
    if (e.colspan === 1) continue;
    const spanW = widths.slice(e.col, e.col + e.colspan).reduce((a, v) => a + v, 0);
    const need = e.w - spanW - (e.colspan - 1) * spacing;
    if (need > 0) {
      const add = need / e.colspan;
      for (let j = 0; j < e.colspan; j++) widths[e.col + j] += add;
    }
  }
  for (const e of entries) {
    const spanW = widths.slice(e.col, e.col + e.colspan).reduce((a, v) => a + v, 0);
    e.w = Math.max(e.w, spanW + (e.colspan - 1) * spacing);
  }
  return widths;
};

/** @see lib/common/htmltable.c:set_cell_heights */
const setRowHeights = (
  entries: CellEntry[],
  nrows: number,
  spacing: number,
): number[] => {
  const heights = new Array<number>(nrows + 1).fill(0);
  for (const e of entries)
    if (e.rowspan === 1) heights[e.row] = Math.max(heights[e.row], e.h);
  for (const e of entries) {
    if (e.rowspan === 1) continue;
    const spanH = heights.slice(e.row, e.row + e.rowspan).reduce((a, v) => a + v, 0);
    const need = e.h - spanH - (e.rowspan - 1) * spacing;
    if (need > 0) {
      const add = need / e.rowspan;
      for (let j = 0; j < e.rowspan; j++) heights[e.row + j] += add;
    }
  }
  for (const e of entries) {
    const spanH = heights.slice(e.row, e.row + e.rowspan).reduce((a, v) => a + v, 0);
    e.h = Math.max(e.h, spanH + (e.rowspan - 1) * spacing);
  }
  return heights;
};

const getSpacing = (tbl: HtmlTable): number =>
  tbl.cellspacing !== undefined ? tbl.cellspacing : DEFAULT_CELLSPACING;

const getBorder = (tbl: HtmlTable): number =>
  tbl.border !== undefined ? tbl.border : DEFAULT_BORDER;

const isTblFixed = (tbl: HtmlTable): boolean =>
  tbl.fixedsize === true && tbl.width !== undefined && tbl.height !== undefined;

const sumTableDims = (a: TableDimArgs): { wd: number; ht: number } => {
  let wd = (a.ncols + 1) * a.spacing + 2 * a.border;
  let ht = (a.nrows + 1) * a.spacing + 2 * a.border;
  for (let i = 0; i < a.ncols; i++) wd += a.widths[i];
  for (let i = 0; i < a.nrows; i++) ht += a.heights[i];
  return { wd, ht };
};

/** @see lib/common/htmltable.c:size_html_tbl */
const sizeTableInner = (
  tbl: HtmlTable,
  measurer: TextMeasurer,
): void => {
  const spacing = getSpacing(tbl);
  const border = getBorder(tbl);
  const entries = buildLayouts(tbl, measurer);
  if (entries.length === 0) { tbl.dimen = { w: 0, h: 0 }; return; }
  const ncols = Math.max(...entries.map(e => e.col + e.colspan));
  const nrows = Math.max(...entries.map(e => e.row + e.rowspan));
  const widths = setColWidths(entries, ncols, spacing);
  const heights = setRowHeights(entries, nrows, spacing);
  for (const e of entries) e.cell.dimen = { w: e.w, h: e.h };
  const { wd, ht } = sumTableDims({ widths, heights, ncols, nrows, spacing, border });
  const baseWd = tbl.width !== undefined ? tbl.width : 0;
  const baseHt = tbl.height !== undefined ? tbl.height : 0;
  const fw = isTblFixed(tbl) ? 0 : Math.max(wd, baseWd);
  const fh = isTblFixed(tbl) ? 0 : Math.max(ht, baseHt);
  tbl.dimen = { w: fw, h: fh };
};

/**
 * Compute and write `dimen` onto all cells and the label.
 * @see lib/common/htmltable.c:make_html_label
 */
export const sizeHtmlLabel = (
  label: HtmlLabel,
  measurer: TextMeasurer,
): void => {
  if (label.kind === 'table') {
    sizeTableInner(label.table, measurer);
    label.dimen = label.table.dimen;
  } else {
    label.dimen = sizeTextContent(label.texts, measurer);
  }
};
