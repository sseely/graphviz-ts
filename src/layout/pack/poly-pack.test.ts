// SPDX-License-Identifier: EPL-2.0

import { describe, it, expect } from 'vitest';
import type { Box, Point } from '../../model/geom.js';
import {
  computeStep,
  gridCells,
  cval,
  genBox,
  fits,
  hasCollision,
  markCells,
  tryCenter,
  placeGraph,
  polyRects,
  psKey,
  inPS,
  insertPS,
  cmpByGPerimeter,
} from './poly-pack.js';
import { cround } from '../../common/arith.js';
import { PS2INCH, ps2inch, inch2ps, type PackInfo, PackMode } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function box(llx: number, lly: number, urx: number, ury: number): Box {
  return { ll: { x: llx, y: lly }, ur: { x: urx, y: ury } };
}

function defaultPackInfo(overrides?: Partial<PackInfo>): PackInfo {
  return {
    aspect: 1, sz: 0, margin: 0, doSplines: false,
    mode: PackMode.Graph, fixed: null, vals: null, flags: 0,
    ...overrides,
  };
}

function applyPlaces(bbs: Box[], places: Point[]): Box[] {
  return bbs.map((bb, i) => {
    const p = places[i] ?? { x: 0, y: 0 };
    return box(bb.ll.x + p.x, bb.ll.y + p.y, bb.ur.x + p.x, bb.ur.y + p.y);
  });
}

function overlaps(a: Box, b: Box): boolean {
  return a.ur.x > b.ll.x && b.ur.x > a.ll.x &&
    a.ur.y > b.ll.y && b.ur.y > a.ll.y;
}

function assertNoOverlap(placed: Box[]): void {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i];
      const b = placed[j];
      if (a !== undefined && b !== undefined) {
        expect(overlaps(a, b), `boxes ${i} and ${j} overlap`).toBe(false);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// types.ts — constants and helpers
// ---------------------------------------------------------------------------

describe('PS2INCH', () => {
  it('equals 1/72', () => {
    expect(PS2INCH).toBe(1 / 72);
  });

  it('ps2inch converts points to inches', () => {
    expect(ps2inch(72)).toBeCloseTo(1);
    expect(ps2inch(36)).toBeCloseTo(0.5);
  });

  it('inch2ps is the inverse of ps2inch', () => {
    expect(inch2ps(ps2inch(100))).toBeCloseTo(100);
  });
});

// ---------------------------------------------------------------------------
// psKey / inPS / insertPS
// ---------------------------------------------------------------------------

describe('psKey', () => {
  it('encodes integer coords', () => {
    expect(psKey(3, -2)).toBe('3,-2');
  });

  it('rounds non-integer inputs', () => {
    expect(psKey(3.4, 1.6)).toBe('3,2');
  });
});

describe('inPS / insertPS', () => {
  it('reports absent before insert', () => {
    const ps = new Set<string>();
    expect(inPS(ps, { x: 1, y: 2 })).toBe(false);
  });

  it('reports present after insert', () => {
    const ps = new Set<string>();
    insertPS(ps, { x: 1, y: 2 });
    expect(inPS(ps, { x: 1, y: 2 })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// gridCells / cval
// ---------------------------------------------------------------------------

describe('gridCells', () => {
  it('returns ceil(x/s)', () => {
    expect(gridCells(10, 3)).toBe(4);
    expect(gridCells(9, 3)).toBe(3);
    expect(gridCells(0, 3)).toBe(0);
  });
});

describe('cval', () => {
  it('returns v/s for non-negative v (float, C CVAL on double)', () => {
    expect(cval(6, 3)).toBe(2);
    expect(cval(0, 3)).toBe(0);
  });

  it('returns ((v+1)/s)-1 for negative v, as a fractional cell coordinate', () => {
    expect(cval(-1, 3)).toBe(-1);
    // C's CVAL is applied to a double, so this is -2/3 - 1 = -1.667, NOT the
    // truncated -1. genBox then round()s it (cround) to -2.
    expect(cval(-3, 3)).toBeCloseTo(-5 / 3, 10);
    expect(cval(-4, 3)).toBe(-2);
    // The osage pack_neato2 regression case: CVAL(-4,5) = -1.6 (→ cround -2).
    expect(cval(-4, 5)).toBeCloseTo(-1.6, 10);
    expect(cround(cval(-4, 5))).toBe(-2);
  });
});

describe('cround', () => {
  it('rounds half away from zero (C round())', () => {
    expect(cround(-1.6)).toBe(-2);
    expect(cround(-1.5)).toBe(-2);
    expect(cround(11.6)).toBe(12);
    expect(cround(2.5)).toBe(3);
    expect(cround(8)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// computeStep
// ---------------------------------------------------------------------------

describe('computeStep', () => {
  it('returns positive root for simple 1-rect case', () => {
    const step = computeStep(1, [box(0, 0, 100, 100)], 0);
    expect(step).toBeGreaterThan(0);
  });

  it('returns 1 for degenerate (ng=0) case', () => {
    expect(computeStep(0, [], 0)).toBe(1);
  });

  it('returns >= 1 for very small boxes', () => {
    expect(computeStep(1, [box(0, 0, 1, 1)], 0)).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// genBox
// ---------------------------------------------------------------------------

describe('genBox', () => {
  it('generates correct cell count for a 10×10 box at ssize=5', () => {
    const info = genBox({ bb: box(0, 0, 10, 10), ssize: 5, margin: 0, idx: 0 });
    expect(info.cells.length).toBe(9);
    expect(info.index).toBe(0);
  });

  it('includes margin in cell coverage', () => {
    const bb = box(0, 0, 10, 10);
    const noMargin = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    const withMargin = genBox({ bb, ssize: 5, margin: 5, idx: 0 });
    expect(withMargin.cells.length).toBeGreaterThan(noMargin.cells.length);
  });
});

// ---------------------------------------------------------------------------
// hasCollision / markCells
// ---------------------------------------------------------------------------

describe('hasCollision / markCells', () => {
  it('no collision on empty set', () => {
    const ps = new Set<string>();
    expect(hasCollision([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0, 0, ps)).toBe(false);
  });

  it('detects collision after markCells', () => {
    const ps = new Set<string>();
    markCells([{ x: 0, y: 0 }], 0, 0, ps);
    expect(hasCollision([{ x: 0, y: 0 }], 0, 0, ps)).toBe(true);
  });

  it('no collision with offset after marking origin', () => {
    const ps = new Set<string>();
    markCells([{ x: 0, y: 0 }], 0, 0, ps);
    expect(hasCollision([{ x: 0, y: 0 }], 1, 0, ps)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fits
// ---------------------------------------------------------------------------

describe('fits', () => {
  it('returns a Point on an empty grid', () => {
    const bb = box(0, 0, 10, 10);
    const info = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    const ctx = { ps: new Set<string>(), step: 5, bbs: [bb] };
    expect(fits(0, 0, info, ctx)).not.toBeNull();
  });

  it('returns null when cells are already occupied', () => {
    const bb = box(0, 0, 10, 10);
    const info = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    const ctx = { ps: new Set<string>(), step: 5, bbs: [bb] };
    markCells(info.cells, 0, 0, ctx.ps);
    expect(fits(0, 0, info, ctx)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// cmpByGPerimeter
// ---------------------------------------------------------------------------

describe('cmpByGPerimeter', () => {
  it('sorts descending by perim', () => {
    const a = { perim: 10, cells: [], index: 0 };
    const b = { perim: 20, cells: [], index: 1 };
    expect(cmpByGPerimeter(a, b)).toBeGreaterThan(0);
    expect(cmpByGPerimeter(b, a)).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// tryCenter / placeGraph
// ---------------------------------------------------------------------------

describe('tryCenter', () => {
  it('places first graph roughly at origin', () => {
    const bb = box(0, 0, 20, 20);
    const info = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    const ctx = { ps: new Set<string>(), step: 5, bbs: [bb] };
    expect(tryCenter(info, ctx, 0)).not.toBeNull();
  });
});

describe('placeGraph', () => {
  it('places graph i=0 at a finite location', () => {
    const bb = box(0, 0, 20, 20);
    const info = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    const ctx = { ps: new Set<string>(), step: 5, bbs: [bb] };
    const p = placeGraph(0, info, ctx, 0);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  it('places graph i>0 via spiral when origin is blocked', () => {
    const bb = box(0, 0, 10, 10);
    const ctx = { ps: new Set<string>(), step: 5, bbs: [bb] };
    const info1 = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    markCells(info1.cells, 0, 0, ctx.ps);
    const info2 = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    const p = placeGraph(1, info2, ctx, 0);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// polyRects — non-overlapping placement
// ---------------------------------------------------------------------------

describe('polyRects', () => {
  it('places 4 heterogeneous rects without overlap', () => {
    const bbs = [
      box(0, 0, 100, 60), box(0, 0, 40, 80),
      box(0, 0, 60, 60),  box(0, 0, 80, 40),
    ];
    const places = polyRects(4, bbs, defaultPackInfo({ margin: 4 }));
    expect(places).not.toBeNull();
    assertNoOverlap(applyPlaces(bbs, places!));
  });

  it('places a single rect at a finite location', () => {
    const bbs = [box(0, 0, 50, 50)];
    const places = polyRects(1, bbs, defaultPackInfo({ margin: 2 }));
    expect(places).not.toBeNull();
    expect(Number.isFinite(places![0]!.x)).toBe(true);
    expect(Number.isFinite(places![0]!.y)).toBe(true);
  });

  it('handles wide and tall rects (exercises both spiral variants)', () => {
    const bbs = [box(0, 0, 200, 20), box(0, 0, 20, 200)];
    const places = polyRects(2, bbs, defaultPackInfo({ margin: 2 }));
    expect(places).not.toBeNull();
    assertNoOverlap(applyPlaces(bbs, places!));
  });
});
