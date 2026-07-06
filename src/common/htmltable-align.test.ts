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

// BALIGN sets the default per-line justification within a cell's multi-line
// text block (pos_html_txt, htmltable.c:1541). A BR with no ALIGN leaves its
// line UNSET, which then inherits the cell's BALIGN. Distinct from HALIGN,
// which positions the whole block. Regression: 2619_1/2619_2 (BALIGN="LEFT"
// genealogy cards) centered each line instead of flushing left.
const balignCell = (balign: string) =>
  `digraph{ n[shape=none, label=<<TABLE BORDER="0">` +
  `<TR><TD BALIGN="${balign}">WIDEWIDEWIDE<BR/>x</TD></TR></TABLE>>]; }`;

describe('HTML table cell BALIGN (per-line justification)', () => {
  it('BALIGN="left": the short second line flushes left, level with line 1', () => {
    const [wide, narrow] = textXs(balignCell('left'));
    expect(narrow).toBeCloseTo(wide, 1);
  });

  it('unset BALIGN: the short second line is centered (x greater than line 1)', () => {
    const [wide, narrow] = textXs(balignCell('center'));
    expect(narrow).toBeGreaterThan(wide);
  });

  it('BALIGN="right": the short second line flushes right (x > centered)', () => {
    const [, narrowRight] = textXs(balignCell('right'));
    const [, narrowCenter] = textXs(balignCell('center'));
    expect(narrowRight).toBeGreaterThan(narrowCenter);
  });
});

// A cell whose text block is "non-simple" (a line with >1 item / mixed fonts)
// is centered using the sum of raw max font sizes (mxfsize), not measured line
// heights (size_html_txt: lsize = simple ? mxysize : mxfsize). Here line 2
// ("Sub" 10pt + a trailing default-14pt space) makes the block non-simple, and
// the tall HEIGHT=60 cell leaves vertical slack, so a wrong block height
// mis-centers it. Oracle-pinned (native dot 15.1.0): y=-39.2 / -25.4.
// Regression: 2619 I63/I64 genealogy cards were centered 1.5pt too high.
describe('HTML cell — non-simple multi-line vertical centering', () => {
  const nonSimpleTall =
    'digraph { n [shape=plaintext, label=<<TABLE BORDER="0" CELLBORDER="0">' +
    '<TR><TD HEIGHT="60" VALIGN="MIDDLE"><FONT POINT-SIZE="12">Name Here</FONT>' +
    '<BR/><FONT POINT-SIZE="10">Sub</FONT>  </TD></TR></TABLE>>]; }';

  it('centers the block by mxfsize height (native: y=-39.2 / -25.4)', () => {
    const ys = [...renderSvg(nonSimpleTall, 'dot')
      .matchAll(/<text[^>]*\by="([-\d.]+)"/g)].map((m) => Number(m[1]));
    expect(ys[0]).toBeCloseTo(-39.2, 2); // first line
    expect(ys[1]).toBeCloseTo(-25.4, 2); // second line + trailing 14pt space
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
