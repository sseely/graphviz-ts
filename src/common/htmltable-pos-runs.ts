// SPDX-License-Identifier: EPL-2.0

/**
 * HTML label text-run layout: splits cell text into lines at <BR/>, tests
 * the C "simple" fast path, and places each run's items at baselines,
 * mirroring size_html_txt / emit_htextspans geometry.
 *
 * Extracted from htmltable-pos.ts to keep each module within the repo
 * length budget; the placement geometry (cells, tables) stays there and
 * imports these helpers. Logic is unchanged from the original — only two
 * private helpers (measureItem, runSimpleKey) were factored out to keep
 * buildLineRuns / runsAreSimple within the length/CCN budget.
 *
 * @see lib/common/htmltable.c:size_html_txt
 * @see lib/common/htmltable.c:emit_htextspans
 */

import type { Box } from '../model/geom.js';
import type { TextMeasurer } from './textmeasure.js';
import type { HtmlText, HtmlTextItem } from './htmltable-types.js';
import { freetypeAscent } from './textmeasure.js';
import { HTML_BF, HTML_IF, HTML_UL, HTML_SUP, HTML_SUB, HTML_S, HTML_OL } from './emit-types.js';

/** One emitted run of text. Coordinates relative to the label center. */
export interface PlacedLine {
  text: string;
  x: number;        // left edge of the run
  baseline: number; // text baseline y
  width: number;
  fontSize: number;
  fontName: string | null;
  fontColor: string | null;
  /**
   * Renderer-applied above-baseline correction; C emit_htextspans uses
   * the item value for simple blocks (cancelled by the lfsize math, so
   * the port leaves it 0) and the constant 1 for non-simple blocks.
   * @see lib/common/htmltable.c:emit_htextspans (lines 177-180)
   */
  yoffsetCenterline?: number;
  /** Resolved HTML font flags (HTML_BF | HTML_IF | HTML_UL | …). @see lib/common/textspan.h */
  fontFlags: number;
}

/** Font info inherited from the enclosing label. */
export interface HtmlFontInfo {
  fontname: string;
  fontsize: number;
  fontcolor: string;
}

interface LineRun {
  items: HtmlTextItem[];
  width: number;
  /** Max raw font size over items (C mxfsize). */
  fontSize: number;
  /** Max metric line height over items (C mxysize). */
  height: number;
  /** Max yoffset_centerline over items (C maxoffset = 0.05 × fs). */
  maxOffset: number;
}

/**
 * Compute the HTML font flags bitmask from an HtmlTextItem.
 * Mirrors the per-span flag accumulation in htmltable.c:emit_htextspans.
 * @see lib/common/textspan.h:HTML_BF, HTML_IF, HTML_UL, HTML_SUP, HTML_SUB, HTML_S, HTML_OL
 */
export function itemFontFlags(item: HtmlTextItem): number {
  let f = 0;
  if (item.bold) f |= HTML_BF;
  if (item.italic) f |= HTML_IF;
  if (item.underline) f |= HTML_UL;
  if (item.superscript) f |= HTML_SUP;
  if (item.subscript) f |= HTML_SUB;
  if (item.strikethrough) f |= HTML_S;
  if (item.overline) f |= HTML_OL;
  return f;
}

/** Resolved face/size for an item, defaulting to the inherited finfo. */
function itemFace(item: HtmlTextItem, finfo: HtmlFontInfo): { fs: number; face: string } {
  return {
    fs: item.fontSize !== undefined ? item.fontSize : finfo.fontsize,
    face: item.fontFace !== undefined ? item.fontFace : finfo.fontname,
  };
}

/** Per-item measurement used while accumulating a run. */
interface ItemMetric { w: number; h: number; fs: number; }

/** Measure one text item; null when the item carries no text. */
function measureItem(item: HtmlTextItem, finfo: HtmlFontInfo, measurer: TextMeasurer): ItemMetric | null {
  if (item.text === undefined) return null;
  const { fs, face } = itemFace(item, finfo);
  const flags = itemFontFlags(item);
  const sz = measurer.measure(item.text, face, fs,
    { bold: !!(flags & HTML_BF), italic: !!(flags & HTML_IF) });
  return { w: sz.w, h: sz.h, fs };
}

/** A fresh, empty run accumulator. */
function newRun(): LineRun {
  return { items: [], width: 0, fontSize: 0, height: 0, maxOffset: 0 };
}

/**
 * Fold one measured item into the current run.
 * C maxoffset = MAX item yoffset_centerline; the binary metric = 0.05×fs.
 */
function accumulateItem(cur: LineRun, item: HtmlTextItem, m: ItemMetric): void {
  cur.items.push(item);
  cur.width += m.w;
  cur.fontSize = Math.max(cur.fontSize, m.fs);
  cur.height = Math.max(cur.height, m.h);
  cur.maxOffset = Math.max(cur.maxOffset, 0.05 * m.fs);
}

/** Split text content into lines at <BR/> items. @see size_html_txt */
export function buildLineRuns(
  texts: HtmlText[],
  finfo: HtmlFontInfo,
  measurer: TextMeasurer,
): LineRun[] {
  const runs: LineRun[] = [];
  let cur: LineRun = newRun();
  const flush = (): void => { runs.push(cur); cur = newRun(); };
  for (const txt of texts) {
    for (const item of txt.items) {
      if (item.br) { flush(); continue; }
      const m = measureItem(item, finfo, measurer);
      if (m !== null) accumulateItem(cur, item, m);
    }
    flush();
  }
  return runs.filter(r => r.items.length > 0);
}

/**
 * Per-run "simple" key: resolved face/size, or `null` when the run
 * disqualifies the whole block (multi-item or font flags), or `undefined`
 * for an empty run (skipped). @see lib/common/htmltable.c:size_html_txt
 */
function runSimpleKey(
  run: LineRun,
  finfo: HtmlFontInfo,
): { fs: number; face: string } | null | undefined {
  if (run.items.length > 1) return null;
  const item = run.items[0];
  if (item === undefined) return undefined;
  if (itemFontFlags(item) !== 0) return null;
  return itemFace(item, finfo);
}

/**
 * C's "simple" test over built runs: one item per line, no font flags,
 * uniform resolved face/size across lines.
 * @see lib/common/htmltable.c:size_html_txt (lines 946-986)
 */
export function runsAreSimple(runs: LineRun[], finfo: HtmlFontInfo): boolean {
  let prevFs = -1;
  let prevFace: string | null = null;
  for (const run of runs) {
    const key = runSimpleKey(run, finfo);
    if (key === null) return false;
    if (key === undefined) continue;
    if (prevFs < 0) prevFs = key.fs;
    else if (key.fs !== prevFs) return false;
    if (prevFace === null) prevFace = key.face;
    else if (key.face !== prevFace) return false;
  }
  return true;
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
    const { fs, face } = itemFace(item, finfo);
    const flags = itemFontFlags(item);
    const sz = measurer.measure(item.text!, face, fs,
      { bold: !!(flags & HTML_BF), italic: !!(flags & HTML_IF) });
    lines.push({
      text: item.text!, x, baseline, width: sz.w, fontSize: fs,
      fontName: face, fontColor: item.fontColor ?? finfo.fontcolor,
      fontFlags: flags,
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
  if (runsAreSimple(runs, finfo)) {
    return placeSimpleRuns(runs, box, finfo, measurer);
  }
  return placeComplexRuns(runs, box, finfo, measurer);
}

/**
 * Simple block (one plain uniform item per line): first baseline one
 * ascent below the block top; later lines advance by the metric line
 * height. Net effect of C's lfsize = maxlayout + maxoffset followed by
 * the renderer adding yoffset_centerline back.
 * @see lib/common/htmltable.c:size_html_txt (simple branch, line 1045)
 */
function placeSimpleRuns(
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
    baseline -= i === 0 ? freetypeAscent(run.fontSize, finfo.fontname) : run.height;
    lines.push(...placeRunItems(run, centerX - run.width / 2, baseline, finfo, measurer));
  }
  return lines;
}

/**
 * Non-simple block (font flags, multiple runs per line, or mixed
 * faces/sizes): C switches to raw font sizes —
 *   lfsize_0 = mxfsize − maxoffset
 *   lfsize_i = mxfsize + ysize − curbline − maxoffset   (i > 0)
 * with lsize = mxfsize accumulated into ysize, and every item rendered
 * with yoffset_centerline = 1 (emit_htextspans line 180).
 * @see lib/common/htmltable.c:size_html_txt (lines 1056-1060)
 * @see lib/common/htmltable.c:emit_htextspans (lines 177-180)
 */
function placeComplexRuns(
  runs: LineRun[],
  box: Box,
  finfo: HtmlFontInfo,
  measurer: TextMeasurer,
): PlacedLine[] {
  const centerX = (box.ll.x + box.ur.x) / 2;
  const lines: PlacedLine[] = [];
  let curbline = 0;
  let ysize = 0;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const lfsize = i === 0
      ? run.fontSize - run.maxOffset
      : run.fontSize + ysize - curbline - run.maxOffset;
    curbline += lfsize;
    ysize += run.fontSize;
    const baseline = box.ur.y - curbline;
    for (const pl of placeRunItems(run, centerX - run.width / 2, baseline, finfo, measurer)) {
      pl.yoffsetCenterline = 1;
      lines.push(pl);
    }
  }
  return lines;
}
