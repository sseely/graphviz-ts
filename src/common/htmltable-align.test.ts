// SPDX-License-Identifier: EPL-2.0

/**
 * HTML table cell alignment. C's pos_html_cell (htmltable.c:1487-1526) shrinks a
 * TD's text box within the cell per HALIGN (left/right/center) and VALIGN
 * (top/bottom/middle); the port previously centered every cell's text
 * unconditionally, so a narrow row under `ALIGN="left"` centered within its
 * (wider) column instead of sitting flush left.
 *
 * @see lib/common/htmltable.c:pos_html_cell
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

/** All `<text x=…>` values in document order. */
function textXs(dot: string): number[] {
  const svg = renderSvg(dot, 'dot');
  return [...svg.matchAll(/<text[^>]*\bx="([-\d.]+)"/g)].map((m) => Number(m[1]));
}

const table = (align: string) =>
  `digraph{ n[shape=none, label=<<TABLE BORDER="0">` +
  `<TR><TD ALIGN="${align}">WIDEWIDEWIDE</TD></TR>` +
  `<TR><TD ALIGN="${align}">x</TD></TR></TABLE>>]; }`;

describe('HTML table cell HALIGN', () => {
  it('ALIGN="left": a narrow row sits flush left, level with the wide row', () => {
    const [wide, narrow] = textXs(table('left'));
    expect(narrow).toBeCloseTo(wide, 1); // both flush left — same x
  });

  it('ALIGN="right": a narrow row sits flush right (x greater than centered)', () => {
    const [, narrowRight] = textXs(table('right'));
    const [, narrowCenter] = textXs(table('center'));
    expect(narrowRight).toBeGreaterThan(narrowCenter);
  });

  it('ALIGN="center": the narrow row is centered (x greater than flush-left)', () => {
    const [wide, narrowCenter] = textXs(table('center'));
    expect(narrowCenter).toBeGreaterThan(wide);
  });
});
