// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for xlabels.ts: hdHilSFromXy, xladjust, placeLabels.
 * Oracle values derived from C probe at .probes/probe_xlabels.c and
 * .probes/probe_place.c (compiled against graphviz 15.0.0 sources).
 */

import { describe, it, expect } from 'vitest';
import { hdHilSFromXy } from './xlabels-geom.js';
import { placeLabels, type ObjectT, type XLabelT, type LabelParamsT } from './xlabels.js';

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

function makeLbl(
  szx: number, szy: number,
  px = 0, py = 0,
  set = 0,
): XLabelT {
  return {
    sz: { x: szx, y: szy },
    pos: { x: px, y: py },
    lbl: null,
    set,
  };
}

function makeObj(
  px: number, py: number,
  szx: number, szy: number,
  lbl: XLabelT | null = null,
): ObjectT {
  return { pos: { x: px, y: py }, sz: { x: szx, y: szy }, lbl };
}

function makeParams(
  urx: number, ury: number, force = false,
): LabelParamsT {
  return { bb: { ll: { x: 0, y: 0 }, ur: { x: urx, y: ury } }, force };
}

// ---------------------------------------------------------------------------
// hdHilSFromXy — pinned against C probe output
// ---------------------------------------------------------------------------

describe('hdHilSFromXy', () => {
  // n=1 probe values
  it('n=1: all four cells', () => {
    expect(hdHilSFromXy(0, 0, 1)).toBe(0);
    expect(hdHilSFromXy(0, 1, 1)).toBe(1);
    expect(hdHilSFromXy(1, 1, 1)).toBe(2);
    expect(hdHilSFromXy(1, 0, 1)).toBe(3);
  });

  // n=2 probe values — full 4×4 Hilbert traversal
  it('n=2: full 16-cell traversal', () => {
    const expected = [
      [0,0,0],[1,0,1],[1,1,2],[0,1,3],
      [0,2,4],[0,3,5],[1,3,6],[1,2,7],
      [2,2,8],[2,3,9],[3,3,10],[3,2,11],
      [3,1,12],[3,0,15],[2,0,14],[2,1,13],
    ] as const;
    for (const [x, y, code] of expected) {
      expect(hdHilSFromXy(x, y, 2), `hil(${x},${y},2)`).toBe(code);
    }
  });

  // n=3 spot checks
  it('n=3: spot checks', () => {
    expect(hdHilSFromXy(5, 3, 3)).toBe(52);
    expect(hdHilSFromXy(7, 7, 3)).toBe(42);
    expect(hdHilSFromXy(0, 0, 3)).toBe(0);
    expect(hdHilSFromXy(4, 4, 3)).toBe(32);
  });
});

// ---------------------------------------------------------------------------
// placeLabels — end-to-end fixtures
// ---------------------------------------------------------------------------

// Single-object placement fixtures (A, B, null-skip)
describe('placeLabels single-object', () => {
  // Oracle (C probe probe_place2 fixture_a): r=0, set=1, pos=(-5,30)
  it('fixture_a: one object+label, no obstacles', () => {
    const lbl = makeLbl(15, 10);
    const objs = [makeObj(10, 10, 20, 20, lbl)];
    const r = placeLabels(objs, [lbl], makeParams(200, 200));
    expect(r).toBe(0);
    expect(lbl.set).toBe(1);
    expect(lbl.pos.x).toBe(-5);
    expect(lbl.pos.y).toBe(30);
  });

  // Oracle (C probe fixture_b): same result — xladjust still runs
  it('fixture_b: pre-set label adjusted to (-5,30)', () => {
    const lbl = makeLbl(15, 10, 5, 5, 1);
    const objs = [makeObj(10, 10, 20, 20, lbl)];
    const r = placeLabels(objs, [lbl], makeParams(200, 200));
    expect(r).toBe(0);
    expect(lbl.set).toBe(1);
    expect(lbl.pos.x).toBe(-5);
    expect(lbl.pos.y).toBe(30);
  });

  it('skips objects with null lbl', () => {
    const objs = [makeObj(10, 10, 20, 20, null)];
    const r = placeLabels(objs, [], makeParams(200, 200));
    expect(r).toBe(0);
  });
});

// Oracle (C probe fixture_c): lbl0.pos=(-50,5), lbl1.pos=(2,7)
describe('placeLabels fixture_c', () => {
  it('two close objects, large labels — both placed', () => {
    const lbl0 = makeLbl(50, 50);
    const lbl1 = makeLbl(50, 50);
    const objs = [
      makeObj(0, 0, 5, 5, lbl0),
      makeObj(2, 2, 5, 5, lbl1),
    ];
    const r = placeLabels(objs, [lbl0, lbl1], makeParams(200, 200));
    expect(r).toBe(0);
    expect(lbl0.set).toBe(1);
    expect(lbl1.set).toBe(1);
    expect(lbl0.pos.x).toBe(-50);
    expect(lbl0.pos.y).toBe(5);
    expect(lbl1.pos.x).toBe(2);
    expect(lbl1.pos.y).toBe(7);
  });
});

// Oracle (C probe probe_place.c): r=0, set=1, pos=(-5,30)
describe('placeLabels micro-fixture', () => {
  it('obstacle at (100,100), label on (10,10)', () => {
    const lbl = makeLbl(15, 10);
    const objs = [
      makeObj(10, 10, 20, 20, lbl),
      makeObj(100, 100, 5, 5, null),
    ];
    const r = placeLabels(objs, [lbl], makeParams(200, 200));
    expect(r).toBe(0);
    expect(lbl.set).toBe(1);
    expect(lbl.pos.x).toBe(-5);
    expect(lbl.pos.y).toBe(30);
  });
});
