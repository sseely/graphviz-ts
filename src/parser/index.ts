// SPDX-License-Identifier: EPL-2.0

/**
 * Public API for the DOT-language parser.
 *
 * @see lib/cgraph/grammar.y
 * @see lib/cgraph/scan.l
 */

import { parse as peggyParse } from './dot.js';
import { Graph } from '../model/graph.js';
import type { GraphKind } from '../model/graph.js';
import type { Edge } from '../model/edge.js';
import { isHtmlValue, htmlValueContent } from '../common/html-string.js';
import { buildFromAst } from './builder.js';
import type { ParsedGraph } from './ast.js';
import type { GvError, GvErrorCode, GvExpectation } from '../errors.js';
import { friendlyMessageFor } from '../errors.js';

// ── ParseError ────────────────────────────────────────────────────────────────

/**
 * Thrown for syntax errors or edge-direction violations.
 *
 * Implements the structured {@link GvError} contract: `location` is primary;
 * `line`/`column` are convenience getters that delegate to it.
 */
export class ParseError extends Error implements GvError {
  readonly type = 'syntax';
  readonly code: GvErrorCode;
  readonly friendlyMessage: string;
  readonly location: { line: number; column: number; offset?: number };
  readonly expected?: GvExpectation[];

  constructor(
    message: string,
    code: GvErrorCode,
    location: { line: number; column: number; offset?: number },
    expected?: GvExpectation[],
  ) {
    super(message);
    this.name = 'ParseError';
    this.code = code;
    this.location = location;
    this.friendlyMessage = friendlyMessageFor(code);
    if (expected !== undefined) this.expected = expected;
  }

  get line(): number {
    return this.location.line;
  }

  get column(): number {
    return this.location.column;
  }
}

// ── Source stripping ──────────────────────────────────────────────────────────
// Blank comments and the *interiors* of quoted / HTML strings so that
// validateEdgeOperators can regex for `--`/`->` without false positives from
// operators that merely appear inside a string or comment. Output is the SAME
// LENGTH as the input (every char maps to a space or itself) so a match offset
// in the stripped text maps 1:1 back to a line/column in the original source.
//
// This is a single left-to-right pass mirroring scan.l's start-conditions: a
// comment introducer (`#`, `//`, `/*`) is only recognized in the INITIAL state,
// never inside a quoted or HTML string; a `"`/`<` only opens a string in the
// initial state, never inside a comment. A previous regex-cascade stripped
// comments before strings, so a `#` inside a `_draw_="...-#000000..."` color
// (or `//` in a URL, `/*` in a label) was mistaken for a comment and blanked
// the string's closing `"` — corrupting quote parity for the rest of the file.
//
// @see lib/cgraph/scan.l — start-conditions: INITIAL, qstring, hstring;
//   comment rules (:122-123 `#`, block/line comments) fire only in INITIAL;
//   qstring rules (:137-142) handle `\"`, `\\`, and `\<newline>` continuation.

export class Stripper {
  static strip(src: string): string {
    const out: string[] = [];
    const n = src.length;
    let i = 0;
    while (i < n) {
      const c = src[i]!;
      if (c === '/' && src[i + 1] === '*') i = Stripper.blankBlock(src, i, out);
      else if ((c === '/' && src[i + 1] === '/') || c === '#') i = Stripper.blankLine(src, i, out);
      else if (c === '"') i = Stripper.blankQuoted(src, i, out);
      else if (c === '<') i = Stripper.blankHtml(src, i, out);
      else { out.push(c); i++; }
    }
    return out.join('');
  }

  /** Blank a C-style block comment (incl. its newlines). @returns next index. */
  private static blankBlock(src: string, i: number, out: string[]): number {
    const n = src.length;
    out.push('  ');
    i += 2;
    while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out.push(' '); i++; }
    if (i < n) { out.push('  '); i += 2; }
    return i;
  }

  /**
   * Blank a `//` line comment or `#` shell comment to end of line (the newline
   * is preserved). scan.l recognizes `#` as a comment anywhere in the initial
   * state — but never inside a string, which is why this only fires from the
   * top-level dispatch. @returns next index.
   */
  private static blankLine(src: string, i: number, out: string[]): number {
    const n = src.length;
    const width = src[i] === '#' ? 1 : 2;
    out.push(' '.repeat(width));
    i += width;
    while (i < n && src[i] !== '\n') { out.push(' '); i++; }
    return i;
  }

  /**
   * Blank the interior of a quoted string, keeping both quotes. `\<any>` (incl.
   * `\"`, `\\`, and a `\<newline>` continuation) never terminates the string.
   * @see lib/cgraph/scan.l qstring rules (:137-142). @returns next index.
   */
  private static blankQuoted(src: string, i: number, out: string[]): number {
    const n = src.length;
    out.push('"');
    i++;
    while (i < n && src[i] !== '"') {
      if (src[i] === '\\' && i + 1 < n) { out.push('  '); i += 2; }
      else { out.push(' '); i++; }
    }
    if (i < n) { out.push('"'); i++; }
    return i;
  }

  /**
   * Blank the interior of an HTML string `<...>`, keeping the outer brackets and
   * tracking nested `<>` like scan.l's html_nest counter. @returns next index.
   */
  private static blankHtml(src: string, i: number, out: string[]): number {
    const n = src.length;
    out.push('<');
    i++;
    let depth = 1;
    while (i < n && depth > 0) {
      if (src[i] === '<') depth++;
      else if (src[i] === '>') { depth--; if (depth === 0) break; }
      out.push(' ');
      i++;
    }
    if (i < n) { out.push('>'); i++; }
    return i;
  }
}

export function stripCommentsAndStrings(src: string): string {
  return Stripper.strip(src);
}

// ── Edge-operator validation ──────────────────────────────────────────────────

export function offsetToLineCol(
  src: string,
  idx: number,
): { line: number; column: number; offset: number } {
  const before = src.slice(0, idx);
  const lines = before.split('\n');
  return {
    line: lines.length,
    column: (lines[lines.length - 1]?.length ?? 0) + 1,
    offset: idx,
  };
}

export function findEdgeOp(
  src: string,
  pattern: RegExp,
): { line: number; column: number; offset: number } {
  const idx = Stripper.strip(src).search(pattern);
  return idx === -1 ? { line: 1, column: 1, offset: 0 } : offsetToLineCol(src, idx);
}

/** @throws ParseError if the wrong edge operator is found. */
export function validateEdgeOperators(src: string, directed: boolean): void {
  const stripped = Stripper.strip(src);
  if (directed && /--(?!>)/.test(stripped)) {
    const loc = findEdgeOp(src, /--(?!>)/);
    throw new ParseError(
      "undirected edge operator '--' is not allowed in a digraph; use '->'",
      'EDGE_OP_UNDIRECTED_IN_DIRECTED',
      loc,
    );
  }
  if (!directed && /->/.test(stripped)) {
    const loc = findEdgeOp(src, /->/);
    throw new ParseError(
      "directed edge operator '->' is not allowed in an undirected graph; use '--'",
      'EDGE_OP_DIRECTED_IN_UNDIRECTED',
      loc,
    );
  }
}

// ── Peggy error unwrapping ────────────────────────────────────────────────────

export function isPeggyError(err: unknown): err is {
  location: { start: { line: number; column: number; offset: number } };
  expected: GvExpectation[];
  found: string | null;
} {
  if (err === null || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  if (typeof e['location'] !== 'object' || e['location'] === null) return false;
  return 'start' in (e['location'] as object);
}

// ── Public parse ──────────────────────────────────────────────────────────────

/**
 * Parse a DOT-language string and return a Graph model.
 * @throws ParseError for syntax errors or edge-direction violations.
 */
export function parse(src: string): Graph {
  if (typeof src !== 'string') {
    // Runtime guard for JS callers (the TS signature already forbids this):
    // a non-string argument must not surface as an opaque internal TypeError.
    throw new ParseError('DOT source must be a string', 'GENERIC_ERROR', {
      line: 1,
      column: 1,
      offset: 0,
    });
  }
  let ast: ParsedGraph;
  try {
    ast = peggyParse(src) as ParsedGraph;
  } catch (err: unknown) {
    if (isPeggyError(err)) {
      const start = err.location.start;
      const code: GvErrorCode =
        err.found === null ? 'SYNTAX_UNEXPECTED_EOF' : 'SYNTAX_ERROR';
      throw new ParseError(
        err instanceof Error ? err.message : String(err),
        code,
        { line: start.line, column: start.column, offset: start.offset },
        err.expected,
      );
    }
    // Deeply-nested input overflows the recursive-descent parser's call stack;
    // honor the documented ParseError contract instead of leaking a raw
    // RangeError. @see ~/.claude/rules/security.md (bound untrusted input)
    if (err instanceof RangeError) {
      throw new ParseError(
        'DOT source is too deeply nested to parse',
        'GENERIC_ERROR',
        { line: 1, column: 1, offset: 0 },
      );
    }
    throw err;
  }
  validateEdgeOperators(src, ast.directed);
  return buildFromAst(ast);
}

// ── Serializer ────────────────────────────────────────────────────────────────

export function dotKeyword(kind: GraphKind): string {
  if (kind === 'directed') return 'digraph';
  if (kind === 'strict-directed') return 'strict digraph';
  if (kind === 'undirected') return 'graph';
  return 'strict graph';
}

export function quoteId(id: string): string {
  const rName = new RegExp('^[A-Za-z_\\x80-\\xFF][A-Za-z_0-9\\x80-\\xFF]*$');
  const rNum  = new RegExp('^-?(\\d+(\\.\\d*)?|\\.\\d+)$');
  if (rName.test(id)) return id;
  if (rNum.test(id)) return id;
  return '"' + id.replace(/[\\]/g, '\\\\').replace(/["]/g, '\\"') + '"';
}

export function attrMapStr(attrs: Map<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of attrs) {
    const val = isHtmlValue(v) ? `<${htmlValueContent(v)}>` : quoteId(v);
    parts.push(`${quoteId(k)}=${val}`);
  }
  return parts.join(', ');
}

export function serializeHeader(g: Graph): string[] {
  const nameStr = g.name ? ` ${quoteId(g.name)}` : '';
  const keyword = g.parent !== null ? 'subgraph' : dotKeyword(g.kind);
  const lines = [`${keyword}${nameStr} {`];
  for (const [k, v] of g.attrs) lines.push(`  ${quoteId(k)}=${quoteId(v)};`);
  if (g.nodeDefaults.size > 0) lines.push(`  node [${attrMapStr(g.nodeDefaults)}];`);
  if (g.edgeDefaults.size > 0) lines.push(`  edge [${attrMapStr(g.edgeDefaults)}];`);
  return lines;
}

/** True when a child subgraph also contains the node (it will be written there). */
export function nodeInChildSubgraph(g: Graph, name: string): boolean {
  for (const [, sg] of g.subgraphs) if (sg.nodes.has(name)) return true;
  return false;
}

/** True when a child subgraph also contains the edge (it will be written there). */
export function edgeInChildSubgraph(g: Graph, edge: Edge): boolean {
  for (const [, sg] of g.subgraphs) if (sg.edges.includes(edge)) return true;
  return false;
}

export function serializeNodes(g: Graph): string[] {
  const lines: string[] = [];
  for (const [, node] of g.nodes) {
    if (nodeInChildSubgraph(g, node.name)) continue;
    const q = quoteId(node.name);
    if (node.attrs.size > 0) lines.push(`  ${q} [${attrMapStr(node.attrs)}];`);
    else lines.push(`  ${q};`);
  }
  return lines;
}

export function serializeEdges(g: Graph): string[] {
  const op = (g.kind === 'directed' || g.kind === 'strict-directed') ? '->' : '--';
  const lines: string[] = [];
  for (const edge of g.edges) {
    if (edgeInChildSubgraph(g, edge)) continue;
    const attr = edge.attrs.size > 0 ? ` [${attrMapStr(edge.attrs)}]` : '';
    lines.push(`  ${quoteId(edge.tail.name)} ${op} ${quoteId(edge.head.name)}${attr};`);
  }
  return lines;
}

export function serializeSubgraphs(g: Graph): string[] {
  const lines: string[] = [];
  for (const [, sg] of g.subgraphs) {
    for (const line of serialize(sg).split('\n')) lines.push(`  ${line}`);
  }
  return lines;
}

/**
 * Serialize a Graph to DOT syntax for round-trip verification.
 * Node/edge counts and attribute values are preserved.
 */
export function serialize(g: Graph): string {
  return [
    ...serializeHeader(g),
    ...serializeNodes(g),
    ...serializeEdges(g),
    ...serializeSubgraphs(g),
    '}',
  ].join('\n');
}
