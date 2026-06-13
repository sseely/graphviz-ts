// SPDX-License-Identifier: EPL-2.0

/**
 * HTML rule-line emission and anchor helpers.
 * Ports emit_html_rules, initAnchor, endAnchor from lib/common/htmltable.c.
 *
 * @see lib/common/htmltable.c:emit_html_rules
 * @see lib/common/htmltable.c:initAnchor
 * @see lib/common/htmltable.c:endAnchor
 */

import type { Point } from '../model/geom.js';
import type { RenderJob } from '../gvc/job.js';
import type { RendererPlugin } from '../gvc/context.js';
import type { PlacedCell, PlacedHtml } from './htmltable-pos.js';
import { doSide, withHtmlPaint } from './htmltable-emit-fill.js';

// ---------------------------------------------------------------------------
// Rule context
// ---------------------------------------------------------------------------

/** Shared context for rule-line helpers, grouping all inputs. */
export interface RuleCtx {
  cell:  PlacedCell;
  tbl:   PlacedHtml;
  pos:   Point;
  color: string;
  /** Next cell in row-major order; C passes *cells after increment. */
  nextCell?: PlacedCell;
  renderer: RendererPlugin;
  job:   RenderJob;
}

// ---------------------------------------------------------------------------
// emitHtmlRules
// ---------------------------------------------------------------------------

/**
 * Emit vertical/horizontal rule lines for a cell that has vruled/hruled set.
 * Pen width forced to 1.0 per C (emit_html_tbl:576 comment); rules draw
 * as filled boxes with fill = pen = rule color.
 *
 * @see lib/common/htmltable.c:emit_html_rules
 */
export function emitHtmlRules(ctx: RuleCtx): void {
  withHtmlPaint({ fill: ctx.color, pen: ctx.color, penWidth: 1 }, ctx.job, () => {
    if (ctx.cell.vruled === true) emitVRuleIfNeeded(ctx);
    if (ctx.cell.hruled === true) emitHRuleIfNeeded(ctx);
  });
}

// ---------------------------------------------------------------------------
// Vertical rule
// ---------------------------------------------------------------------------

/** Cell position summary used by rule param helpers. */
interface CellPos {
  idx: number;   // row or col index
  span: number;  // rowspan or colspan
  count: number; // rowCount or columnCount
  border: number;
  sp: number;
}

/** Base extension and start coordinate for a vertical rule. */
function vRuleCoords(lly: number, p: CellPos): { ruleY: number; base: number } {
  if (p.idx === 0) {
    return { ruleY: lly - p.sp / 2, base: p.border + p.sp / 2 };
  }
  if (p.idx + p.span === p.count) {
    const base = p.border + p.sp / 2;
    return { ruleY: lly - p.sp / 2 - base, base };
  }
  return { ruleY: lly - p.sp / 2, base: 0 };
}

/** Emit vertical rule if cell does not span to the last column. */
function emitVRuleIfNeeded(ctx: RuleCtx): void {
  const { cell, tbl, pos, renderer, job } = ctx;
  if (cell.col + cell.colspan >= tbl.columnCount) return;
  const sp  = tbl.spacing;
  const lly = cell.box.ll.y + pos.y;
  const ury = cell.box.ur.y + pos.y;
  const urx = cell.box.ur.x + pos.x;
  const p: CellPos = { idx: cell.row, span: cell.rowspan, count: tbl.rowCount, border: tbl.border, sp };
  const { ruleY, base } = vRuleCoords(lly, p);
  doSide({ x: urx + sp / 2, y: ruleY }, 0, base + (ury - lly) + sp, renderer, job);
}

// ---------------------------------------------------------------------------
// Horizontal rule
// ---------------------------------------------------------------------------

/**
 * Base extension and start coordinate for a horizontal rule.
 * Mirrors the C first/last-column branches, including the base
 * doubling when a col-0 cell is also the last column and the
 * incomplete-row extension to the table edge.
 * @see lib/common/htmltable.c:emit_html_rules (:488-512)
 */
function hRuleCoords(ctx: RuleCtx, llx: number, urx: number): { ruleX: number; base: number } {
  const { cell, tbl, pos, nextCell } = ctx;
  const sp = tbl.spacing;
  const lastCol = cell.col + cell.colspan === tbl.columnCount;
  // C: nextc && nextc->row != cp->row — incomplete row of cells
  const extend = nextCell !== undefined && nextCell.row !== cell.row
    ? tbl.box.ur.x + pos.x - (urx + sp / 2) : 0;
  if (cell.col === 0) {
    let base = tbl.border + sp / 2;
    const ruleX = llx - base - sp / 2;
    if (lastCol) base *= 2;
    else if (extend !== 0) base += extend;
    return { ruleX, base };
  }
  if (lastCol) {
    return { ruleX: llx - sp / 2, base: tbl.border + sp / 2 };
  }
  return { ruleX: llx - sp / 2, base: extend };
}

/** Emit horizontal rule if cell does not span to the last row. */
function emitHRuleIfNeeded(ctx: RuleCtx): void {
  const { cell, tbl, pos, renderer, job } = ctx;
  if (cell.row + cell.rowspan >= tbl.rowCount) return;
  const sp  = tbl.spacing;
  const llx = cell.box.ll.x + pos.x;
  const urx = cell.box.ur.x + pos.x;
  const lly = cell.box.ll.y + pos.y;
  const { ruleX, base } = hRuleCoords(ctx, llx, urx);
  doSide({ x: ruleX, y: lly - sp / 2 }, base + (urx - llx) + sp, 0, renderer, job);
}

// ---------------------------------------------------------------------------
// Anchor data + helpers
// ---------------------------------------------------------------------------

/** Anchor metadata extracted from cell/table HTML attributes. */
export interface AnchorData {
  href?:   string;
  title?:  string;
  target?: string;
  id?:     string;
}

/**
 * Current object context for html anchors. C keeps this on job->obj
 * (set by emit_begin_node/edge/graph); the port's live path has no
 * persistent obj state, so the device walk sets it here before
 * emitting each object's labels.
 * objLabel feeds the C default tooltip (initMapData: tooltip falls
 * back to obj->label — "<TABLE>" for table labels).
 * @see lib/common/emit.c:initMapData (line 163)
 */
const anchorEnv: { objId: string; objLabel: string | null } = { objId: '', objLabel: null };

/** Anchor id counter — C's `static int anchorId` in initAnchor, reset per render job (each dot invocation is one process). */
let anchorSeq = 0;

/** Set the current object context for anchor id/tooltip resolution. */
export function setHtmlAnchorObj(objId: string, objLabel: string | null): void {
  anchorEnv.objId = objId;
  anchorEnv.objLabel = objLabel;
}

/** Reset the per-render anchor id counter. Call at render start. */
export function resetHtmlAnchorIds(): void {
  anchorSeq = 0;
  anchorEnv.objId = '';
  anchorEnv.objLabel = null;
}

/** Normalise AnchorData to plain strings (empty when absent). */
function normaliseAnchor(data: AnchorData): { h: string; t: string; tg: string; i: string } {
  return {
    h:  data.href   !== undefined ? data.href   : '',
    t:  data.title  !== undefined ? data.title  : '',
    tg: data.target !== undefined ? data.target : '',
    i:  data.id     !== undefined ? data.id     : '',
  };
}

/**
 * Open an anchor when the data carries href/title/target.
 *
 * Mirrors C initAnchor exactly: an internal id `<objId>_<n>` is
 * generated (consuming the counter) whenever the call is made without
 * an explicit ID attr, but the anchor element only opens when there is
 * a URL or an explicit tooltip (initMapData: obj->url ||
 * obj->explicit_tooltip). A missing TITLE inherits the object label
 * as tooltip.
 * Returns true when an anchor was opened (caller must endHtmlAnchor).
 *
 * @see lib/common/htmltable.c:initAnchor (line 381)
 * @see lib/common/emit.c:initMapData (line 163)
 */
export function initHtmlAnchor(
  data: AnchorData,
  renderer: RendererPlugin,
  job: RenderJob,
): boolean {
  if (data.href === undefined && data.title === undefined && data.target === undefined) {
    return false;
  }
  const id = data.id !== undefined && data.id !== ''
    ? data.id
    : `${anchorEnv.objId}_${anchorSeq++}`;
  if (data.href === undefined && data.title === undefined) {
    return false; // target-only: id consumed, no anchor (C: !url && !explicit_tooltip)
  }
  const tooltip = data.title ?? anchorEnv.objLabel ?? '';
  const { h, tg } = normaliseAnchor(data);
  renderer.beginAnchor?.(h, tooltip, tg, id, job);
  return true;
}

/**
 * Close anchor opened by initHtmlAnchor.
 *
 * @see lib/common/htmltable.c:endAnchor
 */
export function endHtmlAnchor(renderer: RendererPlugin, job: RenderJob): void {
  renderer.endAnchor?.(job);
}
