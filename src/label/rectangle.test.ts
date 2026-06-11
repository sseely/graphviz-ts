// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import {
  NUMDIMS,
  NUMSIDES,
  CX,
  NX,
  CY,
  NY,
  initRect,
  nullRect,
  rectArea,
  combineRect,
  overlap,
  type Rect,
} from './rectangle.js';

// Hand-computed cases derived from the C implementation.
// Boundary layout: [lowX, lowY, highX, highY]
// i.e. CX(0)=0, CY(0)=1, NX(0)=2, NY(0)=3

describe('constants', () => {
  it('NUMDIMS is 2', () => {
    expect(NUMDIMS).toBe(2);
  });

  it('NUMSIDES is 4', () => {
    expect(NUMSIDES).toBe(4);
  });
});

describe('index helpers', () => {
  it('CX(0) = 0', () => expect(CX(0)).toBe(0));
  it('CY(0) = 1', () => expect(CY(0)).toBe(1));
  it('NX(0) = 2', () => expect(NX(0)).toBe(2));
  it('NY(0) = 3', () => expect(NY(0)).toBe(3));
});

describe('initRect', () => {
  it('fills boundary with zeros', () => {
    const r: Rect = { boundary: [1, 2, 3, 4] };
    initRect(r);
    expect(r.boundary).toEqual([0, 0, 0, 0]);
  });
});

describe('nullRect', () => {
  it('returns a rect whose boundary[0] > boundary[NUMDIMS]', () => {
    const r = nullRect();
    // C: boundary[0]=1, boundary[NUMDIMS=2]=-1
    expect(r.boundary[0]).toBe(1);
    expect(r.boundary[NUMDIMS]).toBe(-1);
    // undefined check: boundary[0] > boundary[NUMDIMS]
    expect(r.boundary[0] > r.boundary[NUMDIMS]).toBe(true);
  });

  it('has remaining slots zero', () => {
    const r = nullRect();
    // Only slots 0 and 2 are set; slots 1 and 3 remain 0
    expect(r.boundary[1]).toBe(0);
    expect(r.boundary[3]).toBe(0);
  });
});

describe('rectArea', () => {
  it('returns 0 for an undefined (null) rect', () => {
    expect(rectArea(nullRect())).toBe(0);
  });

  it('returns 0 when a dimension has zero width', () => {
    // lowX=0, lowY=0, highX=5, highY=0 → height dim = 0
    const r: Rect = { boundary: [0, 0, 5, 0] };
    expect(rectArea(r)).toBe(0);
  });

  it('returns width*height for a normal rect', () => {
    // lowX=0, lowY=0, highX=4, highY=3 → area=12
    const r: Rect = { boundary: [0, 0, 4, 3] };
    expect(rectArea(r)).toBe(12);
  });

  it('returns area for a rect with non-zero origin', () => {
    // lowX=2, lowY=1, highX=6, highY=4 → widths: 4, 3 → area=12
    const r: Rect = { boundary: [2, 1, 6, 4] };
    expect(rectArea(r)).toBe(12);
  });

  it('returns area of 1x1 rect', () => {
    const r: Rect = { boundary: [0, 0, 1, 1] };
    expect(rectArea(r)).toBe(1);
  });
});

// C Overlap: for each dim i, false if r.lo[i] > s.hi[i] OR s.lo[i] > r.hi[i]
describe('overlap — true cases', () => {
  it('overlapping rects', () => {
    expect(overlap({ boundary: [0, 0, 4, 4] }, { boundary: [2, 2, 6, 6] })).toBe(true);
  });
  it('one rect inside the other', () => {
    expect(overlap({ boundary: [0, 0, 10, 10] }, { boundary: [2, 2, 5, 5] })).toBe(true);
  });
  it('identical rects', () => {
    const r: Rect = { boundary: [1, 1, 3, 3] };
    expect(overlap(r, r)).toBe(true);
  });
  it('touching edge — C uses strict >, so equal passes', () => {
    expect(overlap({ boundary: [0, 0, 2, 2] }, { boundary: [2, 0, 4, 2] })).toBe(true);
  });
});

describe('overlap — false cases', () => {
  it('disjoint in x', () => {
    expect(overlap({ boundary: [0, 0, 2, 2] }, { boundary: [3, 0, 5, 2] })).toBe(false);
  });
  it('disjoint in y', () => {
    expect(overlap({ boundary: [0, 0, 2, 2] }, { boundary: [0, 3, 2, 5] })).toBe(false);
  });
  it('r entirely left of s', () => {
    expect(overlap({ boundary: [0, 0, 1, 1] }, { boundary: [5, 0, 6, 1] })).toBe(false);
  });
});

// C combineRect uses fmin for BOTH low and high sides (not fmax on high)
describe('combineRect — null identity', () => {
  it('returns rr when r is null', () => {
    expect(combineRect(nullRect(), { boundary: [1, 2, 3, 4] }).boundary).toEqual([1, 2, 3, 4]);
  });
  it('returns r when rr is null', () => {
    expect(combineRect({ boundary: [1, 2, 3, 4] }, nullRect()).boundary).toEqual([1, 2, 3, 4]);
  });
  it('identical rects return same boundary', () => {
    expect(combineRect({ boundary: [1, 2, 5, 6] }, { boundary: [1, 2, 5, 6] }).boundary)
      .toEqual([1, 2, 5, 6]);
  });
});

describe('combineRect — fmin semantics', () => {
  it('overlapping: fmin on all sides', () => {
    // lo: fmin(0,2)=0,0  hi: fmin(4,6)=4,4
    const res = combineRect({ boundary: [0, 0, 4, 4] }, { boundary: [2, 2, 6, 6] });
    expect(res.boundary).toEqual([0, 0, 4, 4]);
  });
  it('disjoint: fmin on all sides', () => {
    // lo: fmin(0,4)=0,0  hi: fmin(2,6)=2,2
    const res = combineRect({ boundary: [0, 0, 2, 2] }, { boundary: [4, 4, 6, 6] });
    expect(res.boundary).toEqual([0, 0, 2, 2]);
  });
});
