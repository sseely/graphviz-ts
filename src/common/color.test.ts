// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import {
  hsv2rgb, rgb2hsv, colorxlate,
  setColorScheme, getColorScheme,
  ColorxlateResult, type GVColor, type ColorType,
} from './color.js';

function makeColor(): GVColor { return { type: 'rgba', r: 0, g: 0, b: 0, a: 0 }; }
const T_RGBA: ColorType = 'rgba';

describe('hsv2rgb — primary hues', () => {
  it('AC1: pure red (0,1,1) → r=1,g=0,b=0', () => {
    const r = hsv2rgb(0, 1, 1);
    expect(r).toEqual({ r: 1, g: 0, b: 0 });
  });
  it('pure green (1/3,1,1) → g=1', () => {
    const r = hsv2rgb(1 / 3, 1, 1);
    expect(r.g).toBe(1); expect(r.r).toBeCloseTo(0, 10); expect(r.b).toBeCloseTo(0, 10);
  });
  it('pure blue (2/3,1,1) → b=1', () => {
    const r = hsv2rgb(2 / 3, 1, 1);
    expect(r.b).toBe(1); expect(r.r).toBeCloseTo(0, 10); expect(r.g).toBeCloseTo(0, 10);
  });
  it('achromatic s=0 returns v,v,v', () => {
    const r = hsv2rgb(0.5, 0, 0.8);
    expect(r.r).toBeCloseTo(0.8, 10); expect(r.g).toBeCloseTo(0.8, 10); expect(r.b).toBeCloseTo(0.8, 10);
  });
  it('h>=1.0 wraps to h=0', () => {
    const a = hsv2rgb(1.0, 1, 1); const b = hsv2rgb(0, 1, 1);
    expect(a.r).toBeCloseTo(b.r, 10); expect(a.g).toBeCloseTo(b.g, 10); expect(a.b).toBeCloseTo(b.b, 10);
  });
});

describe('rgb2hsv', () => {
  it('red round-trip', () => {
    const r = rgb2hsv(1, 0, 0);
    expect(r.h).toBeCloseTo(0, 10); expect(r.s).toBeCloseTo(1, 10); expect(r.v).toBeCloseTo(1, 10);
  });
  it('green round-trip', () => {
    const r = rgb2hsv(0, 1, 0);
    expect(r.h).toBeCloseTo(1 / 3, 10); expect(r.s).toBeCloseTo(1, 10);
  });
  it('black → h=0,s=0,v=0', () => {
    expect(rgb2hsv(0, 0, 0)).toEqual({ h: 0, s: 0, v: 0 });
  });
  it('round-trip via hsv2rgb', () => {
    const { h, s, v } = rgb2hsv(0.2, 0.6, 0.9);
    const back = hsv2rgb(h, s, v);
    expect(back.r).toBeCloseTo(0.2, 8); expect(back.g).toBeCloseTo(0.6, 8); expect(back.b).toBeCloseTo(0.9, 8);
  });
});

describe('colorxlate — named and hex', () => {
  let color: GVColor;
  beforeEach(() => { color = makeColor(); });
  it('AC2: X11 "red" → rgba r=1,g=0,b=0,a=1', () => {
    expect(colorxlate('red', color, T_RGBA)).toBe(ColorxlateResult.ColorOk);
    if (color.type !== 'rgba') throw new Error('expected rgba');
    expect(color.r).toBeCloseTo(1, 8); expect(color.g).toBeCloseTo(0, 8);
    expect(color.b).toBeCloseTo(0, 8); expect(color.a).toBeCloseTo(1, 8);
  });
  it('AC3: unknown name → ColorUnknown, sets black/opaque (C colxlate.c:369)', () => {
    expect(colorxlate('notacolor', color, T_RGBA)).toBe(ColorxlateResult.ColorUnknown);
    if (color.type !== 'rgba') throw new Error('expected rgba');
    expect(color.r).toBeCloseTo(0, 8); expect(color.b).toBeCloseTo(0, 8); expect(color.a).toBeCloseTo(1, 8);
  });
  it('#rrggbb parses', () => {
    expect(colorxlate('#ff8000', color, T_RGBA)).toBe(ColorxlateResult.ColorOk);
    if (color.type !== 'rgba') throw new Error('expected rgba');
    expect(color.r).toBeCloseTo(1.0, 5); expect(color.g).toBeCloseTo(128 / 255, 5); expect(color.b).toBeCloseTo(0, 8);
  });
  it('#rrggbbaa includes alpha', () => {
    expect(colorxlate('#ffffff80', color, T_RGBA)).toBe(ColorxlateResult.ColorOk);
    if (color.type !== 'rgba') throw new Error('expected rgba');
    expect(color.a).toBeCloseTo(0x80 / 255, 5);
  });
  it('leading whitespace is stripped', () => {
    expect(colorxlate('  red', color, T_RGBA)).toBe(ColorxlateResult.ColorOk);
    if (color.type !== 'rgba') throw new Error('expected rgba');
    expect(color.r).toBeCloseTo(1, 8);
  });
});

describe('colorxlate — HSV and scheme', () => {
  let color: GVColor;
  beforeEach(() => { color = makeColor(); setColorScheme(''); });

  it('HSV string "0,1,1" → pure red rgba', () => {
    expect(colorxlate('0,1,1', color, T_RGBA)).toBe(ColorxlateResult.ColorOk);
    if (color.type !== 'rgba') throw new Error('expected rgba');
    expect(color.r).toBeCloseTo(1, 8); expect(color.g).toBeCloseTo(0, 8); expect(color.b).toBeCloseTo(0, 8);
  });
  it('target type hsva: blue', () => {
    expect(colorxlate('blue', color, 'hsva')).toBe(ColorxlateResult.ColorOk);
    if (color.type !== 'hsva') throw new Error('expected hsva');
    expect(color.s).toBeCloseTo(1, 8); expect(color.v).toBeCloseTo(1, 8); expect(color.a).toBeCloseTo(1, 8);
  });
  it('Brewer "/accent3/1" resolves', () => {
    expect(colorxlate('/accent3/1', color, T_RGBA)).toBe(ColorxlateResult.ColorOk);
  });
});

describe('setColorScheme / getColorScheme', () => {
  beforeEach(() => { setColorScheme(''); });

  it('AC4: roundtrip "paired9"', () => {
    setColorScheme('paired9'); expect(getColorScheme()).toBe('paired9');
  });
  it('empty scheme returns empty string', () => {
    setColorScheme(''); expect(getColorScheme()).toBe('');
  });
  it('scheme prefix resolves bare color index', () => {
    setColorScheme('accent3');
    expect(colorxlate('1', makeColor(), T_RGBA)).toBe(ColorxlateResult.ColorOk);
    setColorScheme('');
  });
});
