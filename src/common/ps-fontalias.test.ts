// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { translatePostscriptFontname, fontFamilyAttrs } from './ps-fontalias.js';

describe('ps-fontalias — translatePostscriptFontname', () => {
  it('resolves a standard name to family + generic SVG fallback', () => {
    expect(translatePostscriptFontname('Times-Roman')).toEqual({
      family: 'Times', weight: null, stretch: null, style: null, svgFontFamily: 'serif',
    });
  });

  it('matches case-insensitively (strcasecmp)', () => {
    expect(translatePostscriptFontname('times-roman')?.family).toBe('Times');
    expect(translatePostscriptFontname('HELVETICA-BOLD')?.weight).toBe('bold');
  });

  it('carries weight/stretch/style for a narrow bold face', () => {
    expect(translatePostscriptFontname('Helvetica-Narrow-Bold')).toEqual({
      family: 'Helvetica', weight: 'bold', stretch: 'condensed', style: null,
      svgFontFamily: 'sans-Serif',
    });
  });

  it('returns null for the pre-cooked default and unknown names', () => {
    expect(translatePostscriptFontname('Times,serif')).toBeNull();
    expect(translatePostscriptFontname('NotAFont')).toBeNull();
  });
});

describe('ps-fontalias — fontFamilyAttrs (svg_textspan shape)', () => {
  it('emits family,svgFontFamily for Times-Roman', () => {
    expect(fontFamilyAttrs('Times-Roman')).toEqual({
      attrs: ' font-family="Times,serif"', weight: false, style: false,
    });
  });

  it('appends alias style for Palatino-Italic', () => {
    expect(fontFamilyAttrs('Palatino-Italic')).toEqual({
      attrs: ' font-family="Palatino Linotype,serif" font-style="italic"',
      weight: false, style: true,
    });
  });

  it('emits non-CSS weight + stretch verbatim (faithful to C)', () => {
    expect(fontFamilyAttrs('Bookman-Light')?.attrs)
      .toBe(' font-family="URW Bookman L,serif" font-weight="light"');
    expect(fontFamilyAttrs('Helvetica-Narrow')?.attrs)
      .toBe(' font-family="Helvetica,sans-Serif" font-stretch="condensed"');
  });

  it('returns null when there is no alias (caller emits verbatim)', () => {
    expect(fontFamilyAttrs('Times,serif')).toBeNull();
    expect(fontFamilyAttrs(null)).toBeNull();
  });
});
