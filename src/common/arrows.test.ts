// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { ARROW_NAMES, parseArrow } from './arrows.js';

describe('ARROW_NAMES', () => {
  it('AC1: includes required names', () => {
    expect(ARROW_NAMES.includes('normal')).toBe(true);
    expect(ARROW_NAMES.includes('none')).toBe(true);
    expect(ARROW_NAMES.includes('crow')).toBe(true);
  });
  it('AC1: length matches C table count (13 Arrownames + 1 synonym = 14)', () => {
    expect(ARROW_NAMES.length).toBe(14);
  });
  it('includes inv, vee, tee, box, diamond, dot, open, empty, curve, icurve, invempty', () => {
    const expected = ['inv','vee','tee','box','diamond','dot','open','empty','curve','icurve','invempty'];
    for (const n of expected) expect(ARROW_NAMES.includes(n)).toBe(true);
  });
});

describe('parseArrow — ACs', () => {
  it('AC2: "normal" → normal component', () => {
    expect(parseArrow('normal')).toEqual([{ name: 'normal', open: false, left: false, right: false }]);
  });
  it('AC3: "none" → none component', () => {
    expect(parseArrow('none')).toEqual([{ name: 'none', open: false, left: false, right: false }]);
  });
  it('AC4: "odot" → dot open=true', () => {
    expect(parseArrow('odot')).toEqual([{ name: 'dot', open: true, left: false, right: false }]);
  });
  it('"inv" parses as base name', () => {
    expect(parseArrow('inv')).toEqual([{ name: 'inv', open: false, left: false, right: false }]);
  });
  it('"vee" parses as base name', () => {
    expect(parseArrow('vee')).toEqual([{ name: 'vee', open: false, left: false, right: false }]);
  });
});

describe('parseArrow — edge cases', () => {
  it('"invempty" synonym resolves', () => {
    const r = parseArrow('invempty');
    expect(r.length).toBe(1); expect(r[0].name).toBe('invempty');
  });
  it('"open" resolves with open=true', () => {
    const r = parseArrow('open');
    expect(r[0].name).toBe('open'); expect(r[0].open).toBe(true);
  });
  it('empty string returns default normal', () => {
    expect(parseArrow('')).toEqual([{ name: 'normal', open: false, left: false, right: false }]);
  });
});
