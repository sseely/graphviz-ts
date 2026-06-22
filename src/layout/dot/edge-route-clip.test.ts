// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { arrowClipLength } from './edge-route-clip.js';

describe('arrowClipLength — per-type clip length (ADR-4)', () => {
  it('dot clips by 0.8*size*10 + penwidth = 9 (size=1 pw=1)', () => {
    expect(arrowClipLength('dot', 1, 1)).toBeCloseTo(9, 9);
  });

  it('box clips by size*10 + penwidth/2 = 10.5; diamond 1.2x nominal', () => {
    expect(arrowClipLength('box', 1, 1)).toBeCloseTo(10.5, 9);
    // diamond nominal 12; with overlap it stays > the normal-ish 11.5
    expect(arrowClipLength('diamond', 1, 1)).toBeGreaterThan(11);
  });

  it('normal matches the existing normalArrowLen (no regression): 11.5135 at pw=1', () => {
    // normalArrowLen(1) = 10 + sqrt(1+0.35^2)/(2*0.35) = 11.51354; the faithful
    // numeric miter agrees, so swapping the clip source does not move normal.
    expect(arrowClipLength('normal', 1, 1)).toBeCloseTo(11.51354, 4);
  });

});

describe('arrowClipLength — arrowsize + compound', () => {
  it('arrowsize=0 → 0 (matches arrow_length early return)', () => {
    expect(arrowClipLength('normal', 0, 1)).toBe(0);
    expect(arrowClipLength('dot', 0, 1)).toBe(0);
  });

  it('arrowsize scales linearly: dot at size=2 ~ 0.8*2*10 + pw', () => {
    expect(arrowClipLength('dot', 2, 1)).toBeCloseTo(17, 9);
  });

  it('compound (crowdot) sums component clip lengths', () => {
    const crow = arrowClipLength('crow', 1, 1);
    const dot = arrowClipLength('dot', 1, 1);
    expect(arrowClipLength('crowdot', 1, 1)).toBeCloseTo(crow + dot, 9);
  });
});
