// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { escapeXml, escapeXmlText } from './xml-escape.js';

describe('escapeXml (gv_xml_escape flags {0})', () => {
  it('escapes <, >, ", and apostrophe', () => {
    expect(escapeXml('<a>')).toBe('&lt;a&gt;');
    expect(escapeXml('"q"')).toBe('&quot;q&quot;');
    expect(escapeXml("O'Brien")).toBe('O&#39;Brien');
  });

  it('escapes a bare & but passes a valid entity through', () => {
    expect(escapeXml('a & b')).toBe('a &amp; b');
    expect(escapeXml('&amp;')).toBe('&amp;');
    expect(escapeXml('&#65;')).toBe('&#65;');
    expect(escapeXml('&#x41;')).toBe('&#x41;');
  });

  it('does NOT escape dash or collapse spaces (flags {0})', () => {
    expect(escapeXml('a-b  c')).toBe('a-b  c');
  });
});

describe('escapeXmlText (gv_xml_escape flags {raw,dash,nbsp})', () => {
  it('escapes dash, CR/LF, and 2nd+ consecutive spaces', () => {
    expect(escapeXmlText('a-b')).toBe('a&#45;b');
    expect(escapeXmlText('x\ny')).toBe('x&#10;y');
    expect(escapeXmlText('a   b')).toBe('a &#160;&#160;b');
  });

  it('also escapes the base set (<, >, ", apostrophe, bare &)', () => {
    expect(escapeXmlText("<'&>")).toBe('&lt;&#39;&amp;&gt;');
  });
});
