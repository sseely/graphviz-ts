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

/**
 * pgram/xdot regression: a comment character (`#`, `//`, `/*`) INSIDE a quoted
 * string must not be treated as a comment. cgraph's scan.l only recognizes
 * comments in the initial start-condition; inside `qstring` state the `#`/`//`
 * rules never fire. The bug: `Stripper.strip` stripped `#` shell-comments
 * BEFORE strings, so a `#` in a `_draw_="...-#000000..."` color spec blanked the
 * rest of the physical line — including the string's closing `"` — which
 * re-paired the orphaned opening quote with a later string's quote and exposed
 * interior text (e.g. a `-----` node name) as a bare `--` to
 * validateEdgeOperators. xdot output (dense with `-#rrggbb` colors) triggered it.
 *
 * @see lib/cgraph/scan.l:122-123 (`^"#".*` ppDirective, `"#".*` shell comment —
 *   both only in the initial start-condition, not inside qstring)
 */
const XDOT_COLOR_THEN_DASH_NODE =
  'digraph {\n' +
  '  a [_draw_="c 7 -#000000 p 4 1 2 3 4 "];\n' +
  '  "x ----- y";\n' +
  '}\n';

describe('Stripper.strip — comment chars inside strings are not comments', () => {
  it('does not let `#` inside a quoted string eat the closing quote', () => {
    const stripped = Stripper.strip(XDOT_COLOR_THEN_DASH_NODE);
    // The `-----` node name is inside a quoted string, so no bare `--` survives.
    expect(stripped.includes('--')).toBe(false);
  });

  it('parses an xdot-style `#color` draw string followed by a `-----` node name', () => {
    expect(() => parse(XDOT_COLOR_THEN_DASH_NODE)).not.toThrow();
  });

  it('does not let `//` inside a quoted string eat the closing quote', () => {
    const src = 'digraph {\n  a [label="http://ex"];\n  "p ----- q";\n}\n';
    expect(Stripper.strip(src).includes('--')).toBe(false);
    expect(() => parse(src)).not.toThrow();
  });

  it('does not let `/*` inside a quoted string eat the closing quote', () => {
    const src = 'digraph {\n  a [label="/* not a comment"];\n  "p ----- q";\n}\n';
    expect(Stripper.strip(src).includes('--')).toBe(false);
    expect(() => parse(src)).not.toThrow();
  });

  it('still strips a real `#` shell comment outside a string', () => {
    // A `--` hidden in a real comment must NOT reach validateEdgeOperators.
    expect(() => parse('digraph {\n  # a -- b is a comment\n  a -> b\n}')).not.toThrow();
  });

  it('still strips real `//` and block comments outside strings', () => {
    expect(() => parse('digraph {\n  // a -- b\n  /* c -- d */\n  a -> b\n}')).not.toThrow();
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
