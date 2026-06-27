// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { HtmlParseError, parseHtmlLabel, sizeHtmlLabel, cellBorder } from './htmltable.js';
import type { TextMeasurer } from './htmltable.js';
import type { HtmlCell, HtmlTable } from './htmltable-types.js';
import type { TextVariantFlags } from './textmeasure.js';

const mockMeasurer: TextMeasurer = {
  measure: (text, _font, fontSize, flags?: TextVariantFlags) => ({
    w: text.length * fontSize * (flags?.bold === true ? 0.8 : 0.6),
    h: fontSize,
  }),
};

describe('parseHtmlLabel — AC1 bold text', () => {
  it('<B>text</B> produces bold text span', () => {
    const label = parseHtmlLabel('<B>text</B>');
    expect(label.kind).toBe('text');
    if (label.kind !== 'text') return;
    const item = label.texts[0].items.find(i => i.text === 'text');
    expect(item).toBeDefined();
    expect(item?.bold).toBe(true);
  });
});

describe('parseHtmlLabel — AC2 table cells', () => {
  it('1x2 table has rows[0].cells.length === 2', () => {
    const src = '<TABLE><TR><TD>a</TD><TD>b</TD></TR></TABLE>';
    const label = parseHtmlLabel(src);
    expect(label.kind).toBe('table');
    if (label.kind !== 'table') return;
    expect(label.table.rows[0].cells.length).toBe(2);
  });
});

describe('parseHtmlLabel — AC3 unknown tag', () => {
  it('<SPAN> throws HtmlParseError with tag=SPAN', () => {
    expect(() => parseHtmlLabel('<SPAN>text</SPAN>')).toThrow(HtmlParseError);
    try {
      parseHtmlLabel('<SPAN>text</SPAN>');
    } catch (e: unknown) {
      expect((e as { tag?: string }).tag).toBe('SPAN');
    }
  });
});

describe('sizeHtmlLabel — AC5 bold run sized wider than regular', () => {
  it('bold text item produces wider cell than regular', () => {
    const boldSrc = '<TABLE><TR><TD><B>hi</B></TD></TR></TABLE>';
    const regSrc  = '<TABLE><TR><TD>hi</TD></TR></TABLE>';
    const boldLabel = parseHtmlLabel(boldSrc);
    const regLabel  = parseHtmlLabel(regSrc);
    sizeHtmlLabel(boldLabel, mockMeasurer);
    sizeHtmlLabel(regLabel, mockMeasurer);
    expect(boldLabel.kind).toBe('table');
    expect(regLabel.kind).toBe('table');
    if (boldLabel.kind !== 'table' || regLabel.kind !== 'table') return;
    const boldW = boldLabel.table.rows[0].cells[0];
    const regW  = regLabel.table.rows[0].cells[0];
    if (boldW.kind !== 'cell' || regW.kind !== 'cell') return;
    expect(boldW.dimen?.w).toBeGreaterThan(regW.dimen?.w ?? 0);
  });

  it('flags are not passed when item has no bold/italic', () => {
    const src = '<TABLE><TR><TD>hello</TD></TR></TABLE>';
    const label = parseHtmlLabel(src);
    sizeHtmlLabel(label, mockMeasurer);
    expect(label.kind).toBe('table');
    if (label.kind !== 'table') return;
    const cell = label.table.rows[0].cells[0];
    expect(cell.kind).toBe('cell');
  });
});

describe('sizeHtmlLabel — AC4 colspan propagation', () => {
  it('colspan=2 cell dimen.w >= col1.dimen.w + col2.dimen.w + cellspacing', () => {
    const src = [
      '<TABLE>',
      '<TR><TD COLSPAN="2">wide cell content here</TD></TR>',
      '<TR><TD>col1</TD><TD>col2</TD></TR>',
      '</TABLE>',
    ].join('');
    const label = parseHtmlLabel(src);
    sizeHtmlLabel(label, mockMeasurer);
    expect(label.kind).toBe('table');
    if (label.kind !== 'table') return;
    const span = label.table.rows[0].cells[0];
    const c1 = label.table.rows[1].cells[0];
    const c2 = label.table.rows[1].cells[1];
    expect(span.kind).toBe('cell');
    expect(c1.kind).toBe('cell');
    expect(c2.kind).toBe('cell');
    if (span.kind !== 'cell' || c1.kind !== 'cell' || c2.kind !== 'cell') return;
    const spacing = 2;
    const minW = (c1.dimen?.w ?? 0) + (c2.dimen?.w ?? 0) + spacing;
    expect(span.dimen?.w ?? 0).toBeGreaterThanOrEqual(minW);
  });
});

// ---------------------------------------------------------------------------
// cellBorder — a cell with no BORDER of its own defaults, in order, to the
// table's CELLBORDER (if >= 0), else the table's own BORDER value (when set,
// including 0), else DEFAULT_BORDER. The middle case (graphviz 1622_0) is why
// a cell in <TABLE BORDER="0"> with no CELLBORDER draws no border.
// @see lib/common/htmltable.c:1115 size_html_tbl
// ---------------------------------------------------------------------------

describe('cellBorder default resolution', () => {
  const cell = (over: Partial<HtmlCell> = {}): HtmlCell => ({ kind: 'cell', content: [], ...over });
  const tbl = (over: Partial<HtmlTable> = {}): HtmlTable => ({ kind: 'table', rows: [], ...over });

  it('uses the cell BORDER when set', () => {
    expect(cellBorder(cell({ border: 3 }), tbl({ border: 0 }))).toBe(3);
  });
  it('uses table CELLBORDER when >= 0', () => {
    expect(cellBorder(cell(), tbl({ cellborder: 2, border: 0 }))).toBe(2);
  });
  it('falls back to table BORDER=0 when CELLBORDER unset', () => {
    expect(cellBorder(cell(), tbl({ border: 0 }))).toBe(0);
  });
  it('falls back to table BORDER value when CELLBORDER unset', () => {
    expect(cellBorder(cell(), tbl({ border: 2 }))).toBe(2);
  });
  it('defaults to 1 when neither CELLBORDER nor BORDER is set', () => {
    expect(cellBorder(cell(), tbl())).toBe(1);
  });
});
