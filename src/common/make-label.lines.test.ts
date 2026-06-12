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
