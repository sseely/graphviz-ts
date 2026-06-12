// SPDX-License-Identifier: EPL-2.0

/**
 * Multi-line label splitting + the hinted line-height model.
 * Expected values verified against C graphviz 15.0.0 on 2026-06-12.
 * @see lib/common/labels.c:make_simple_label / storeline
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';
import { splitLabelLines } from './make-label.js';
import { freetypeLineHeight, freetypeAscent } from './textmeasure.js';

describe('splitLabelLines (make_simple_label)', () => {
  it('splits on literal newlines with center justification', () => {
    expect(splitLabelLines('a\nb')).toEqual([
      { text: 'a', just: 'n' }, { text: 'b', just: 'n' },
    ]);
  });

  it('splits on \\l and \\r escapes with their justification', () => {
    expect(splitLabelLines('a\\lb\\rc')).toEqual([
      { text: 'a', just: 'l' }, { text: 'b', just: 'r' }, { text: 'c', just: 'n' },
    ]);
  });
});

describe('freetypeLineHeight — C two-line baseline deltas', () => {
  // height_px = ceil(1825/2048·px) + ceil(443/2048·px), px = fs·4/3
  const expected: Array<[number, number]> = [
    [6, 7.5], [8, 9.75], [12, 14.25], [14, 16.5], [20, 22.5], [48, 54],
  ];
  for (const [fs, h] of expected) {
    it(`fontsize ${fs} → ${h}pt`, () => expect(freetypeLineHeight(fs)).toBe(h));
  }

  it('ascent hints with CEIL (12pt → 15px = 11.25pt)', () => {
    expect(freetypeAscent(12)).toBe(11.25);
  });
});

describe('multiline labels end-to-end (C-verified)', () => {
  it('two lines render as two text elements with the hinted line gap', () => {
    const svg = renderSvg('digraph { A [label="a\\nb" fontsize=20] }', 'dot');
    const ys = [...svg.matchAll(/<text[^>]* y="([-\d.]+)"/g)].map((m) => parseFloat(m[1]!));
    expect(ys).toHaveLength(2);
    expect(ys[1]! - ys[0]!).toBeCloseTo(22.5, 4);
  });

  it('\\l left-justifies within the label block', () => {
    const svg = renderSvg('digraph { A [label="wide line\\lx\\l"] }', 'dot');
    expect(svg).toContain('text-anchor="start"');
  });
});

// ---------------------------------------------------------------------------
// Escape parity: the lexer keeps escapes verbatim (scan.l); consumers
// interpret them. Verified against C graphviz 15.0.0 on 2026-06-12.
// ---------------------------------------------------------------------------

import { parse } from '../parser/index.js';

describe('quoted-string lexing (scan.l: only \\" and \\<newline> transform)', () => {
  const attr = (dot: string): string => {
    const g = parse(dot);
    return [...g.nodes.values()][0]!.attrs.get('label')!;
  };

  it('keeps \\n \\t \\X \\\\ verbatim', () => {
    expect(attr('digraph { A [label="a\\nb\\tc\\qd\\\\e"] }')).toBe('a\\nb\\tc\\qd\\\\e');
  });

  it('converts \\" and drops escaped newlines', () => {
    expect(attr('digraph { A [label="say \\"hi\\" one\\\ntwo"] }')).toBe('say "hi" onetwo');
  });
});

describe('make_simple_label escape interpretation', () => {
  it('drops the backslash from unknown escapes (\\t → t, \\q → q)', () => {
    expect(splitLabelLines('a\\tb\\qc')).toEqual([{ text: 'atbqc', just: 'n' }]);
  });

  it('collapses \\\\ to a single backslash', () => {
    expect(splitLabelLines('a\\\\b')).toEqual([{ text: 'a\\b', just: 'n' }]);
  });

  it('literal \\\\N survives as \\N text after the subst pass leaves it escaped', () => {
    // subst (escBackslash=0) keeps "\\\\N"; the splitter then renders "\\N".
    expect(splitLabelLines('a\\\\Nb')).toEqual([{ text: 'a\\Nb', just: 'n' }]);
  });
});

describe('escape parity end-to-end (C-verified)', () => {
  it('label "a\\tb" renders "atb"', () => {
    expect(renderSvg('digraph { A [label="a\\tb"] }', 'dot')).toContain('>atb</text>');
  });

  it('escaped \\\\N is not substituted', () => {
    expect(renderSvg('digraph { A [label="a\\\\Nb"] }', 'dot')).toContain('>a\\Nb</text>');
  });

  it('node name escapes stay raw in the title and split in the default label', () => {
    const svg = renderSvg('digraph { "a\\nb" }', 'dot');
    expect(svg).toContain('<title>a\\nb</title>');
    expect(svg).toContain('>a</text>');
    expect(svg).toContain('>b</text>');
  });

  it('record fields substitute \\N and split \\n', () => {
    const svg = renderSvg('digraph { R [shape=record label="top\\nbottom | \\N"] }', 'dot');
    expect(svg).toContain('>top</text>');
    expect(svg).toContain('>bottom</text>');
    expect(svg).toContain('>R</text>');
  });
});
