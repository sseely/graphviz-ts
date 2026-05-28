// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { HtmlParseError, parseHtmlLabel, sizeHtmlLabel } from './htmltable.js';
import type { TextMeasurer } from './htmltable.js';

const mockMeasurer: TextMeasurer = {
  measure: (text, _font, fontSize) => ({
    w: text.length * fontSize * 0.6,
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
