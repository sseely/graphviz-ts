// SPDX-License-Identifier: EPL-2.0
/**
 * HTML-like label parser.
 * Ported from lib/common/htmllex.c + lib/common/htmlparse.y
 *
 * @see lib/common/htmllex.c:startElement
 * @see lib/common/htmlparse.y
 */

import type {
  HtmlAlign,
  HtmlCell,
  HtmlCellContent,
  HtmlHR,
  HtmlImage,
  HtmlLabel,
  HtmlRow,
  HtmlTable,
  HtmlText,
  HtmlTextItem,
  HtmlVAlign,
  Token,
  OpenToken,
} from './htmltable-types.js';
import {
  HtmlParseError,
  BORDER_LEFT,
  BORDER_TOP,
  BORDER_RIGHT,
  BORDER_BOTTOM,
  BORDER_MASK,
} from './htmltable-types.js';
import { tokenize } from './htmltable-lex.js';
import { htmlEntityUTF8 } from './html-entities.js';

/** Decode XML/HTML entities in an anchor attribute value (href/target), as C's
 *  HTML parser does. The stored value is the real character (`&amp;` → `&`), so
 *  imap emits it raw and cmapx re-escapes it. Undefined passes through. */
function anchorAttr(v: string | undefined): string | undefined {
  return v === undefined ? undefined : htmlEntityUTF8(v);
}

// ---------------------------------------------------------------------------
// Attribute helpers
// ---------------------------------------------------------------------------

const parseAlign = (v: string): HtmlAlign | undefined => {
  const u = v.toUpperCase();
  if (u === 'LEFT') return 'left';
  if (u === 'RIGHT') return 'right';
  if (u === 'CENTER') return 'center';
  return undefined;
};

const parseVAlign = (v: string): HtmlVAlign | undefined => {
  const u = v.toUpperCase();
  if (u === 'TOP') return 'top';
  if (u === 'BOTTOM') return 'bottom';
  if (u === 'MIDDLE') return 'middle';
  return undefined;
};

const num = (s: string | undefined): number | undefined => {
  if (s === undefined) return undefined;
  const n = parseInt(s, 10);
  return isNaN(n) ? undefined : n;
};

// ---------------------------------------------------------------------------
// Font-stack — mirrors pushFont / popFont in htmlparse.y
// ---------------------------------------------------------------------------

interface FontState {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  overline?: boolean;
  strikethrough?: boolean;
  subscript?: boolean;
  superscript?: boolean;
  fontColor?: string;
  fontFace?: string;
  fontSize?: number;
}

const definedOf = (s: FontState): Partial<FontState> =>
  Object.fromEntries(
    Object.entries(s).filter(([, v]) => v !== undefined),
  ) as Partial<FontState>;

const mergeFontState = (parent: FontState, child: FontState): FontState =>
  ({ ...parent, ...definedOf(child) }) as FontState;

const BOOL_FONT_KEYS = [
  'bold', 'italic', 'underline', 'overline',
  'strikethrough', 'subscript', 'superscript',
] as const;
type BoolFontKey = typeof BOOL_FONT_KEYS[number];

const fontItemProps = (f: FontState): Partial<HtmlTextItem> => {
  const out: Partial<HtmlTextItem> = {};
  for (const k of BOOL_FONT_KEYS) {
    if (f[k]) out[k as BoolFontKey] = true;
  }
  if (f.fontColor) out.fontColor = f.fontColor;
  if (f.fontFace) out.fontFace = f.fontFace;
  if (f.fontSize !== undefined) out.fontSize = f.fontSize;
  return out;
};

// ---------------------------------------------------------------------------
// Parser state
// ---------------------------------------------------------------------------

interface ParseState {
  tokens: Token[];
  pos: number;
}

const peek = (s: ParseState): Token | undefined => s.tokens[s.pos];

const consume = (s: ParseState): Token => {
  const t = s.tokens[s.pos];
  s.pos++;
  return t;
};

// ---------------------------------------------------------------------------
// Inline-tag helpers — mirrors htmlparse.y fonttext / inline rules
// ---------------------------------------------------------------------------

const isInlineTag = (tag: string): boolean =>
  ['B', 'I', 'U', 'O', 'S', 'SUB', 'SUP'].includes(tag);

const inlineFontState = (tag: string, _attrs: Record<string, string>): FontState => {
  const fs: FontState = {};
  if (tag === 'B') fs.bold = true;
  if (tag === 'I') fs.italic = true;
  if (tag === 'U') fs.underline = true;
  if (tag === 'O') fs.overline = true;
  if (tag === 'S') fs.strikethrough = true;
  if (tag === 'SUB') fs.subscript = true;
  if (tag === 'SUP') fs.superscript = true;
  return fs;
};

const applyBrTag = (
  s: ParseState, t: OpenToken, fontStack: FontState[], items: HtmlTextItem[],
): void => {
  consume(s);
  const font = fontStack[fontStack.length - 1] ?? {};
  items.push({ br: true, brAlign: parseAlign(t.attrs['align'] ?? ''), ...fontItemProps(font) });
  const nxt = peek(s);
  if (nxt?.type === 'close' && nxt.tag === 'BR') consume(s);
};

const applyFontTag = (
  s: ParseState, t: OpenToken, fontStack: FontState[], items: HtmlTextItem[],
): void => {
  consume(s);
  const font = fontStack[fontStack.length - 1] ?? {};
  fontStack.push(mergeFontState(font, {
    fontColor: t.attrs['color'],
    fontFace: t.attrs['face'],
    fontSize: num(t.attrs['point-size']),
  }));
  const inner = parseText(s, fontStack);
  fontStack.pop();
  items.push(...inner.items);
  const nxt = peek(s);
  if (nxt?.type === 'close' && nxt.tag === 'FONT') consume(s);
};

const applyInlineTag = (
  s: ParseState, t: OpenToken, fontStack: FontState[], items: HtmlTextItem[],
): void => {
  consume(s);
  const font = fontStack[fontStack.length - 1] ?? {};
  fontStack.push(mergeFontState(font, inlineFontState(t.tag, t.attrs)));
  const inner = parseText(s, fontStack);
  fontStack.pop();
  items.push(...inner.items);
  const nxt = peek(s);
  if (nxt?.type === 'close' && nxt.tag === t.tag) consume(s);
};

const applyOpenTag = (
  s: ParseState, t: OpenToken, fontStack: FontState[], items: HtmlTextItem[],
): boolean => {
  if (t.tag === 'BR') { applyBrTag(s, t, fontStack, items); return true; }
  if (t.tag === 'FONT') { applyFontTag(s, t, fontStack, items); return true; }
  if (isInlineTag(t.tag)) { applyInlineTag(s, t, fontStack, items); return true; }
  return false;
};

// ---------------------------------------------------------------------------
// parseText — parses inline text/font content
// ---------------------------------------------------------------------------

/** @see lib/common/htmlparse.y:fonttext / text rules */
export const parseText = (s: ParseState, fontStack: FontState[]): HtmlText => {
  const items: HtmlTextItem[] = [];
  while (s.pos < s.tokens.length) {
    const t = peek(s);
    if (!t) break;
    if (t.type === 'text') {
      consume(s);
      items.push({ text: t.value, ...fontItemProps(fontStack[fontStack.length - 1] ?? {}) });
      continue;
    }
    if (t.type === 'close') break;
    if (t.type === 'open' && applyOpenTag(s, t, fontStack, items)) continue;
    break;
  }
  return { kind: 'text', items };
};

// ---------------------------------------------------------------------------
// Cell content helpers — mirrors htmlparse.y cell rule
// ---------------------------------------------------------------------------

const parseHrContent = (s: ParseState): HtmlHR => {
  consume(s);
  const nxt = peek(s);
  if (nxt?.type === 'close' && nxt.tag === 'HR') consume(s);
  return { kind: 'hr' };
};

const parseImgContent = (
  s: ParseState, t: OpenToken, cellAttrs: Record<string, string>,
): HtmlImage => {
  consume(s);
  const img: HtmlImage = {
    kind: 'image',
    src: cellAttrs['src'] ?? t.attrs['src'] ?? '',
    scale: t.attrs['scale'],
  };
  const nxt = peek(s);
  if (nxt?.type === 'close' && nxt.tag === 'IMG') consume(s);
  return img;
};

const parseCellItem = (
  s: ParseState, t: Token, cellAttrs: Record<string, string>, fontStack: FontState[],
): HtmlCellContent[] => {
  if (t.type === 'open' && t.tag === 'TABLE') return [parseTable(s, fontStack)];
  if (t.type === 'open' && t.tag === 'IMG') return [parseImgContent(s, t, cellAttrs)];
  if (t.type === 'open' && t.tag === 'HR') return [parseHrContent(s)];
  const txt = parseText(s, fontStack);
  return txt.items.length > 0 ? [txt] : [];
};

const parseCellContent = (
  s: ParseState, cellAttrs: Record<string, string>, fontStack: FontState[],
): HtmlCellContent[] => {
  const content: HtmlCellContent[] = [];
  while (s.pos < s.tokens.length) {
    const t = peek(s);
    if (!t) break;
    if (t.type === 'close' && t.tag === 'TD') break;
    content.push(...parseCellItem(s, t, cellAttrs, fontStack));
  }
  const nxt = peek(s);
  if (nxt?.type === 'close' && nxt.tag === 'TD') consume(s);
  // C models a cell child as a single object; the `TD table TD` rule discards
  // whitespace around a nested table, so a table IS the cell's sole content.
  // @see lib/common/htmltable.h:htmlcell_t.child
  const tbl = content.find((c) => c.kind === 'table');
  if (tbl !== undefined) return [tbl];
  return content;
};

const parseFixedSize = (a: Record<string, string>): true | undefined =>
  a['fixedsize']?.toUpperCase() === 'TRUE' ? true : undefined;

const parseTitle = (a: Record<string, string>): string | undefined =>
  a['title'] !== undefined ? a['title'] : a['tooltip'];

/**
 * Parse SIDES attribute into a bitmask matching C sidesfn().
 * Unrecognised chars are silently skipped (C issues a warning but continues).
 * C guard: if (flags != BORDER_MASK) p->flags |= flags — the full-mask case
 * is a no-op (means "all sides", the default), so we return undefined for it.
 * @see lib/common/htmllex.c:sidesfn
 */
const parseSides = (v: string | undefined): number | undefined => {
  if (v === undefined) return undefined;
  let flags = 0;
  for (const c of v.toLowerCase()) {
    if (c === 'l') flags |= BORDER_LEFT;
    else if (c === 't') flags |= BORDER_TOP;
    else if (c === 'r') flags |= BORDER_RIGHT;
    else if (c === 'b') flags |= BORDER_BOTTOM;
  }
  // C: if (flags != BORDER_MASK) p->flags |= flags
  if (flags === 0 || flags === BORDER_MASK) return undefined;
  return flags;
};

/**
 * Parse GRADIENTANGLE attribute — integer in [0, 360].
 * Out-of-range or non-integer values are ignored (C issues a warning).
 * @see lib/common/htmllex.c:gradientanglefn
 */
const parseGradientAngle = (v: string | undefined): number | undefined => {
  if (v === undefined) return undefined;
  const n = parseInt(v, 10);
  if (isNaN(n) || String(n) !== v.trim()) return undefined;
  if (n < 0 || n > 360) return undefined;
  return n;
};

/**
 * Parse COLUMNS attribute — only "*" is valid (sets vrule=true).
 * @see lib/common/htmllex.c:columnsfn
 */
const parseColumns = (v: string | undefined): true | undefined =>
  v === '*' ? true : undefined;

/**
 * Parse ROWS attribute — only "*" is valid (sets hrule=true).
 * @see lib/common/htmllex.c:rowsfn
 */
const parseRows = (v: string | undefined): true | undefined =>
  v === '*' ? true : undefined;

const buildCell = (content: HtmlCellContent[], a: Record<string, string>): HtmlCell => ({
  kind: 'cell',
  content,
  port: a['port'],
  align: parseAlign(a['align'] !== undefined ? a['align'] : ''),
  valign: parseVAlign(a['valign'] !== undefined ? a['valign'] : ''),
  balign: parseAlign(a['balign'] !== undefined ? a['balign'] : ''),
  bgcolor: a['bgcolor'],
  color: a['color'],
  border: num(a['border']),
  cellpadding: num(a['cellpadding']),
  cellspacing: num(a['cellspacing']),
  sides: parseSides(a['sides']),
  gradientangle: parseGradientAngle(a['gradientangle']),
  style: a['style'],
  width: num(a['width']),
  height: num(a['height']),
  fixedsize: parseFixedSize(a),
  colspan: num(a['colspan']),
  rowspan: num(a['rowspan']),
  href: anchorAttr(a['href']),
  title: parseTitle(a),
  target: anchorAttr(a['target']),
  id: a['id'],
});

/** @see lib/common/htmlparse.y:cell rule / lib/common/htmllex.c:mkCell */
const parseCell = (
  s: ParseState, attrs: Record<string, string>, fontStack: FontState[],
): HtmlCell => buildCell(parseCellContent(s, attrs, fontStack), attrs);

// ---------------------------------------------------------------------------
// parseRow — parses <TR>...</TR>
// ---------------------------------------------------------------------------

const processRowToken = (
  s: ParseState, t: Token, cells: HtmlCell[], fontStack: FontState[],
): void => {
  if (t.type === 'open' && (t.tag === 'TD' || t.tag === 'TH')) {
    consume(s);
    cells.push(parseCell(s, t.attrs, fontStack));
    return;
  }
  if (t.type === 'open' && t.tag === 'VR') {
    consume(s);
    const nxt = peek(s);
    if (nxt?.type === 'close' && nxt.tag === 'VR') consume(s);
    // C grammar: "cells VR cell" — VR marks the PRECEDING cell as
    // vertically ruled; VR without a preceding cell is a syntax error.
    // @see lib/common/htmlparse.y:329
    const prev = cells[cells.length - 1];
    if (prev === undefined) throw new HtmlParseError('VR');
    prev.vruled = true;
    return;
  }
  consume(s);
};

/** @see lib/common/htmlparse.y:row + cells rules */
const parseRow = (s: ParseState, fontStack: FontState[]): HtmlRow => {
  const cells: HtmlCell[] = [];
  while (s.pos < s.tokens.length) {
    const t = peek(s);
    if (!t) break;
    if (t.type === 'close' && t.tag === 'TR') break;
    processRowToken(s, t, cells, fontStack);
  }
  const nxt = peek(s);
  if (nxt?.type === 'close' && nxt.tag === 'TR') consume(s);
  return { cells };
};

// ---------------------------------------------------------------------------
// parseTable — parses <TABLE>...</TABLE>
// ---------------------------------------------------------------------------

const buildTable = (rows: HtmlRow[], a: Record<string, string>): HtmlTable => ({
  kind: 'table' as const,
  rows,
  border: num(a['border']),
  cellborder: num(a['cellborder']),
  cellspacing: num(a['cellspacing']),
  cellpadding: num(a['cellpadding']),
  bgcolor: a['bgcolor'],
  color: a['color'],
  style: a['style'],
  align: parseAlign(a['align'] !== undefined ? a['align'] : ''),
  valign: parseVAlign(a['valign'] !== undefined ? a['valign'] : ''),
  fixedsize: parseFixedSize(a),
  width: num(a['width']),
  height: num(a['height']),
  href: anchorAttr(a['href']),
  title: parseTitle(a),
  target: anchorAttr(a['target']),
  id: a['id'],
  port: a['port'],
  sides: parseSides(a['sides']),
  gradientangle: parseGradientAngle(a['gradientangle']),
  vrule: parseColumns(a['columns']),
  hrule: parseRows(a['rows']),
});

/** @see lib/common/htmlparse.y:table rule / lib/common/htmllex.c:mkTbl */
export const parseTable = (s: ParseState, fontStack: FontState[]): HtmlTable => {
  const open = consume(s); // consume <TABLE>
  if (open.type !== 'open' || open.tag !== 'TABLE') throw new HtmlParseError('TABLE');
  // C addRow: every row starts ruled when ROWS="*" (htmlparse.y addRow);
  // C setCell: every cell starts vruled when COLUMNS="*".
  const hrule = parseRows(open.attrs['rows']) === true;
  const vrule = parseColumns(open.attrs['columns']) === true;
  const rows: HtmlRow[] = [];
  while (s.pos < s.tokens.length) {
    const t = peek(s);
    if (!t) break;
    if (t.type === 'close' && t.tag === 'TABLE') { consume(s); break; }
    if (t.type === 'open' && t.tag === 'TR') {
      consume(s);
      rows.push(parseTableRow(s, fontStack, { hrule, vrule }));
      continue;
    }
    if (t.type === 'open' && t.tag === 'HR') {
      consumeRowHr(s, rows);
      continue;
    }
    consume(s);
  }
  return buildTable(rows, open.attrs);
};

/** Parse one row, applying table-level rule defaults. @see lib/common/htmlparse.y addRow/setCell */
const parseTableRow = (
  s: ParseState, fontStack: FontState[], opts: { hrule: boolean; vrule: boolean },
): HtmlRow => {
  const row = parseRow(s, fontStack);
  if (opts.hrule) row.ruled = true;
  if (opts.vrule) for (const c of row.cells) c.vruled = true;
  return row;
};

/**
 * <HR> between rows marks the PRECEDING row as ruled; HR before any
 * row is a syntax error in the C grammar.
 * @see lib/common/htmlparse.y:321 ("rows HR row")
 */
const consumeRowHr = (s: ParseState, rows: HtmlRow[]): void => {
  consume(s);
  const nxt = peek(s);
  if (nxt?.type === 'close' && nxt.tag === 'HR') consume(s);
  const prev = rows[rows.length - 1];
  if (prev === undefined) throw new HtmlParseError('HR');
  prev.ruled = true;
};

// ---------------------------------------------------------------------------
// parseHtmlLabel — public entry point
// ---------------------------------------------------------------------------

const findFirstRealToken = (tokens: Token[], start: number): Token | undefined => {
  for (let i = start; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk.type !== 'text' || tk.value.trim() !== '') return tk;
  }
  return undefined;
};

const skipLeadingWs = (s: ParseState): void => {
  while (true) {
    const nxt = peek(s);
    if (!nxt || nxt.type !== 'text' || nxt.value.trim() !== '') break;
    consume(s);
  }
};

const parseTableLabel = (s: ParseState, fontStack: FontState[]): HtmlLabel => {
  skipLeadingWs(s);
  const table = parseTable(s, fontStack);
  const nxt = peek(s);
  if (nxt?.type === 'close' && nxt.tag === 'HTML') consume(s);
  return { kind: 'table', table };
};

/**
 * Parse an HTML-like label string.
 * Input is the content between the outer `<` `>` delimiters (already stripped).
 *
 * @see lib/common/htmlparse.y:parseHTML
 */
export const parseHtmlLabel = (src: string): HtmlLabel => {
  const wrapped = `<HTML>${src}</HTML>`;
  const tokens = tokenize(wrapped);
  const s: ParseState = { tokens, pos: 0 };
  const fontStack: FontState[] = [{}];
  const htmlOpen = consume(s);
  if (htmlOpen.type !== 'open' || htmlOpen.tag !== 'HTML') throw new HtmlParseError('HTML');
  const firstReal = findFirstRealToken(tokens, s.pos);
  if (firstReal?.type === 'open' && firstReal.tag === 'TABLE') {
    return parseTableLabel(s, fontStack);
  }
  const texts: HtmlText[] = [];
  const txt = parseText(s, fontStack);
  if (txt.items.length > 0) texts.push(txt);
  const nxt = peek(s);
  // C's `table` rule aborts the whole label when non-space text precedes a
  // top-level <TABLE> ("Syntax error: non-space string used before <TABLE>").
  // parseText stopped at the <TABLE>; reaching it here means there was leading
  // non-space text, so reject the label rather than leniently dropping the table.
  // @see lib/common/htmlparse.y:288 (table rule nonSpace check)
  if (nxt?.type === 'open' && nxt.tag === 'TABLE') {
    throw new HtmlParseError('non-space string used before <TABLE>');
  }
  if (nxt?.type === 'close' && nxt.tag === 'HTML') consume(s);
  return { kind: 'text', texts };
};
