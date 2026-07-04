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
  HtmlHR, HtmlImage, HtmlTextItem, HtmlText,
  HtmlCellContent, HtmlCell, HtmlRow, HtmlTable, HtmlLabel,
  ImageSizer,
} from './htmltable-types.js';
export { parseHtmlLabel } from './htmltable-parse.js';
export type { TextMeasurer } from './textmeasure.js';

import type {
  HtmlCell, HtmlCellContent, HtmlImage, HtmlLabel, HtmlTable, HtmlText,
  HtmlTextItem,
} from './htmltable-types.js';
import type { ImageSizer } from './htmltable-types.js';
import { findImageSize } from '../gvc/usershape.js';
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

/**
 * Sizing environment: label-level font defaults + image resolution.
 * Ports htmlenv_t.finfo — C threads lp->fontname/fontsize through
 * make_html_label's env into size_html_txt.
 * @see lib/common/htmltable.c:make_html_label (env.finfo)
 */
export interface HtmlSizeEnv {
  fontsize: number;
  fontname: string;
  imageSizer?: ImageSizer;
}

const DEFAULT_SIZE_ENV: HtmlSizeEnv = { fontsize: DEFAULT_FONTSIZE, fontname: '' };

/** One measured text line (a C "span"). @see size_html_txt */
interface SizedLine {
  items: HtmlTextItem[];
  width: number;
  /** Max metric line height over items (C mxysize). */
  mxysize: number;
  /** Max raw font size over items (C mxfsize). */
  mxfsize: number;
}

const itemFont = (item: HtmlTextItem, env: HtmlSizeEnv): { fs: number; face: string } => ({
  fs: item.fontSize !== undefined ? item.fontSize : env.fontsize,
  face: item.fontFace !== undefined ? item.fontFace : env.fontname,
});

const measureItem = (
  item: HtmlTextItem,
  measurer: TextMeasurer,
  env: HtmlSizeEnv,
): { w: number; h: number } => {
  const { fs, face } = itemFont(item, env);
  // Variant widths per run flags. @see lib/common/htmltable.c:size_html_txt
  const flags = (item.bold === true || item.italic === true)
    ? { bold: item.bold === true, italic: item.italic === true }
    : undefined;
  return measurer.measure(item.text ?? '', face, fs, flags);
};

/** Split items into measured lines at <BR/>. @see size_html_txt */
const splitSizedLines = (
  texts: HtmlText[],
  measurer: TextMeasurer,
  env: HtmlSizeEnv,
): SizedLine[] => {
  const lines: SizedLine[] = [];
  let cur: SizedLine = { items: [], width: 0, mxysize: 0, mxfsize: 0 };
  const flush = (): void => {
    lines.push(cur);
    cur = { items: [], width: 0, mxysize: 0, mxfsize: 0 };
  };
  for (const txt of texts) {
    for (const item of txt.items) {
      if (item.br) { flush(); continue; }
      if (item.text === undefined) continue;
      const sz = measureItem(item, measurer, env);
      cur.items.push(item);
      cur.width += sz.w;
      cur.mxysize = Math.max(cur.mxysize, sz.h);
      cur.mxfsize = Math.max(cur.mxfsize, itemFont(item, env).fs);
    }
    flush();
  }
  return lines;
};

/** Does an item carry any font flag (C textfont_t.flags)? */
const itemHasFlags = (i: HtmlTextItem): boolean =>
  i.bold === true || i.italic === true || i.underline === true ||
  i.strikethrough === true || i.overline === true ||
  i.subscript === true || i.superscript === true;

/**
 * C's "simple" test: one item per line, no font flags, uniform
 * resolved face and size across all lines.
 * @see lib/common/htmltable.c:size_html_txt (lines 946-986)
 */
export const htmlTextIsSimple = (texts: HtmlText[], env: HtmlSizeEnv): boolean => {
  let prevFs = -1;
  let prevFace: string | null = null;
  let count = 0;
  for (const txt of texts) {
    for (const item of txt.items) {
      if (item.br) { count = 0; continue; }
      if (item.text === undefined) continue;
      if (++count > 1 || itemHasFlags(item)) return false;
      const { fs, face } = itemFont(item, env);
      if (prevFs < 0) prevFs = fs;
      else if (fs !== prevFs) return false;
      if (prevFace === null) prevFace = face;
      else if (face !== prevFace) return false;
    }
  }
  return true;
};

/**
 * Size a text block. C: per line lsize = mxysize when simple, else the
 * raw max font size (mxfsize); a single-line block always uses mxysize.
 * @see lib/common/htmltable.c:size_html_txt (lines 1045-1075)
 */
const sizeTextContent = (
  texts: HtmlText[],
  measurer: TextMeasurer,
  env: HtmlSizeEnv = DEFAULT_SIZE_ENV,
): { w: number; h: number } => {
  const lines = splitSizedLines(texts, measurer, env);
  const simple = htmlTextIsSimple(texts, env);
  let w = 0;
  let h = 0;
  for (const ln of lines) {
    w = Math.max(w, ln.width);
    const lsize = simple ? ln.mxysize : ln.mxfsize;
    h += ln.items.length > 0 ? lsize : DEFAULT_FONTSIZE;
  }
  if (lines.length === 1) h = lines[0]!.items.length > 0 ? lines[0]!.mxysize : DEFAULT_FONTSIZE;
  return { w, h };
};

/**
 * Size one IMG element, writing dimensions onto HtmlImage.width/height.
 *
 * C behavior (htmltable.c:1080-1097):
 *   - Call gvusershape_size(g, img->src) — returns (-1,-1) on failure.
 *   - On failure: emit agerrorf warning, set box to zero.
 *   - On success: store box.UR = size, set GD_has_images=true.
 *
 * AD3 (locked): absent / null ImageSizer ≡ C-with-missing-file.
 * Warning text matches C's agerrorf format string exactly.
 *
 * @see lib/common/htmltable.c:size_html_img (line 1080)
 */
const sizeHtmlImg = (img: HtmlImage, imageSizer?: ImageSizer): void => {
  // C sizes each image once (processTbl); the port's size and pos passes
  // share layoutHtmlTable, so guard against re-sizing (and re-warning).
  if (img.width !== undefined && img.height !== undefined) return;
  const sz = imageSizer !== undefined ? imageSizer(img.src) : findImageSize(img.src);
  if (sz !== null) {
    img.width = sz.w;
    img.height = sz.h;
    return;
  }
  // Missing-image: zero size + warning.
  // C: agerrorf("No or improper image file=\"%s\"\n", img->src) — agerr
  // prefixes "Error: " on stderr.
  console.error(`Error: No or improper image file="${img.src}"`);
  img.width = 0;
  img.height = 0;
};

const sizeContentItem = (
  item: HtmlCellContent,
  measurer: TextMeasurer,
  env: HtmlSizeEnv,
): { w: number; h: number } => {
  if (item.kind === 'text') return sizeTextContent([item], measurer, env);
  if (item.kind === 'table') {
    sizeTableInner(item, measurer, env);
    return item.dimen !== undefined ? item.dimen : { w: 0, h: 0 };
  }
  if (item.kind === 'image') {
    sizeHtmlImg(item, env.imageSizer);
    return { w: item.width ?? 0, h: item.height ?? 0 };
  }
  return { w: 0, h: 0 };
};

export const cellPad = (cell: HtmlCell, tbl: HtmlTable): number =>
  cell.cellpadding !== undefined ? cell.cellpadding
    : (tbl.cellpadding !== undefined ? tbl.cellpadding : DEFAULT_CELLPADDING);

/**
 * A cell with no BORDER of its own defaults, in order: the table's CELLBORDER
 * (if >= 0), else the table's own BORDER value (when BORDER was set — including
 * BORDER="0"), else DEFAULT_BORDER. The middle case is why a cell in a
 * `<TABLE BORDER="0">` with no CELLBORDER draws no border, not a 1px one.
 * @see lib/common/htmltable.c:1115 size_html_tbl (cp->data.border default)
 */
export const cellBorder = (cell: HtmlCell, tbl: HtmlTable): number => {
  if (cell.border !== undefined) return cell.border;
  const cb = tbl.cellborder;
  if (cb !== undefined && cb >= 0) return cb;
  if (tbl.border !== undefined) return tbl.border;
  return DEFAULT_BORDER;
};

/** @see lib/common/htmltable.c:size_html_cell */
const getCellSize = (
  cell: HtmlCell,
  tbl: HtmlTable,
  measurer: TextMeasurer,
  env: HtmlSizeEnv,
): { w: number; h: number } => {
  const margin = 2 * (cellPad(cell, tbl) + cellBorder(cell, tbl));
  let cw = 0, ch = 0;
  for (const item of cell.content) {
    const s = sizeContentItem(item, measurer, env);
    cw = Math.max(cw, s.w); ch += s.h;
  }
  // C: sz = content + margin; FIXED_FLAG with both width and height set zeroes
  // sz (content size is ignored), then the box clamps UP to width/height via
  // MAX below — so a fixed cell ends up exactly width x height, NOT 0 x 0.
  // (C also warns "cell size too small for content" / "unspecified"; non-visual.)
  // @see lib/common/htmltable.c:size_html_cell (FIXED_FLAG branch + box.UR MAX)
  let szx = cw + margin;
  let szy = ch + margin;
  if (cell.fixedsize && cell.width && cell.height) {
    szx = 0; szy = 0;
  }
  const bw = cell.width !== undefined ? cell.width : 0;
  const bh = cell.height !== undefined ? cell.height : 0;
  return { w: Math.max(szx, bw), h: Math.max(szy, bh) };
};

/** @see lib/common/htmltable.c:processTbl */
const buildLayouts = (
  tbl: HtmlTable,
  measurer: TextMeasurer,
  env: HtmlSizeEnv,
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
      const { w, h } = getCellSize(c, tbl, measurer, env);
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

/** Full table layout: per-cell sizes plus column/row dimensions. */
export interface HtmlTableLayout {
  entries: {
    cell: HtmlCell; row: number; col: number;
    colspan: number; rowspan: number; w: number; h: number;
  }[];
  widths: number[];
  heights: number[];
  spacing: number;
  border: number;
}

/**
 * Lay out a table: per-cell sizes and column/row dimension arrays.
 * Shared by the size pass and the position pass.
 * @see lib/common/htmltable.c:size_html_tbl
 */
export const layoutHtmlTable = (
  tbl: HtmlTable,
  measurer: TextMeasurer,
  env: HtmlSizeEnv = DEFAULT_SIZE_ENV,
): HtmlTableLayout => {
  const spacing = getSpacing(tbl);
  const border = getBorder(tbl);
  const entries = buildLayouts(tbl, measurer, env);
  if (entries.length === 0) {
    return { entries, widths: [], heights: [], spacing, border };
  }
  const ncols = Math.max(...entries.map(e => e.col + e.colspan));
  const nrows = Math.max(...entries.map(e => e.row + e.rowspan));
  const widths = setColWidths(entries, ncols, spacing);
  const heights = setRowHeights(entries, nrows, spacing);
  return { entries, widths, heights, spacing, border };
};

/** @see lib/common/htmltable.c:size_html_tbl */
const sizeTableInner = (
  tbl: HtmlTable,
  measurer: TextMeasurer,
  env: HtmlSizeEnv,
): void => {
  const { entries, widths, heights, spacing, border } = layoutHtmlTable(tbl, measurer, env);
  if (entries.length === 0) { tbl.dimen = { w: 0, h: 0 }; return; }
  const ncols = Math.max(...entries.map(e => e.col + e.colspan));
  const nrows = Math.max(...entries.map(e => e.row + e.rowspan));
  for (const e of entries) e.cell.dimen = { w: e.w, h: e.h };
  const { wd, ht } = sumTableDims({ widths, heights, ncols, nrows, spacing, border });
  const baseWd = tbl.width !== undefined ? tbl.width : 0;
  const baseHt = tbl.height !== undefined ? tbl.height : 0;
  // C zeroes only the CONTENT-derived term for a FIXEDSIZE table that has BOTH
  // width and height, so the box becomes fmax(0, width)=width / fmax(0,height)=
  // height (the explicit size). A fixed table missing a dimension warns and
  // keeps the content size. The port previously set dimen to 0 outright,
  // discarding the explicit size. @see lib/common/htmltable.c:1678-1693
  const zeroContent = isTblFixed(tbl) && baseWd !== 0 && baseHt !== 0;
  tbl.dimen = {
    w: Math.max(zeroContent ? 0 : wd, baseWd),
    h: Math.max(zeroContent ? 0 : ht, baseHt),
  };
};

/**
 * Compute and write `dimen` onto all cells and the label.
 *
 * The optional `imageSizer` resolves `<IMG SRC="..."/>` dimensions.
 * When absent or when the sizer returns null, images get zero size and a
 * warning is emitted, matching C's missing-image behavior exactly.
 *
 * @see lib/common/htmltable.c:make_html_label
 */
export const sizeHtmlLabel = (
  label: HtmlLabel,
  measurer: TextMeasurer,
  env: HtmlSizeEnv = DEFAULT_SIZE_ENV,
): void => {
  if (label.kind === 'table') {
    sizeTableInner(label.table, measurer, env);
    label.dimen = label.table.dimen;
  } else {
    label.dimen = sizeTextContent(label.texts, measurer, env);
  }
};
