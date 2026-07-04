// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the poly_init sizing port.
 * Expected values derived from lib/common/shapes.c:poly_init formulas
 * and validated against test/golden/refs/twopi-star.svg (rx 33.44).
 */

import { describe, it, expect } from 'vitest';
import {
  polySize,
  gvNodesize,
  type PolySizeParams,
} from './poly-sizing.js';

/** Default-attr params for an ellipse node; override per test. */
function params(over: Partial<PolySizeParams> = {}): PolySizeParams {
  return {
    labelDimen: { x: 0, y: 0 },
    sides: 1,
    peripheries: 1,
    orientation: 0,
    distortion: 0,
    skew: 0,
    regular: false,
    isPlain: false,
    widthIn: 0.75,
    heightIn: 0.5,
    userSizePts: 0,
    margin: undefined,
    fixedsize: 'false',
    labelloc: undefined,
    quantumIn: 0,
    flip: false,
    ...over,
  };
}

// Label "center" at Times 14pt via LutTextMeasurer: 33 x 16.5 pts.
const CENTER = { x: 33, y: 16.5 };
// Label "A" at Times 14pt: 9.75 x 16.5 pts.
const A = { x: 9.75, y: 16.5 };

describe('polySize — nojustify label space (shapes.c:2132-2145)', () => {
  // A box far wider than its label: justified \l/\r borders span the node
  // (bb.x), nojustify borders shrink to the label's own width (dimen.x).
  const wide = { labelDimen: { x: 100, y: 33 }, sides: 4, widthIn: 3 };

  it('justified box spreads the label space across the node width', () => {
    const r = polySize(params(wide));
    // isBox → space.x = max(dimen.x, bb.x) - spacex; node (216pt) dominates.
    expect(r.space.x).toBeGreaterThan(150);
  });

  it('nojustify shrinks the label space to the label width', () => {
    const r = polySize(params({ ...wide, nojustify: true }));
    // space.x = dimen.x - spacex = labelDimen.x (the added padding cancels).
    expect(r.space.x).toBeCloseTo(100, 1);
    expect(r.space.x).toBeLessThan(polySize(params(wide)).space.x);
  });
});

describe('polySize — ellipse (sides < 3)', () => {
  it('sizes "center" @14pt Times to lw=rw=33.44 (twopi-star ref)', () => {
    const r = polySize(params({ labelDimen: CENTER }));
    expect(r.lw).toBeCloseTo(33.44, 1);
    expect(r.rw).toBeCloseTo(33.44, 1);
    expect(r.ht).toBe(36);
  });

  it('keeps defaults 27/27/36 for small label "A"', () => {
    const r = polySize(params({ labelDimen: A }));
    expect(r.lw).toBe(27);
    expect(r.rw).toBe(27);
    expect(r.ht).toBe(36);
  });

  it('uses full sqrt2 expansion when label is too tall to centre', () => {
    // dimen = 49 x 44.5; 44.5*sqrt2 = 62.93 > height 36 -> both axes expand
    const r = polySize(params({ labelDimen: { x: 33, y: 36.5 } }));
    expect(r.lw).toBeCloseTo((49 * Math.SQRT2) / 2, 4);
    expect(r.ht).toBeCloseTo(44.5 * Math.SQRT2, 4);
  });

});

describe('polySize — ellipse labelloc and peripheries', () => {
  it('uses full sqrt2 expansion when labelloc=t even with spare height', () => {
    const r = polySize(params({ labelDimen: CENTER, labelloc: 't' }));
    expect(r.lw).toBeCloseTo((49 * Math.SQRT2) / 2, 4);
    expect(r.ht).toBeCloseTo(36, 4); // 24.5*sqrt2 = 34.65 < 36 -> default wins
  });

  it('grows by GAP per extra periphery (doublecircle)', () => {
    const one = polySize(params({ labelDimen: CENTER }));
    const two = polySize(params({ labelDimen: CENTER, peripheries: 2 }));
    expect(two.lw).toBeCloseTo(one.lw + 4, 6);
    expect(two.ht).toBeCloseTo(one.ht + 8, 6);
  });
});

describe('polySize — box (sides == 4)', () => {
  it('fits a wide label exactly: width = labelWidth + 16 (PAD)', () => {
    const r = polySize(params({ labelDimen: { x: 70, y: 16.5 }, sides: 4 }));
    expect(r.lw).toBe(43); // (70 + 16) / 2
    expect(r.rw).toBe(43);
    expect(r.ht).toBe(36); // 16.5 + 8 = 24.5 < default 36
  });

  it('keeps default 54x36 for small labels', () => {
    const r = polySize(params({ labelDimen: A, sides: 4 }));
    expect(r.lw).toBe(27);
    expect(r.ht).toBe(36);
  });

  it('grows corners by GAP per extra periphery', () => {
    const r = polySize(
      params({ labelDimen: { x: 70, y: 16.5 }, sides: 4, peripheries: 2 }),
    );
    expect(r.lw).toBeCloseTo(47, 6); // (86 + 2*GAP) / 2
    expect(r.ht).toBeCloseTo(44, 6); // 36 + 2*GAP
  });
});

describe('polySize — general polygons (sides >= 3)', () => {
  it('inflates a hexagon by sqrt-expansion / cos(pi/6)', () => {
    // dimen 49x24.5; spare-height x-expansion 66.8762; /cos(pi/6) -> 77.222
    const r = polySize(params({ labelDimen: CENTER, sides: 6 }));
    expect(r.lw).toBeCloseTo(38.611, 3);
    expect(r.ht).toBe(36); // 28.29 < 36 -> default height wins
  });

  it('inflates a triangle by /cos(pi/3) = 2x', () => {
    const r = polySize(params({ labelDimen: CENTER, sides: 3 }));
    expect(r.lw).toBeCloseTo(66.876, 2); // 133.752 / 2
    expect(r.ht).toBeCloseTo(49, 2); // ymax*2 = bb.y = 49 > 36
  });

  it('treats diamond (orientation 45) as non-box', () => {
    // expansion applies, then /cos(pi/4): bb.x = 66.8762*sqrt2 = 94.578
    const r = polySize(
      params({ labelDimen: CENTER, sides: 4, orientation: 45 }),
    );
    expect(r.lw).toBeCloseTo(47.289, 2);
    expect(r.ht).toBeCloseTo(36, 9); // 34.648 < 36 -> default height wins
  });
});

describe('polySize — attrs', () => {
  it('fixedsize=true: attr dimensions win regardless of label', () => {
    const r = polySize(
      params({
        labelDimen: { x: 200, y: 100 },
        fixedsize: 'true',
        widthIn: 1,
        heightIn: 0.6,
      }),
    );
    expect(r.lw).toBe(36);
    expect(r.rw).toBe(36);
    expect(r.ht).toBeCloseTo(43.2, 6);
  });

  it('fixedsize=shape: shape fixed but reported size covers label', () => {
    const r = polySize(
      params({
        labelDimen: { x: 100, y: 30 },
        sides: 4,
        fixedsize: 'shape',
        widthIn: 1,
        heightIn: 0.6,
      }),
    );
    expect(r.lw).toBe(58); // max(dimen.x=116, bb.x=72) / 2
    expect(r.ht).toBeCloseTo(43.2, 6); // max(38, 43.2)
  });

});

describe('polySize — margin attr', () => {
  it('margin attr replaces PAD: margin=0.25,0.1', () => {
    // dimen = 33+36 x 16.5+14.4 = 69 x 30.9; 30.9*sqrt2 = 43.70 > 36
    const r = polySize(params({ labelDimen: CENTER, margin: '0.25,0.1' }));
    expect(r.lw).toBeCloseTo((69 * Math.SQRT2) / 2, 3);
    expect(r.ht).toBeCloseTo(30.9 * Math.SQRT2, 3);
  });

  it('single-value margin applies to both axes', () => {
    const r = polySize(
      params({ labelDimen: { x: 70, y: 16.5 }, sides: 4, margin: '0.2' }),
    );
    expect(r.lw).toBeCloseTo((70 + 28.8) / 2, 6);
    expect(r.ht).toBeCloseTo(45.3, 6); // 16.5 + 28.8 > default 36
  });

});

describe('polySize — regular attr', () => {
  it('regular forces equal width/height', () => {
    const r = polySize(params({ labelDimen: CENTER, regular: true }));
    expect(r.lw).toBeCloseTo(33.438, 2);
    expect(r.ht).toBeCloseTo(66.876, 2);
  });

  it('regular + user size: userSize wins over label-independent default', () => {
    const r = polySize(
      params({ labelDimen: A, regular: true, userSizePts: 90, widthIn: 1.25, heightIn: 0.5 }),
    );
    expect(r.lw).toBe(45);
    expect(r.ht).toBe(90);
  });

});

describe('polySize — plain and quantum', () => {
  it('plain shape: no padding, exact label size', () => {
    const r = polySize(
      params({ labelDimen: CENTER, sides: 4, peripheries: 0, isPlain: true }),
    );
    expect(r.lw).toBe(16.5);
    expect(r.ht).toBe(16.5);
  });

  it('quantum rounds label box up to multiples', () => {
    // quantum 0.5in = 36pt: dimen 49x24.5 -> 72x36
    const r = polySize(params({ labelDimen: CENTER, sides: 4, quantumIn: 0.5 }));
    expect(r.lw).toBe(36);
    expect(r.ht).toBe(36);
  });
});

describe('gvNodesize', () => {
  it('halves width into lw/rw and keeps height', () => {
    expect(gvNodesize(54, 36, false)).toEqual({ lw: 27, rw: 27, ht: 36 });
  });
  it('flip swaps width and height', () => {
    expect(gvNodesize(54, 36, true)).toEqual({ lw: 18, rw: 18, ht: 54 });
  });
});
