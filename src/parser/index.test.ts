// SPDX-License-Identifier: EPL-2.0

/**
 * RC4 regression: `Stripper.strip` must fully consume a quoted string —
 * including a `\<newline>` continuation — so an in-string `--`/`->` never
 * leaks to `validateEdgeOperators` and gets mistaken for an edge operator.
 *
 * The bug: the quoted-string regex used `\\.` (no-newline `.`), so a
 * backslash-newline continuation broke the match and exposed the string's
 * interior. cgraph's scan.l treats `\<newline>` as an ignored continuation
 * and `\"`/`\\` as escapes that never terminate the string.
 *
 * @see lib/cgraph/scan.l qstring rules (\" , \\ , \<newline>)
 * @see plans/errored-cluster/batch-1/T1-parser-string-strip.md
 */

import { describe, it, expect } from 'vitest';
import { parse, Stripper, ParseError } from './index.js';

const MULTILINE_DASH = 'digraph{a[label="x -- y\\\nz"]; a->b}';

// big.gv-style: shape=record label continued with `\`+newline, with `--` inside.
const BIG_GV_STYLE =
  'digraph G {\n' +
  '  struct3 [shape=record,label="hello\\nworld\\n\\\n' +
  'and radiation -- those\\n\\\n' +
  'given together\\n"];\n' +
  '  struct3 -> struct1;\n' +
  '}\n';

describe('Stripper.strip — in-string operators do not leak', () => {
  it('blanks an in-string `--` across a backslash-newline continuation', () => {
    const stripped = Stripper.strip(MULTILINE_DASH);
    expect(stripped.includes('--')).toBe(false);
    expect(stripped.includes('->')).toBe(true); // real top-level op survives
  });

  it('parses a digraph with `--` inside a `\\<newline>`-continued label', () => {
    const g = parse(MULTILINE_DASH);
    expect(g.edges.length).toBe(1);
    expect(g.nodes.size).toBe(2);
  });

  it('parses a big.gv-style record label with `--` in a multi-line string', () => {
    expect(() => parse(BIG_GV_STYLE)).not.toThrow();
    expect(parse(BIG_GV_STYLE).edges.length).toBe(1);
  });

  it('accepts a `->` that appears only inside a string in an undirected graph', () => {
    expect(() => parse('graph{a [label="p -> q"]; a -- b}')).not.toThrow();
  });
});

describe('validateEdgeOperators — real top-level operators still rejected', () => {
  it('rejects a real top-level `--` in a digraph (fix narrows, not removes)', () => {
    let thrown: unknown;
    try {
      parse('digraph{a -- b}');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ParseError);
    expect((thrown as ParseError).code).toBe('EDGE_OP_UNDIRECTED_IN_DIRECTED');
    expect((thrown as ParseError).column).toBeGreaterThan(1); // points at the op
  });

  it('rejects a real top-level `->` in an undirected graph', () => {
    let thrown: unknown;
    try {
      parse('graph{a -> b}');
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ParseError);
    expect((thrown as ParseError).code).toBe('EDGE_OP_DIRECTED_IN_UNDIRECTED');
  });
});
