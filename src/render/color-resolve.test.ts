// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { setColorScheme, type GVColor } from '../common/color.js';
import {
  KNOWN_COLORS,
  resolveRenderColor,
  withColorScheme,
  colorPaint,
  colorOpacity,
  textFillAttrs,
} from './color-resolve.js';

/** rgba paint shorthand for assertions. */
function paint(raw: string): string {
  return colorPaint(resolveRenderColor(raw));
}

describe('color-resolve — gvrender_resolve_color parity', () => {
  it('ports all 148 SVG known colors (svg_knowncolors[])', () => {
    expect(KNOWN_COLORS.size).toBe(148);
    expect(KNOWN_COLORS.has('transparent')).toBe(true);
    expect(KNOWN_COLORS.has('none')).toBe(false);
  });

  it('keeps a known color name verbatim (case preserved)', () => {
    expect(resolveRenderColor('red')).toEqual({ type: 'string', s: 'red' });
    expect(resolveRenderColor('LightGrey')).toEqual({ type: 'string', s: 'LightGrey' });
  });

  it("maps '' and 'none' to type none", () => {
    expect(resolveRenderColor('')).toEqual({ type: 'none' });
    expect(resolveRenderColor('none')).toEqual({ type: 'none' });
  });

  it('lowercases hex (#FF0000 → #ff0000)', () => {
    expect(paint('#FF0000')).toBe('#ff0000');
  });

  it('converts HSV with C truncation (0.2,0.8,0.8 → #abcc28, not #abcc29)', () => {
    // C uses (unsigned char)(chan*255); blue 0.16*255=40.8 truncates to 40=0x28.
    expect(paint('0.2,0.8,0.8')).toBe('#abcc28');
  });

  it('resolves an explicit Brewer scheme path (/accent3/1)', () => {
    expect(paint('/accent3/1')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('color-resolve — opacity (svg_grstyle / svg_print_paint)', () => {
  it('emits 6-decimal fill-opacity for partial alpha (#ffffff80)', () => {
    const c = resolveRenderColor('#ffffff80');
    expect(colorOpacity(c)).toBe('0.501961');
  });

  it('omits opacity for opaque and fully transparent paints', () => {
    expect(colorOpacity(resolveRenderColor('#ff0000'))).toBeNull();
    expect(colorOpacity({ type: 'rgba', r: 0, g: 0, b: 0, a: 0 })).toBeNull();
  });
});

describe('color-resolve — text fill (svg_textspan switch)', () => {
  it("skips fill for the name 'black' but not for #000000", () => {
    expect(textFillAttrs('black')).toBe('');
    expect(textFillAttrs('#000000')).toBe(' fill="#000000"');
  });

  it('canonicalizes a hex font color + opacity, after font-size order', () => {
    expect(textFillAttrs('#FF00007F')).toBe(' fill="#ff0000" fill-opacity="0.498039"');
  });

  it('returns empty for null / none', () => {
    expect(textFillAttrs(null)).toBe('');
    expect(textFillAttrs('none')).toBe('');
  });
});

describe('color-resolve — withColorScheme save/restore', () => {
  it('sets the scheme inside and restores the previous scheme', () => {
    setColorScheme('');
    const inside = withColorScheme('spectral11', () => {
      const c: GVColor = resolveRenderColor('/spectral11/1');
      return c.type;
    });
    expect(inside).toBe('rgba');
    // restored to the previous (empty) scheme: a bare index no longer resolves
    expect(resolveRenderColor('1')).toEqual({ type: 'rgba', r: 0, g: 0, b: 0, a: 1 });
  });

  it('restores the scheme even when fn throws', () => {
    setColorScheme('');
    expect(() => withColorScheme('set19', () => { throw new Error('x'); })).toThrow('x');
    // global scheme not leaked
    const c = resolveRenderColor('notacolor');
    expect(c).toEqual({ type: 'rgba', r: 0, g: 0, b: 0, a: 1 });
  });
});
