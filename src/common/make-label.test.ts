// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for makeAnyLabel — unified label entry mirroring C
 * labels.c:make_label which branches on is_html internally.
 *
 * @see lib/common/labels.c:make_label
 * @see lib/common/htmltable.c:make_html_label
 */

import { describe, it, expect } from 'vitest';
import type { TextMeasurer } from './textmeasure.js';
import { makeLabel, makeAnyLabel, htmlEntityUTF8 } from './make-label.js';

const stubMeasurer: TextMeasurer = { measure: () => ({ w: 20, h: 10 }) };
const ARIAL = { fontname: 'Arial', fontsize: 12, fontcolor: 'black' };
const HELV = { fontname: 'Helvetica', fontsize: 14, fontcolor: 'red' };

// ---------------------------------------------------------------------------
// makeAnyLabel — plain-text path (isHtml=false)
// @see lib/common/labels.c:make_label (163-181, else branch)
// ---------------------------------------------------------------------------

describe('makeAnyLabel — plain text', () => {
  it('result deep-equals makeLabel output', () => {
    const text = 'hello world';
    const direct = makeLabel(text, 'Arial', 12, 'black', stubMeasurer);
    const via = makeAnyLabel(text, false, ARIAL, stubMeasurer);
    expect(via).toEqual(direct);
  });

  it('html=false on result', () => {
    const result = makeAnyLabel('test', false, ARIAL, stubMeasurer);
    expect(result.html).toBe(false);
  });

  it('u.kind is txt', () => {
    const result = makeAnyLabel('test', false, ARIAL, stubMeasurer);
    expect(result.u.kind).toBe('txt');
  });

  it('text matches input', () => {
    const result = makeAnyLabel('my label', false, ARIAL, stubMeasurer);
    expect(result.text).toBe('my label');
  });

  it('dimen reflects measurer output', () => {
    const result = makeAnyLabel('x', false, ARIAL, stubMeasurer);
    expect(result.dimen.x).toBe(20);
    expect(result.dimen.y).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// makeAnyLabel — HTML path (isHtml=true)
// @see lib/common/labels.c:make_label (145-161, else if is_html branch)
// ---------------------------------------------------------------------------

describe('makeAnyLabel — HTML label', () => {
  // A minimal valid HTML table label
  const htmlContent = '<TABLE><TR><TD>cell</TD></TR></TABLE>';

  it('html=true on result', () => {
    const result = makeAnyLabel(htmlContent, true, ARIAL, stubMeasurer);
    expect(result.html).toBe(true);
  });

  it('u.kind is html', () => {
    const result = makeAnyLabel(htmlContent, true, ARIAL, stubMeasurer);
    expect(result.u.kind).toBe('html');
  });

  it('table labels get the C "<TABLE>" placeholder text', () => {
    // C replaces table-label text for title/alt use in image maps.
    // @see lib/common/htmltable.c:make_html_label (line 1935)
    const result = makeAnyLabel(htmlContent, true, ARIAL, stubMeasurer);
    expect(result.text).toBe('<TABLE>');
  });

  it('text-only html labels keep the original content', () => {
    const result = makeAnyLabel('plain <b>run</b>', true, ARIAL, stubMeasurer);
    expect(result.text).toBe('plain <b>run</b>');
  });
});

// ---------------------------------------------------------------------------
// makeAnyLabel — C empty-string special case
// @see lib/common/labels.c:make_label line 119:
//   "disregard HTML intent for empty string labels"
//   is_html &= !streq(str, "");
// ---------------------------------------------------------------------------

describe('makeAnyLabel — empty string disregards HTML intent', () => {
  it('html=false when isHtml=true but content is empty string', () => {
    // C: is_html &= !streq(str, "");  — empty string forces plain path
    const result = makeAnyLabel('', true, ARIAL, stubMeasurer);
    expect(result.html).toBe(false);
  });

  it('u.kind is txt for empty html string', () => {
    const result = makeAnyLabel('', true, ARIAL, stubMeasurer);
    expect(result.u.kind).toBe('txt');
  });
});

// ---------------------------------------------------------------------------
// makeAnyLabel — HTML parse-failure fallback
// @see lib/common/htmltable.c:make_html_label lines 1884-1907
//   "Parse of label failed; revert to simple text label"
//   lp->html = false; ... use object name (port: keep markup text)
// ---------------------------------------------------------------------------

describe('makeAnyLabel — HTML parse failure fallback', () => {
  it('falls back to plain text when HTML markup is malformed', () => {
    // Deliberately malformed HTML that parseHtmlLabel will reject
    const badHtml = '<unclosed';
    const result = makeAnyLabel(badHtml, true, ARIAL, stubMeasurer);
    // C: lp->html = false on parse failure
    expect(result.html).toBe(false);
  });

  it('fallback u.kind is txt', () => {
    const badHtml = '<unclosed';
    const result = makeAnyLabel(badHtml, true, ARIAL, stubMeasurer);
    expect(result.u.kind).toBe('txt');
  });

  it('fallback preserves the markup text (port keeps markup; C uses object name)', () => {
    // C uses nameOf(obj) because it has an object context; the port has no
    // object so it keeps the markup text in lp->text, matching makeHtmlLabel's
    // existing fallback behavior.
    // @see lib/common/htmltable.c:make_html_label line 1894
    const badHtml = '<unclosed';
    const result = makeAnyLabel(badHtml, true, ARIAL, stubMeasurer);
    expect(result.text).toBe(badHtml);
  });
});

// ---------------------------------------------------------------------------
// makeAnyLabel — font attrs propagate to result
// ---------------------------------------------------------------------------

describe('makeAnyLabel — font attrs', () => {
  it('fontname is set', () => {
    const r = makeAnyLabel('hi', false, HELV, stubMeasurer);
    expect(r.fontname).toBe('Helvetica');
  });

  it('fontsize is set', () => {
    const r = makeAnyLabel('hi', false, HELV, stubMeasurer);
    expect(r.fontsize).toBe(14);
  });

  it('fontcolor is set', () => {
    const r = makeAnyLabel('hi', false, HELV, stubMeasurer);
    expect(r.fontcolor).toBe('red');
  });
});

// ---------------------------------------------------------------------------
// htmlEntityUTF8 — basic XML + numeric entity decode (UTF-8 branch)
// ---------------------------------------------------------------------------

describe('htmlEntityUTF8', () => {
  it('decodes the five basic XML entities', () => {
    expect(htmlEntityUTF8('&lt;&gt;&amp;&quot;&apos;')).toBe('<>&"\'');
  });

  it('decodes decimal and hex numeric entities', () => {
    expect(htmlEntityUTF8('&#65;&#x42;')).toBe('AB');
  });

  it('leaves unrecognized named entities literal', () => {
    expect(htmlEntityUTF8('&alpha; x')).toBe('&alpha; x');
  });

  it('returns the input unchanged when there is no &', () => {
    expect(htmlEntityUTF8('plain text')).toBe('plain text');
  });
});
