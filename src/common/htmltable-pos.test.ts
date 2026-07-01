// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for font-flag propagation in htmltable-pos.ts:
 * itemFontFlags, buildLineRuns, and placeRunItems must carry
 * HTML_BF/HTML_IF/HTML_UL/HTML_S/HTML_OL/HTML_SUP/HTML_SUB from
 * HtmlTextItem into PlacedLine.fontFlags.
 */

import { describe, it, expect, vi } from 'vitest';
import type { TextMeasurer } from './textmeasure.js';
import type { HtmlText, HtmlTextItem } from './htmltable-types.js';
import {
  itemFontFlags,
  buildLineRuns,
  placeRunItems,
  posHtmlLabel,
  makeHtmlLabel,
} from './htmltable-pos.js';
import type { PlacedHtml } from './htmltable-pos.js';
import { parseHtmlLabel, sizeHtmlLabel } from './htmltable.js';
import { portToTbl } from './htmltable-port.js';
import {
  HTML_BF, HTML_IF, HTML_UL, HTML_S, HTML_OL, HTML_SUP, HTML_SUB,
} from './emit-types.js';

// ---------------------------------------------------------------------------
// Shared stubs
// ---------------------------------------------------------------------------

const stubMeasurer: TextMeasurer = {
  measure: vi.fn().mockReturnValue({ w: 10, h: 12 }),
};

function makeText(items: HtmlTextItem[]): HtmlText {
  return { kind: 'text', items };
}

const defaultFinfo = { fontname: 'Times,serif', fontsize: 12, fontcolor: 'black' };

// ---------------------------------------------------------------------------
// itemFontFlags test bodies
// ---------------------------------------------------------------------------

export function testFlagsPlain(): void {
  expect(itemFontFlags({ text: 'hi' })).toBe(0);
}

export function testFlagsBold(): void {
  expect(itemFontFlags({ bold: true })).toBe(HTML_BF);
}

export function testFlagsItalic(): void {
  expect(itemFontFlags({ italic: true })).toBe(HTML_IF);
}

export function testFlagsUnderline(): void {
  expect(itemFontFlags({ underline: true })).toBe(HTML_UL);
}

export function testFlagsStrike(): void {
  expect(itemFontFlags({ strikethrough: true })).toBe(HTML_S);
}

export function testFlagsOverline(): void {
  expect(itemFontFlags({ overline: true })).toBe(HTML_OL);
}

export function testFlagsSup(): void {
  expect(itemFontFlags({ superscript: true })).toBe(HTML_SUP);
}

export function testFlagsSub(): void {
  expect(itemFontFlags({ subscript: true })).toBe(HTML_SUB);
}

export function testFlagsCombined(): void {
  expect(itemFontFlags({ bold: true, italic: true })).toBe(HTML_BF | HTML_IF);
}

// ---------------------------------------------------------------------------
// buildLineRuns test bodies
// ---------------------------------------------------------------------------

export function testBuildRunsPassesBoldItalicToMeasurer(): void {
  const meas: TextMeasurer = { measure: vi.fn().mockReturnValue({ w: 8, h: 12 }) };
  const text = makeText([{ text: 'hi', bold: true, italic: true }]);
  buildLineRuns([text], defaultFinfo, meas);
  expect(meas.measure).toHaveBeenCalledWith(
    'hi', 'Times,serif', 12, { bold: true, italic: true },
  );
}

export function testBuildRunsPassesNoFlagsForPlainItem(): void {
  const meas: TextMeasurer = { measure: vi.fn().mockReturnValue({ w: 8, h: 12 }) };
  const text = makeText([{ text: 'hi' }]);
  buildLineRuns([text], defaultFinfo, meas);
  expect(meas.measure).toHaveBeenCalledWith(
    'hi', 'Times,serif', 12, { bold: false, italic: false },
  );
}

export function testBuildRunsAccumulatesWidth(): void {
  const text = makeText([{ text: 'a', bold: true }, { text: 'b' }]);
  const runs = buildLineRuns([text], defaultFinfo, stubMeasurer);
  expect(runs).toHaveLength(1);
  expect(runs[0]!.width).toBe(20);
}

// ---------------------------------------------------------------------------
// placeRunItems test bodies
// ---------------------------------------------------------------------------

export function testPlaceRunPlainFlagsZero(): void {
  const run = { items: [{ text: 'hi' }] as HtmlTextItem[], width: 10, fontSize: 12, height: 12, maxOffset: 0.6, maxLayout: 0 };
  const lines = placeRunItems(run, 0, 0, defaultFinfo, stubMeasurer);
  expect(lines[0]!.fontFlags).toBe(0);
}

export function testPlaceRunBoldFlag(): void {
  const run = { items: [{ text: 'hi', bold: true }] as HtmlTextItem[], width: 10, fontSize: 12, height: 12, maxOffset: 0.6, maxLayout: 0 };
  const lines = placeRunItems(run, 0, 0, defaultFinfo, stubMeasurer);
  expect(lines[0]!.fontFlags).toBe(HTML_BF);
}

export function testPlaceRunItalicFlag(): void {
  const run = { items: [{ text: 'hi', italic: true }] as HtmlTextItem[], width: 10, fontSize: 12, height: 12, maxOffset: 0.6, maxLayout: 0 };
  const lines = placeRunItems(run, 0, 0, defaultFinfo, stubMeasurer);
  expect(lines[0]!.fontFlags).toBe(HTML_IF);
}

export function testPlaceRunUnderlineFlag(): void {
  const run = { items: [{ text: 'hi', underline: true }] as HtmlTextItem[], width: 10, fontSize: 12, height: 12, maxOffset: 0.6, maxLayout: 0 };
  const lines = placeRunItems(run, 0, 0, defaultFinfo, stubMeasurer);
  expect(lines[0]!.fontFlags).toBe(HTML_UL);
}

export function testPlaceRunCombinedFlags(): void {
  const run = { items: [{ text: 'hi', bold: true, italic: true }] as HtmlTextItem[], width: 10, fontSize: 12, height: 12, maxOffset: 0.6, maxLayout: 0 };
  const lines = placeRunItems(run, 0, 0, defaultFinfo, stubMeasurer);
  expect(lines[0]!.fontFlags).toBe(HTML_BF | HTML_IF);
}

export function testPlaceRunFontColorFromFinfo(): void {
  const run = { items: [{ text: 'hi' }] as HtmlTextItem[], width: 10, fontSize: 12, height: 12, maxOffset: 0.6, maxLayout: 0 };
  const lines = placeRunItems(run, 0, 0, defaultFinfo, stubMeasurer);
  expect(lines[0]!.fontColor).toBe('black');
}

export function testPlaceRunFontColorFromItem(): void {
  const run = { items: [{ text: 'hi', fontColor: 'red' }] as HtmlTextItem[], width: 10, fontSize: 12, height: 12, maxOffset: 0.6, maxLayout: 0 };
  const lines = placeRunItems(run, 0, 0, defaultFinfo, stubMeasurer);
  expect(lines[0]!.fontColor).toBe('red');
}

// ---------------------------------------------------------------------------
// describe / it registrations
// ---------------------------------------------------------------------------

describe('itemFontFlags', () => {
  it('returns 0 for a plain item', testFlagsPlain);
  it('sets HTML_BF for bold', testFlagsBold);
  it('sets HTML_IF for italic', testFlagsItalic);
  it('sets HTML_UL for underline', testFlagsUnderline);
  it('sets HTML_S for strikethrough', testFlagsStrike);
  it('sets HTML_OL for overline', testFlagsOverline);
  it('sets HTML_SUP for superscript', testFlagsSup);
  it('sets HTML_SUB for subscript', testFlagsSub);
  it('combines bold+italic flags', testFlagsCombined);
});

describe('buildLineRuns font flags', () => {
  it('passes bold+italic to measurer', testBuildRunsPassesBoldItalicToMeasurer);
  it('passes no flags for plain item', testBuildRunsPassesNoFlagsForPlainItem);
  it('accumulates width across items', testBuildRunsAccumulatesWidth);
});

describe('placeRunItems fontFlags', () => {
  it('fontFlags=0 for plain item', testPlaceRunPlainFlagsZero);
  it('fontFlags=HTML_BF for bold', testPlaceRunBoldFlag);
  it('fontFlags=HTML_IF for italic', testPlaceRunItalicFlag);
  it('fontFlags=HTML_UL for underline', testPlaceRunUnderlineFlag);
  it('fontFlags=HTML_BF|HTML_IF for bold+italic', testPlaceRunCombinedFlags);
  it('fontColor from finfo when item has none', testPlaceRunFontColorFromFinfo);
  it('fontColor from item overrides finfo', testPlaceRunFontColorFromItem);
});

// Nested HTML table: a cell whose child is a <TABLE> must be POSITIONED
// (placeCell recurses posHtmlTable into the cell's inset box) and carry its
// port, so emit and html_port can reach it.
// @see lib/common/htmltable.c:pos_html_cell (HTML_TBL branch)
describe('nested table is placed inside its parent cell', () => {
  it('placed outer cell carries a nested PlacedHtml with the inner cell + port', () => {
    const lbl = parseHtmlLabel(
      '<TABLE><TR><TD>L</TD><TD>' +
      '<TABLE PORT="inner"><TR><TD>RT</TD></TR><TR><TD>RB</TD></TR></TABLE>' +
      '</TD></TR></TABLE>',
    );
    sizeHtmlLabel(lbl, stubMeasurer);
    const finfo = { fontname: 'Times', fontsize: 14, fontcolor: 'black' };
    const placed = posHtmlLabel(lbl, finfo, stubMeasurer);
    const outerCells = placed.cells;
    const nestedHost = outerCells.find((c) => c.nested !== undefined);
    expect(nestedHost).toBeDefined();
    expect(nestedHost!.lines.length).toBe(0); // text path not taken
    expect(nestedHost!.nested!.port).toBe('inner');
    expect(nestedHost!.nested!.cells.length).toBe(2); // RT + RB
  });
});

// html_port resolution: portToTbl walks the placed tree (incl. nested tables)
// to find a named port, returning its node-relative box + boundary sides.
// @see lib/common/htmltable.c:portToTbl / portToCell
describe('portToTbl resolves named ports in the placed tree', () => {
  const finfo = { fontname: 'Times', fontsize: 14, fontcolor: 'black' };
  function place(src: string) {
    const lbl = parseHtmlLabel(src);
    sizeHtmlLabel(lbl, stubMeasurer);
    return posHtmlLabel(lbl, finfo, stubMeasurer);
  }

  it('finds a top-level cell port', () => {
    const placed = place('<TABLE><TR><TD PORT="L">L</TD><TD>R</TD></TR></TABLE>');
    const hit = portToTbl(placed, 'L');
    expect(hit).not.toBeNull();
    // left cell: its box LL.x is the table-left side
    expect(hit!.box.ll.x).toBeLessThan(placed.box.ur.x);
  });

  it('finds a port on a nested table (recursive)', () => {
    const placed = place(
      '<TABLE><TR><TD>L</TD><TD>' +
      '<TABLE PORT="inner"><TR><TD>RT</TD></TR></TABLE></TD></TR></TABLE>',
    );
    const hit = portToTbl(placed, 'inner');
    expect(hit).not.toBeNull();
    expect(hit!.sides).toBeGreaterThan(0);
  });

  it('is case-insensitive and returns null for an unknown port', () => {
    const placed = place('<TABLE><TR><TD PORT="MyPort">x</TD></TR></TABLE>');
    expect(portToTbl(placed, 'myport')).not.toBeNull();
    expect(portToTbl(placed, 'nope')).toBeNull();
  });
});

describe('makeHtmlLabel — pen-color inheritance (D2)', () => {
  // C defaults a table's pencolor to getPenColor(obj) then copies
  // parent->child, so a cell BORDER with no COLOR inherits the node color.
  // @see lib/common/htmltable.c:1911 (top table), :1406 (cell), :1556 (nested)
  const meas: TextMeasurer = { measure: vi.fn().mockReturnValue({ w: 8, h: 12 }) };
  const font = { fontname: 'Arial', fontsize: 8, fontcolor: 'black' };
  const cells = (content: string, pencolor?: string) => {
    const lbl = makeHtmlLabel(content, { ...font, pencolor }, meas);
    return (lbl.u as { kind: 'html'; html: PlacedHtml }).html.cells;
  };

  it('a cell with no COLOR inherits the object pen color', () => {
    const c = cells('<TABLE BORDER="0"><TR><TD BORDER="1">x</TD></TR></TABLE>', 'red');
    expect(c[0]!.color).toBe('red');
  });

  it('an explicit cell COLOR wins over the inherited pen color', () => {
    const c = cells('<TABLE><TR><TD BORDER="1" COLOR="blue">x</TD></TR></TABLE>', 'red');
    expect(c[0]!.color).toBe('blue');
  });

  it('no pen color leaves the cell color unset (emit defaults to black)', () => {
    const c = cells('<TABLE><TR><TD BORDER="1">x</TD></TR></TABLE>', undefined);
    expect(c[0]!.color).toBeUndefined();
  });
});
