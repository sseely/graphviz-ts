// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, serialize, ParseError } from './index.js';
import { isHtmlValue, htmlValueContent } from '../common/html-string.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fix = (name: string): string =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

// ── Fixture parsing ──────────────────────────────────────────────────────────

describe('fixture: simple.dot (undirected)', () => {
  it('parses without error', () => {
    expect(() => parse(fix('simple.dot'))).not.toThrow();
  });

  it('has correct node count and edge count', () => {
    const g = parse(fix('simple.dot'));
    expect(g.nodes.size).toBe(3);
    expect(g.edges.length).toBe(2);
  });

  it('is undirected and not strict', () => {
    const g = parse(fix('simple.dot'));
    expect(g.kind).toMatch(/^undirected/);
    expect(g.kind).not.toMatch(/strict/);
  });

  it('preserves node attributes as strings', () => {
    const g = parse(fix('simple.dot'));
    expect(g.nodes.get('a')?.attrs.get('label')).toBe('Node A');
    expect(g.nodes.get('a')?.attrs.get('color')).toBe('blue');
  });
});

describe('fixture: directed.dot (digraph)', () => {
  it('parses without error', () => {
    expect(() => parse(fix('directed.dot'))).not.toThrow();
  });

  it('has correct node count and edge count', () => {
    const g = parse(fix('directed.dot'));
    expect(g.nodes.size).toBe(4);
    expect(g.edges.length).toBe(4);
  });

  it('is directed', () => {
    const g = parse(fix('directed.dot'));
    expect(g.kind).toMatch(/directed/);
  });

  it('preserves edge attributes as strings', () => {
    const g = parse(fix('directed.dot'));
    const ab = g.edges.find(e => e.tail.name === 'a' && e.head.name === 'b');
    expect(ab?.attrs.get('weight')).toBe('2');
  });
});

describe('fixture: subgraph.dot (clustered digraph)', () => {
  it('parses without error', () => {
    expect(() => parse(fix('subgraph.dot'))).not.toThrow();
  });

  it('has correct top-level node and edge counts', () => {
    const g = parse(fix('subgraph.dot'));
    expect(g.nodes.size).toBe(4);
    expect(g.edges.length).toBe(3);
  });

  it('creates subgraph entries', () => {
    const g = parse(fix('subgraph.dot'));
    expect(g.subgraphs.size).toBeGreaterThan(0);
  });

  it('applies node defaults from attr statements', () => {
    const g = parse(fix('subgraph.dot'));
    expect(g.nodeDefaults.get('shape')).toBe('box');
  });

  it('applies edge defaults from attr statements', () => {
    const g = parse(fix('subgraph.dot'));
    expect(g.edgeDefaults.get('style')).toBe('dashed');
  });
});

// ── Round-trip ───────────────────────────────────────────────────────────────

describe('round-trip fidelity', () => {
  for (const name of ['simple.dot', 'directed.dot', 'subgraph.dot']) {
    it(`round-trip for ${name}`, () => {
      const g1 = parse(fix(name));
      const dot = serialize(g1);
      const g2 = parse(dot);
      expect(g2.nodes.size).toBe(g1.nodes.size);
      expect(g2.edges.length).toBe(g1.edges.length);
      for (const [id, n1] of g1.nodes) {
        const n2 = g2.nodes.get(id);
        expect(n2).toBeDefined();
        for (const [k, v] of n1.attrs) {
          expect(n2?.attrs.get(k)).toBe(v);
        }
      }
    });
  }
});

// ── ParseError ───────────────────────────────────────────────────────────────

describe('ParseError', () => {
  it('throws ParseError with line >= 1 and column >= 1 for malformed input', () => {
    let err: ParseError | undefined;
    try { parse('digraph { a ->'); } catch (e) { err = e as ParseError; }
    expect(err).toBeInstanceOf(ParseError);
    expect(err!.line).toBeGreaterThanOrEqual(1);
    expect(err!.column).toBeGreaterThanOrEqual(1);
  });

  it('throws ParseError for unclosed brace', () => {
    expect(() => parse('graph { a -- b')).toThrow(ParseError);
  });
});

// ── ParseError structured contract ───────────────────────────────────────────

function parseErr(src: string): ParseError {
  try { parse(src); } catch (e) { return e as ParseError; }
  throw new Error('expected parse to throw');
}

describe('ParseError syntax classification', () => {
  it('classifies an unexpected-EOF syntax error with offset', () => {
    const err = parseErr('digraph { a ->');
    expect(err.type).toBe('syntax');
    expect(err.code).toBe('SYNTAX_UNEXPECTED_EOF');
    expect(typeof err.location.offset).toBe('number');
    expect(err.friendlyMessage.length).toBeGreaterThan(0);
  });

  it('classifies a token-level syntax error and surfaces peggy expected[]', () => {
    const err = parseErr('digraph { @ }');
    expect(err.code).toBe('SYNTAX_ERROR');
    expect(Array.isArray(err.expected)).toBe(true);
    expect(typeof err.expected![0]!.type).toBe('string');
  });

  it('mirrors line/column getters onto location', () => {
    const err = parseErr('digraph { a ->');
    expect(err.line).toBe(err.location.line);
    expect(err.column).toBe(err.location.column);
  });
});

describe('ParseError edge-operator classification', () => {
  it('codes the edge-op directed-in-undirected case with offset', () => {
    const err = parseErr('graph g { a -> b }');
    expect(err.code).toBe('EDGE_OP_DIRECTED_IN_UNDIRECTED');
    expect(typeof err.location.offset).toBe('number');
  });

  it('codes the edge-op undirected-in-directed case', () => {
    const err = parseErr('digraph g { a -- b }');
    expect(err.code).toBe('EDGE_OP_UNDIRECTED_IN_DIRECTED');
  });
});

// ── Edge direction validation ────────────────────────────────────────────────

describe('edge direction validation', () => {
  it('throws ParseError for -> in undirected graph', () => {
    expect(() => parse('graph g { a -> b }')).toThrow(ParseError);
  });

  it('throws ParseError for -- in digraph', () => {
    expect(() => parse('digraph g { a -- b }')).toThrow(ParseError);
  });

  it('accepts -> in digraph', () => {
    expect(() => parse('digraph g { a -> b }')).not.toThrow();
  });

  it('accepts -- in undirected graph', () => {
    expect(() => parse('graph g { a -- b }')).not.toThrow();
  });
});

// ── Attribute coercion ───────────────────────────────────────────────────────

describe('attribute string coercion', () => {
  it('stores numeric-looking values as string', () => {
    const g = parse('graph { a [width=1.5, fontsize=12] }');
    expect(typeof g.nodes.get('a')?.attrs.get('width')).toBe('string');
    expect(g.nodes.get('a')?.attrs.get('width')).toBe('1.5');
    expect(g.nodes.get('a')?.attrs.get('fontsize')).toBe('12');
  });
});

// ── strict and directed flags ────────────────────────────────────────────────

describe('strict digraph', () => {
  it('sets kind to strict-directed', () => {
    const g = parse('strict digraph g { a -> b }');
    expect(g.kind).toBe('strict-directed');
  });

  it('strict undirected sets kind to strict-undirected', () => {
    const g = parse('strict graph g { a -- b }');
    expect(g.kind).toBe('strict-undirected');
  });
});

// ── HTML labels ──────────────────────────────────────────────────────────────

describe('HTML label preservation', () => {
  it('preserves HTML label content and marks it as HTML', () => {
    const src = 'graph { a [label=<<B>hello</B>>] }';
    const g = parse(src);
    const label = g.nodes.get('a')?.attrs.get('label');
    expect(label).toBeDefined();
    expect(isHtmlValue(label!)).toBe(true);
    expect(htmlValueContent(label!)).toBe('<B>hello</B>');
  });

  it('does not mark quoted labels as HTML', () => {
    const g = parse('graph { a [label="<B>hello</B>"] }');
    expect(isHtmlValue(g.nodes.get('a')!.attrs.get('label')!)).toBe(false);
  });
});
