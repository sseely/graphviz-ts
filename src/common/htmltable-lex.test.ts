// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for the HTML-like label tokenizer.
 * @see lib/common/htmllex.c
 */
import { describe, expect, it } from 'vitest';
import { tokenize } from './htmltable-lex.js';
import type { OpenToken } from './htmltable-types.js';

describe('tokenize — table attrs', () => {
  it('tokenizes GRADIENTANGLE on TABLE', () => {
    const tok = tokenize('<TABLE GRADIENTANGLE="90">')[0] as OpenToken;
    expect(tok.attrs['gradientangle']).toBe('90');
  });

  it('tokenizes SIDES on TABLE', () => {
    const tok = tokenize('<TABLE SIDES="LT">')[0] as OpenToken;
    expect(tok.attrs['sides']).toBe('LT');
  });

  it('tokenizes PORT on TABLE', () => {
    const tok = tokenize('<TABLE PORT="p1">')[0] as OpenToken;
    expect(tok.attrs['port']).toBe('p1');
  });

  it('tokenizes GRADIENTANGLE and SIDES together on TABLE', () => {
    const tok = tokenize('<TABLE GRADIENTANGLE="45" SIDES="LTRB">')[0] as OpenToken;
    expect(tok.attrs['gradientangle']).toBe('45');
    expect(tok.attrs['sides']).toBe('LTRB');
  });
});

describe('tokenize — cell attrs', () => {
  it('tokenizes GRADIENTANGLE on TD', () => {
    const tok = tokenize('<TD GRADIENTANGLE="180">')[0] as OpenToken;
    expect(tok.attrs['gradientangle']).toBe('180');
  });

  it('tokenizes SIDES on TD', () => {
    const tok = tokenize('<TD SIDES="LR">')[0] as OpenToken;
    expect(tok.attrs['sides']).toBe('LR');
  });

  it('tokenizes PORT on TD', () => {
    const tok = tokenize('<TD PORT="myport">')[0] as OpenToken;
    expect(tok.attrs['port']).toBe('myport');
  });

  it('lowercases attribute names', () => {
    const tok = tokenize('<TD gradientangle="30" sides="T">')[0] as OpenToken;
    expect(tok.attrs['gradientangle']).toBe('30');
    expect(tok.attrs['sides']).toBe('T');
  });
});

describe('tokenize — basic tokens', () => {
  it('produces open token for TABLE', () => {
    const tokens = tokenize('<TABLE>');
    expect(tokens[0]).toMatchObject({ type: 'open', tag: 'TABLE' });
  });

  it('produces text token', () => {
    expect(tokenize('hello')[0]).toMatchObject({ type: 'text', value: 'hello' });
  });

  it('produces close token', () => {
    expect(tokenize('</TABLE>')[0]).toMatchObject({ type: 'close', tag: 'TABLE' });
  });
});

// ---------------------------------------------------------------------------
// Self-closing tags: expat reports startElement then endElement for <X/>.
// @see lib/common/htmllex.c (XML_SetElementHandler callbacks)
// ---------------------------------------------------------------------------

describe('self-closing tags', () => {
  it('<VR/> lexes as open + close pair', () => {
    const toks = tokenize('<VR/>');
    expect(toks).toEqual([
      { type: 'open', tag: 'VR', attrs: {} },
      { type: 'close', tag: 'VR' },
    ]);
  });

  it('<HR/> lexes as open + close pair', () => {
    const toks = tokenize('<HR/>');
    expect(toks).toEqual([
      { type: 'open', tag: 'HR', attrs: {} },
      { type: 'close', tag: 'HR' },
    ]);
  });

  it('self-closing tag with attributes keeps them on the open token', () => {
    const toks = tokenize('<IMG SRC="x.png"/>');
    expect(toks[0]?.type).toBe('open');
    expect(toks[0]?.type === 'open' && toks[0].attrs['src']).toBe('x.png');
    expect(toks[1]).toEqual({ type: 'close', tag: 'IMG' });
  });
});

// ---------------------------------------------------------------------------
// Attribute scanning: value consumption + XML well-formedness.
// @see lib/common/htmllex.c (expat "not well-formed" error path)
// ---------------------------------------------------------------------------

describe('attribute scanning', () => {
  it('words inside quoted values do not become phantom attributes', () => {
    const toks = tokenize('<IMG SRC="x.png"/>');
    expect(toks[0]?.type === 'open' && toks[0].attrs).toEqual({ src: 'x.png' });
  });

  it('multiple quoted attributes parse cleanly', () => {
    const toks = tokenize('<TABLE BORDER="1" CELLPADDING="2">');
    expect(toks[0]?.type === 'open' && toks[0].attrs).toEqual({ border: '1', cellpadding: '2' });
  });

  it('bare attribute is not well-formed (C: expat error -> fallback)', () => {
    expect(() => tokenize('<TD NOWRAP>')).toThrow();
  });

  it('unquoted value is not well-formed', () => {
    expect(() => tokenize('<TABLE BORDER=1>')).toThrow();
  });

  it('single-quoted values are accepted', () => {
    const toks = tokenize("<TD PORT='p1'>");
    expect(toks[0]?.type === 'open' && toks[0].attrs).toEqual({ port: 'p1' });
  });
});

describe('tokenize — entity decoding in text runs', () => {
  // C's HTML lexer resolves entities via expat during tokenization, so both
  // sizing and emit see decoded UTF-8. Skipping this measured the raw entity
  // string (e.g. "&#91;el...") instead of "[el...", inflating edge-label
  // vnodes and shifting layout (corpus 1949 was +18.7px wide).
  // @see lib/common/htmllex.c
  it('decodes a numeric entity (&#91; -> [) in a text run', () => {
    const toks = tokenize('&#91;el...');
    expect(toks).toEqual([{ type: 'text', value: '[el...' }]);
  });

  it('decodes named XML entities and round-trips through emit escaping', () => {
    const toks = tokenize('a &amp;&lt;&gt; b');
    expect(toks).toEqual([{ type: 'text', value: 'a &<> b' }]);
  });

  it('leaves an unknown entity name literal', () => {
    const toks = tokenize('&notareal; x');
    expect(toks).toEqual([{ type: 'text', value: '&notareal; x' }]);
  });

  it('decodes text between tags without affecting tags', () => {
    const toks = tokenize('<B>&#65;&#66;</B>');
    expect(toks[0]).toEqual({ type: 'open', tag: 'B', attrs: {} });
    expect(toks[1]).toEqual({ type: 'text', value: 'AB' });
  });
});
