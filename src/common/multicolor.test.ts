// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import { parseSegs } from './multicolor.js';

// ---------------------------------------------------------------------------
// parseSegs — acceptance criteria from G1 task spec
// ---------------------------------------------------------------------------

describe('parseSegs — basic two-color list', () => {
  it('red:blue → 2 segs, no fractions, error 0', () => {
    const { segs, error } = parseSegs('red:blue');
    expect(error).toBe(0);
    expect(segs).toHaveLength(2);
    expect(segs[0]?.color).toBe('red');
    expect(segs[1]?.color).toBe('blue');
    expect(segs[0]?.hasFraction).toBe(false);
    expect(segs[1]?.hasFraction).toBe(false);
  });

  it('red:blue → segs sum to 1 after distribution', () => {
    const { segs } = parseSegs('red:blue');
    const sum = segs.reduce((a, s) => a + s.t, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });
});

describe('parseSegs — explicit fraction', () => {
  it('red;0.3:blue → seg0 has t=0.3, hasFraction=true', () => {
    // G1 acceptance: parseSegs("red;0.3:blue") → seg0 {color:red, t:0.3, hasFraction:true}
    const { segs, error } = parseSegs('red;0.3:blue');
    expect(error).toBe(0);
    expect(segs[0]?.color).toBe('red');
    expect(segs[0]?.t).toBeCloseTo(0.3);
    expect(segs[0]?.hasFraction).toBe(true);
  });

  it('red;0.3:blue → seg1 gets the remaining 0.7', () => {
    const { segs } = parseSegs('red;0.3:blue');
    expect(segs[1]?.color).toBe('blue');
    expect(segs[1]?.t).toBeCloseTo(0.7);
    expect(segs[1]?.hasFraction).toBe(false);
  });
});

describe('parseSegs — single color', () => {
  it('single "red" → 1 seg, no fraction', () => {
    const { segs, error } = parseSegs('red');
    expect(error).toBe(0);
    expect(segs).toHaveLength(1);
    expect(segs[0]?.color).toBe('red');
    expect(segs[0]?.hasFraction).toBe(false);
    expect(segs[0]?.t).toBeCloseTo(1);
  });
});

describe('parseSegs — both fractions explicit', () => {
  it('red;0.25:blue;0.75 → both hasFraction true', () => {
    const { segs, error } = parseSegs('red;0.25:blue;0.75');
    expect(error).toBe(0);
    expect(segs[0]?.t).toBeCloseTo(0.25);
    expect(segs[0]?.hasFraction).toBe(true);
    expect(segs[1]?.t).toBeCloseTo(0.75);
    expect(segs[1]?.hasFraction).toBe(true);
  });
});

describe('parseSegs — sum exceeds 1 (warning)', () => {
  it('red;0.6:blue;0.6 → error 3 (warning), segs populated', () => {
    const { segs, error } = parseSegs('red;0.6:blue;0.6');
    expect(error).toBe(3);
    expect(segs.length).toBeGreaterThan(0);
    expect(segs[0]?.color).toBe('red');
  });
});

describe('parseSegs — bad float after semicolon (error)', () => {
  it('red;abc:blue → error 2, empty segs', () => {
    const { segs, error } = parseSegs('red;abc:blue');
    expect(error).toBe(2);
    expect(segs).toHaveLength(0);
  });
});

describe('parseSegs — three colors distribute remainder', () => {
  it('red:green:blue → 3 segs each ~0.333', () => {
    const { segs, error } = parseSegs('red:green:blue');
    expect(error).toBe(0);
    expect(segs).toHaveLength(3);
    for (const s of segs) {
      expect(s.t).toBeCloseTo(1 / 3);
      expect(s.hasFraction).toBe(false);
    }
  });
});

describe('parseSegs — explicit fraction distributes to unspecified only', () => {
  it('red;0.5:green:blue → green and blue each get 0.25', () => {
    const { segs, error } = parseSegs('red;0.5:green:blue');
    expect(error).toBe(0);
    expect(segs[0]?.t).toBeCloseTo(0.5);
    expect(segs[1]?.t).toBeCloseTo(0.25);
    expect(segs[2]?.t).toBeCloseTo(0.25);
  });
});
