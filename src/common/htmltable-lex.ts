// SPDX-License-Identifier: EPL-2.0
/**
 * HTML-like label tokenizer — lib/common/htmllex.c port.
 *
 * Lizard 1.22 misparses TS when a pipe character appears inside a regex
 * literal between function declarations. All regexes in this file avoid
 * pipe alternation. Functions are ordered so that any function Lizard
 * miscounts as spanning to EOF stays within the 30-line limit.
 *
 * @see lib/common/htmllex.c:startElement
 * @see lib/common/htmllex.c:findNext
 */

import { HtmlParseError } from './htmltable-types.js';
import type { Token } from './htmltable-types.js';

export type { Token } from './htmltable-types.js';

type Attrs = { [k: string]: string };

const KNOWN_TAGS = new Set([
  'TABLE', 'TR', 'TD', 'TH', 'FONT', 'BR', 'IMG',
  'B', 'I', 'U', 'O', 'S', 'SUB', 'SUP', 'HR', 'VR', 'HTML',
]);

/** @see lib/common/htmllex.c:lexerror */
function checkTag(tag: string) {
  if (!KNOWN_TAGS.has(tag.toUpperCase())) {
    throw new HtmlParseError(tag);
  }
}

const isWs = (c: string | undefined): boolean =>
  c === ' ' || c === '\t' || c === '\n' || c === '\r';

/**
 * Parse key="value" attribute pairs. Values are consumed, never
 * re-scanned (the old scanner re-matched words inside quoted values as
 * phantom attributes). Bare or unquoted attributes are not well-formed
 * XML — expat rejects the document and the label falls back to plain
 * text; throwing here reproduces that.
 * @see lib/common/htmllex.c (XML_Parse "not well-formed" error path)
 */
function parseAttrs(raw: string) {
  const out: Attrs = {};
  let i = 0;
  while (i < raw.length) {
    while (isWs(raw[i])) i++;
    if (i >= raw.length) break;
    const m = /^[\w-]+/.exec(raw.slice(i));
    if (m === null) throw new HtmlParseError(raw.slice(i, i + 10));
    const name = m[0].toLowerCase();
    i += m[0].length;
    while (isWs(raw[i])) i++;
    if (raw[i] !== '=') throw new HtmlParseError(name);
    i++;
    while (isWs(raw[i])) i++;
    const q = raw[i];
    if (q !== '"' && q !== "'") throw new HtmlParseError(name);
    const end = raw.indexOf(q, i + 1);
    if (end < 0) throw new HtmlParseError(name);
    out[name] = raw.slice(i + 1, end);
    i = end + 1;
  }
  return out;
}

/** Parse close tag. @see lib/common/htmllex.c:endElement */
function parseCloseToken(inner: string) {
  const body = inner.slice(1).trim();
  const sp = body.search(/\s/);
  const tag = (sp === -1 ? body : body.slice(0, sp)).toUpperCase();
  checkTag(tag);
  return { type: 'close' as const, tag };
}

/** @see lib/common/htmllex.c:characterData */
function cleanText(raw: string) {
  const isKeep = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
  return raw.replace(/[\x00-\x1f\x7f]/g, (c) => isKeep(c) ? c : '');
}

/** Scan text run up to next tag; push non-empty token; return new index. */
function scanText(src: string, start: number, tokens: Token[]) {
  let j = start;
  while (j < src.length && src[j] !== '<') j++;
  const clean = cleanText(src.slice(start, j));
  if (clean.length > 0) tokens.push({ type: 'text', value: clean });
  return j;
}

/** Scan one tag; push token; return index after closing bracket. */
function scanTag(src: string, start: number, tokens: Token[]) {
  let j = start + 1;
  while (j < src.length && src[j] !== '>') j++;
  const inner = src.slice(start + 1, j).trim();
  const next = j + 1;
  if (inner.startsWith('!--')) return next;
  if (inner.startsWith('/')) { tokens.push(parseCloseToken(inner)); return next; }
  // Self-closing <X/>: expat reports startElement then endElement.
  // @see lib/common/htmllex.c (XML_SetElementHandler callbacks)
  if (inner.endsWith('/')) {
    const open = parseOpenToken(inner.slice(0, -1).trim());
    tokens.push(open, { type: 'close', tag: open.tag });
    return next;
  }
  tokens.push(parseOpenToken(inner));
  return next;
}

/** Parse open tag — placed last so Lizard length-to-EOF stays within 30. */
function parseOpenToken(inner: string) {
  const sp = inner.search(/\s/);
  if (sp === -1) {
    checkTag(inner.toUpperCase());
    return { type: 'open' as const, tag: inner.toUpperCase(), attrs: parseAttrs('') };
  }
  const tag = inner.slice(0, sp).toUpperCase();
  checkTag(tag);
  return { type: 'open' as const, tag, attrs: parseAttrs(inner.slice(sp + 1)) };
}

/** @see lib/common/htmllex.c:findNext */
export function tokenize(src: string) {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    i = src[i] === '<' ? scanTag(src, i, tokens) : scanText(src, i, tokens);
  }
  return tokens;
}
