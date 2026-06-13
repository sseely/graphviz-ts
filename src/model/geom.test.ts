// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import { boxContains } from './geom.js';
import type { Box } from './geom.js';

const OUTER: Box = { ll: { x: 0, y: 0 }, ur: { x: 10, y: 10 } };
const INNER: Box = { ll: { x: 2, y: 2 }, ur: { x: 8, y: 8 } };
const OVERLAP: Box = { ll: { x: 2, y: 2 }, ur: { x: 8, y: 8 } };
const EXCEEDS: Box = { ll: { x: 2, y: 2 }, ur: { x: 12, y: 8 } };
const SAME: Box = { ll: { x: 0, y: 0 }, ur: { x: 10, y: 10 } };

describe('boxContains — containment', () => {
  it('returns true when b0 strictly contains b1', () => {
    expect(boxContains(OUTER, INNER)).toBe(true);
  });

  it('returns false when b1 upper-right exceeds b0', () => {
    const b0: Box = { ll: { x: 0, y: 0 }, ur: { x: 5, y: 5 } };
    expect(boxContains(b0, OVERLAP)).toBe(false);
  });
});

describe('boxContains — boundary touching', () => {
  it('returns true when b1 exactly equals b0 (boundary is inclusive)', () => {
    expect(boxContains(OUTER, SAME)).toBe(true);
  });

  it('returns false when b1 lower-left is outside b0 lower-left', () => {
    const b0: Box = { ll: { x: 1, y: 1 }, ur: { x: 10, y: 10 } };
    expect(boxContains(b0, OUTER)).toBe(false);
  });
});

describe('boxContains — partial overlap', () => {
  it('returns false when b1 upper-right exceeds b0 on x axis', () => {
    expect(boxContains(OUTER, EXCEEDS)).toBe(false);
  });
});
