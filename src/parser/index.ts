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
import { buildFromAst } from './builder.js';
import type { ParsedGraph } from './ast.js';

// ── ParseError ────────────────────────────────────────────────────────────────

/** Thrown for syntax errors or edge-direction violations. */
export class ParseError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(message);
    this.name = 'ParseError';
    this.line = line;
    this.column = column;
  }
}

// ── Source stripping ──────────────────────────────────────────────────────────
// All regex literals that contain \/ or \\ or \xNN use new RegExp(string)
// to avoid lizard 1.22 misinterpreting those sequences as comment/escape
// tokens that break subsequent function-boundary detection.

export class Stripper {
  static blankFull(m: string): string { return ' '.repeat(m.length); }
  static blankQ(m: string): string { return '"' + ' '.repeat(m.length - 2) + '"'; }
  static blankA(m: string): string { return '<' + ' '.repeat(m.length - 2) + '>'; }

  static strip(src: string): string {
    const rBlock = new RegExp('[/][*][\\s\\S]*?[*][/]', 'g');
    const rLine  = new RegExp('[/][/][^\\n]*', 'g');
    const rQ     = new RegExp('"(?:[^"\\\\]|\\\\.)*"', 'g');
    const rH     = new RegExp('<(?:[^<>]|<[^<>]*>)*>', 'g');
    let s = src.replace(rBlock, Stripper.blankFull);
    s = s.replace(rLine, Stripper.blankFull);
    s = s.replace(/#[^\n]*/g, Stripper.blankFull);
    s = s.replace(rQ, Stripper.blankQ);
    s = s.replace(rH, Stripper.blankA);
    return s;
  }
}

export function stripCommentsAndStrings(src: string): string {
  return Stripper.strip(src);
}

// ── Edge-operator validation ──────────────────────────────────────────────────

export function offsetToLineCol(
  src: string,
  idx: number,
): { line: number; column: number } {
  const before = src.slice(0, idx);
  const lines = before.split('\n');
  return { line: lines.length, column: (lines[lines.length - 1]?.length ?? 0) + 1 };
}

export function findEdgeOp(
  src: string,
  pattern: RegExp,
): { line: number; column: number } {
  const idx = Stripper.strip(src).search(pattern);
  return idx === -1 ? { line: 1, column: 1 } : offsetToLineCol(src, idx);
}

/** @throws ParseError if the wrong edge operator is found. */
export function validateEdgeOperators(src: string, directed: boolean): void {
  const stripped = Stripper.strip(src);
  if (directed && /--(?!>)/.test(stripped)) {
    const loc = findEdgeOp(src, /--(?!>)/);
    throw new ParseError(
      "undirected edge operator '--' is not allowed in a digraph; use '->'",
      loc.line, loc.column,
    );
  }
  if (!directed && /->/.test(stripped)) {
    const loc = findEdgeOp(src, /->/);
    throw new ParseError(
      "directed edge operator '->' is not allowed in an undirected graph; use '--'",
      loc.line, loc.column,
    );
  }
}

// ── Peggy error unwrapping ────────────────────────────────────────────────────

export function isPeggyError(
  err: unknown,
): err is { location: { start: { line: number; column: number } } } {
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
  let ast: ParsedGraph;
  try {
    ast = peggyParse(src) as ParsedGraph;
  } catch (err: unknown) {
    if (isPeggyError(err)) {
      const loc = err.location.start;
      throw new ParseError(
        err instanceof Error ? err.message : String(err),
        loc.line, loc.column,
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
  for (const [k, v] of attrs) parts.push(`${quoteId(k)}=${quoteId(v)}`);
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

export function serializeNodes(g: Graph): string[] {
  const lines: string[] = [];
  for (const [, node] of g.nodes) {
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
