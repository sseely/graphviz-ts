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

// C zeroes only the content-derived term for a FIXEDSIZE table with both WIDTH
// and HEIGHT, so the box takes the explicit dims (fmax(0, width)). The port
// previously set the table dimen to 0, collapsing it to content size.
// @see lib/common/htmltable.c:1678-1693
describe('HTML table FIXEDSIZE', () => {
  const canvasW = (dot: string): number => {
    const svg = renderSvg(dot, 'dot');
    return Number(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+) /.exec(svg)![1]);
  };
  const tbl = (extra: string) =>
    `digraph{ n[shape=plaintext, label=<<TABLE BORDER="0" ${extra}><TR><TD>x</TD></TR></TABLE>>]; }`;

  it('a FIXEDSIZE table honors its explicit WIDTH/HEIGHT (not content size)', () => {
    const fixed = canvasW(tbl('FIXEDSIZE="TRUE" WIDTH="200" HEIGHT="100"'));
    const content = canvasW(tbl(''));
    expect(fixed).toBeGreaterThan(content + 100); // ~224 vs ~62
  });
});
