// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for the HTML-like label parser — attribute completeness.
 * @see lib/common/htmlparse.y
 * @see lib/common/htmllex.c attribute tables
 */
import { describe, expect, it } from 'vitest';
import { parseHtmlLabel } from './htmltable-parse.js';
import type { HtmlTable, HtmlCell } from './htmltable-types.js';

/** Extract first table from a parsed label. */
function firstTable(src: string): HtmlTable {
  const lbl = parseHtmlLabel(src);
  if (lbl.kind !== 'table') throw new Error('expected table label');
  return lbl.table;
}

/** Extract first cell from the first row of a table. */
function firstCell(src: string): HtmlCell {
  const tbl = firstTable(src);
  const cell = tbl.rows[0].cells[0];
  if (!cell || cell.kind !== 'cell') throw new Error('expected cell');
  return cell;
}

// ---------------------------------------------------------------------------
// GRADIENTANGLE — table level
// ---------------------------------------------------------------------------

describe('GRADIENTANGLE — table valid', () => {
  it('stores 90', () => {
    expect(firstTable('<TABLE GRADIENTANGLE="90"><TR><TD>x</TD></TR></TABLE>').gradientangle).toBe(90);
  });
  it('stores 0', () => {
    expect(firstTable('<TABLE GRADIENTANGLE="0"><TR><TD>x</TD></TR></TABLE>').gradientangle).toBe(0);
  });
  it('stores 360', () => {
    expect(firstTable('<TABLE GRADIENTANGLE="360"><TR><TD>x</TD></TR></TABLE>').gradientangle).toBe(360);
  });
});

describe('GRADIENTANGLE — table invalid', () => {
  it('ignores > 360', () => {
    expect(firstTable('<TABLE GRADIENTANGLE="361"><TR><TD>x</TD></TR></TABLE>').gradientangle).toBeUndefined();
  });
  it('ignores < 0', () => {
    expect(firstTable('<TABLE GRADIENTANGLE="-1"><TR><TD>x</TD></TR></TABLE>').gradientangle).toBeUndefined();
  });
  it('ignores non-integer', () => {
    expect(firstTable('<TABLE GRADIENTANGLE="abc"><TR><TD>x</TD></TR></TABLE>').gradientangle).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GRADIENTANGLE — cell level
// ---------------------------------------------------------------------------

describe('GRADIENTANGLE — cell', () => {
  it('stores valid GRADIENTANGLE on cell', () => {
    const cell = firstCell('<TABLE><TR><TD GRADIENTANGLE="45">x</TD></TR></TABLE>');
    expect(cell.gradientangle).toBe(45);
  });

  it('ignores GRADIENTANGLE > 360 on cell', () => {
    const cell = firstCell('<TABLE><TR><TD GRADIENTANGLE="999">x</TD></TR></TABLE>');
    expect(cell.gradientangle).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SIDES bitmask
// ---------------------------------------------------------------------------

/** BORDER_LEFT=0x400, BORDER_TOP=0x800, BORDER_RIGHT=0x1000, BORDER_BOTTOM=0x2000 */
const BORDER_LEFT   = 0x0400;
const BORDER_TOP    = 0x0800;
const BORDER_RIGHT  = 0x1000;
const BORDER_BOTTOM = 0x2000;

describe('SIDES single bits — table', () => {
  it('L → BORDER_LEFT', () => {
    expect(firstTable('<TABLE SIDES="L"><TR><TD>x</TD></TR></TABLE>').sides).toBe(BORDER_LEFT);
  });
  it('T → BORDER_TOP', () => {
    expect(firstTable('<TABLE SIDES="T"><TR><TD>x</TD></TR></TABLE>').sides).toBe(BORDER_TOP);
  });
  it('R → BORDER_RIGHT', () => {
    expect(firstTable('<TABLE SIDES="R"><TR><TD>x</TD></TR></TABLE>').sides).toBe(BORDER_RIGHT);
  });
  it('B → BORDER_BOTTOM', () => {
    expect(firstTable('<TABLE SIDES="B"><TR><TD>x</TD></TR></TABLE>').sides).toBe(BORDER_BOTTOM);
  });
});

describe('SIDES combined — table', () => {
  it('LT → LEFT|TOP', () => {
    expect(firstTable('<TABLE SIDES="LT"><TR><TD>x</TD></TR></TABLE>').sides).toBe(BORDER_LEFT | BORDER_TOP);
  });
  it('LTRB → undefined (C skips write when all four bits set)', () => {
    // C sidesfn: if (flags != BORDER_MASK) p->flags |= flags — full mask is a no-op
    expect(firstTable('<TABLE SIDES="LTRB"><TR><TD>x</TD></TR></TABLE>').sides).toBeUndefined();
  });
  it('case-insensitive: lt → LEFT|TOP', () => {
    expect(firstTable('<TABLE SIDES="lt"><TR><TD>x</TD></TR></TABLE>').sides).toBe(BORDER_LEFT | BORDER_TOP);
  });
});

describe('SIDES bitmask — cell', () => {
  it('parses SIDES="LR" as BORDER_LEFT|BORDER_RIGHT on cell', () => {
    const cell = firstCell('<TABLE><TR><TD SIDES="LR">x</TD></TR></TABLE>');
    expect(cell.sides).toBe(BORDER_LEFT | BORDER_RIGHT);
  });
});

// ---------------------------------------------------------------------------
// PORT — cell level (per htmlparse.y; TABLE.port is data-model only)
// ---------------------------------------------------------------------------

describe('PORT — cell', () => {
  it('stores PORT attribute on cell', () => {
    const cell = firstCell('<TABLE><TR><TD PORT="p1">x</TD></TR></TABLE>');
    expect(cell.port).toBe('p1');
  });

  it('stores PORT with special chars', () => {
    const cell = firstCell('<TABLE><TR><TD PORT="my-port_1">x</TD></TR></TABLE>');
    expect(cell.port).toBe('my-port_1');
  });
});

// ---------------------------------------------------------------------------
// PORT — table level (AD6: store only)
// ---------------------------------------------------------------------------

describe('PORT — table', () => {
  it('stores PORT attribute on table', () => {
    const tbl = firstTable('<TABLE PORT="tp1"><TR><TD>x</TD></TR></TABLE>');
    expect(tbl.port).toBe('tp1');
  });
});

// ---------------------------------------------------------------------------
// Existing attrs unchanged
// ---------------------------------------------------------------------------

describe('existing attrs unaffected', () => {
  it('parses BGCOLOR on table', () => {
    const tbl = firstTable('<TABLE BGCOLOR="red"><TR><TD>x</TD></TR></TABLE>');
    expect(tbl.bgcolor).toBe('red');
  });

  it('parses BORDER on cell', () => {
    const cell = firstCell('<TABLE><TR><TD BORDER="2">x</TD></TR></TABLE>');
    expect(cell.border).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// HR / VR rule semantics — C grammar actions.
// @see lib/common/htmlparse.y:321 (rows HR row), :329 (cells VR cell)
// ---------------------------------------------------------------------------

describe('HR between rows (htmlparse.y:321)', () => {
  it('marks the preceding row ruled', () => {
    const lbl = parseHtmlLabel('<TABLE><TR><TD>a</TD></TR><HR/><TR><TD>b</TD></TR></TABLE>');
    if (lbl.kind !== 'table') throw new Error('expected table');
    expect(lbl.table.rows[0]?.ruled).toBe(true);
    expect(lbl.table.rows[1]?.ruled).toBeUndefined();
  });

  it('throws when HR precedes any row (C syntax error)', () => {
    expect(() => parseHtmlLabel('<TABLE><HR/><TR><TD>a</TD></TR></TABLE>')).toThrow();
  });
});

describe('VR between cells (htmlparse.y:329)', () => {
  it('marks the preceding cell vruled', () => {
    const lbl = parseHtmlLabel('<TABLE><TR><TD>a</TD><VR/><TD>b</TD></TR></TABLE>');
    if (lbl.kind !== 'table') throw new Error('expected table');
    expect(lbl.table.rows[0]?.cells[0]?.vruled).toBe(true);
    expect(lbl.table.rows[0]?.cells[1]?.vruled).toBeUndefined();
  });

  it('throws when VR precedes any cell (C syntax error)', () => {
    expect(() => parseHtmlLabel('<TABLE><TR><VR/><TD>a</TD></TR></TABLE>')).toThrow();
  });
});

describe('ROWS/COLUMNS="*" propagation (htmlparse.y addRow/setCell)', () => {
  it('ROWS="*" marks every row ruled', () => {
    const lbl = parseHtmlLabel('<TABLE ROWS="*"><TR><TD>a</TD></TR><TR><TD>b</TD></TR></TABLE>');
    if (lbl.kind !== 'table') throw new Error('expected table');
    expect(lbl.table.rows.every((r) => r.ruled === true)).toBe(true);
  });

  it('COLUMNS="*" marks every cell vruled', () => {
    const lbl = parseHtmlLabel('<TABLE COLUMNS="*"><TR><TD>a</TD><TD>b</TD></TR></TABLE>');
    if (lbl.kind !== 'table') throw new Error('expected table');
    expect(lbl.table.rows[0]?.cells.every((c) => c.vruled === true)).toBe(true);
  });
});
