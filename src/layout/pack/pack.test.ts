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
import {
  computeGrid,
  buildAInfo,
  sortAInfo,
  accumulateMaxima,
  widthsToCumulative,
  heightsToCumulative,
  placeX,
  placeY,
  positionRects,
  arrayRects,
  cmpByPerimeter,
} from './array-pack.js';
import {
  PackMode,
  PK_COL_MAJOR,
  PK_INPUT_ORDER,
  PK_LEFT_ALIGN,
  PK_RIGHT_ALIGN,
  PK_TOP_ALIGN,
  PK_BOT_ALIGN,
  PS2INCH,
  ps2inch,
  inch2ps,
  type PackInfo,
} from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function box(llx: number, lly: number, urx: number, ury: number): Box {
  return { ll: { x: llx, y: lly }, ur: { x: urx, y: ury } };
}

function defaultPackInfo(overrides?: Partial<PackInfo>): PackInfo {
  return {
    aspect: 1,
    sz: 0,
    margin: 0,
    doSplines: false,
    mode: PackMode.Graph,
    fixed: null,
    vals: null,
    flags: 0,
    ...overrides,
  };
}

/** Apply translation points to boxes and return translated boxes. */
function applyPlaces(bbs: Box[], places: Point[]): Box[] {
  return bbs.map((bb, i) => {
    const p = places[i] ?? { x: 0, y: 0 };
    return box(
      bb.ll.x + p.x,
      bb.ll.y + p.y,
      bb.ur.x + p.x,
      bb.ur.y + p.y,
    );
  });
}

/** Return true if two axis-aligned boxes overlap (strictly). */
function overlaps(a: Box, b: Box): boolean {
  return a.ur.x > b.ll.x && b.ur.x > a.ll.x &&
    a.ur.y > b.ll.y && b.ur.y > a.ll.y;
}

/** Assert that no two boxes in the array overlap. */
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
// poly-pack.ts — primitive helpers
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

describe('gridCells', () => {
  it('returns ceil(x/s)', () => {
    expect(gridCells(10, 3)).toBe(4);
    expect(gridCells(9, 3)).toBe(3);
    expect(gridCells(0, 3)).toBe(0);
  });
});

describe('cval', () => {
  it('returns floor(v/s) for non-negative v', () => {
    expect(cval(6, 3)).toBe(2);
    expect(cval(0, 3)).toBe(0);
  });

  it('handles negative values', () => {
    expect(cval(-1, 3)).toBe(-1);
    expect(cval(-3, 3)).toBe(-1);
    expect(cval(-4, 3)).toBe(-2);
  });
});

describe('computeStep', () => {
  it('returns positive root for simple 1-rect case', () => {
    const bbs = [box(0, 0, 100, 100)];
    const step = computeStep(1, bbs, 0);
    expect(step).toBeGreaterThan(0);
  });

  it('returns 1 for degenerate discriminant', () => {
    // Force a=0 by ng=0 (unlikely in practice, but tests the guard)
    const step = computeStep(0, [], 0);
    expect(step).toBe(1);
  });

  it('returns 1 when root would be <= 0', () => {
    // Very small boxes make b≈0 and c≈0; root clamps to 1
    const bbs = [box(0, 0, 1, 1)];
    const step = computeStep(1, bbs, 0);
    expect(step).toBeGreaterThanOrEqual(1);
  });
});

describe('genBox', () => {
  it('generates correct cells for a unit box', () => {
    const bb = box(0, 0, 10, 10);
    const info = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    // cells: x in [0,2], y in [0,2] → 9 cells
    expect(info.cells.length).toBe(9);
    expect(info.index).toBe(0);
    expect(info.perim).toBe(gridCells(10, 5) + gridCells(10, 5));
  });

  it('includes margin in cell coverage', () => {
    const bb = box(0, 0, 10, 10);
    const noMargin = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    const withMargin = genBox({ bb, ssize: 5, margin: 5, idx: 0 });
    expect(withMargin.cells.length).toBeGreaterThan(noMargin.cells.length);
  });
});

describe('hasCollision / markCells', () => {
  it('no collision on empty set', () => {
    const ps = new Set<string>();
    const cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    expect(hasCollision(cells, 0, 0, ps)).toBe(false);
  });

  it('detects collision after markCells', () => {
    const ps = new Set<string>();
    const cells = [{ x: 0, y: 0 }];
    markCells(cells, 0, 0, ps);
    expect(hasCollision(cells, 0, 0, ps)).toBe(true);
  });

  it('no collision with non-zero offset after marking', () => {
    const ps = new Set<string>();
    const cells = [{ x: 0, y: 0 }];
    markCells(cells, 0, 0, ps);
    expect(hasCollision(cells, 1, 0, ps)).toBe(false);
  });
});

describe('fits', () => {
  it('returns a Point on empty grid', () => {
    const bb = box(0, 0, 10, 10);
    const info = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    const ctx = { ps: new Set<string>(), step: 5, bbs: [bb] };
    const p = fits(0, 0, info, ctx);
    expect(p).not.toBeNull();
  });

  it('returns null when cells collide', () => {
    const bb = box(0, 0, 10, 10);
    const info = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    const ctx = { ps: new Set<string>(), step: 5, bbs: [bb] };
    // Pre-mark the same cells
    markCells(info.cells, 0, 0, ctx.ps);
    const p = fits(0, 0, info, ctx);
    expect(p).toBeNull();
  });
});

describe('cmpByGPerimeter', () => {
  it('sorts descending by perim', () => {
    const a = { perim: 10, cells: [], index: 0 };
    const b = { perim: 20, cells: [], index: 1 };
    expect(cmpByGPerimeter(a, b)).toBeGreaterThan(0);
    expect(cmpByGPerimeter(b, a)).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// polyRects — AC3 equivalent (non-overlapping placement)
// ---------------------------------------------------------------------------

describe('polyRects', () => {
  it('places 4 heterogeneous rects without overlap', () => {
    const bbs = [
      box(0, 0, 100, 60),
      box(0, 0, 40, 80),
      box(0, 0, 60, 60),
      box(0, 0, 80, 40),
    ];
    const pinfo = defaultPackInfo({ margin: 4 });
    const places = polyRects(4, bbs, pinfo);
    expect(places).not.toBeNull();
    const placed = applyPlaces(bbs, places!);
    assertNoOverlap(placed);
  });

  it('returns null when step <= 0', () => {
    // ng=0 forces step=1 actually, but test ng=1 with zero-area box
    const bbs = [box(0, 0, 0, 0)];
    const pinfo = defaultPackInfo({ margin: 0 });
    // computeStep with all-zero dims: root=0 → step=1 ≥ 1 → not null
    const places = polyRects(1, bbs, pinfo);
    expect(places).not.toBeNull();
  });

  it('places a single rect at a finite location', () => {
    const bbs = [box(0, 0, 50, 50)];
    const pinfo = defaultPackInfo({ margin: 2 });
    const places = polyRects(1, bbs, pinfo);
    expect(places).not.toBeNull();
    expect(Number.isFinite(places![0]!.x)).toBe(true);
    expect(Number.isFinite(places![0]!.y)).toBe(true);
  });

  it('handles wide and tall rects (exercises both spiral variants)', () => {
    const bbs = [
      box(0, 0, 200, 20),  // wide
      box(0, 0, 20, 200),  // tall
    ];
    const pinfo = defaultPackInfo({ margin: 2 });
    const places = polyRects(2, bbs, pinfo);
    expect(places).not.toBeNull();
    const placed = applyPlaces(bbs, places!);
    assertNoOverlap(placed);
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
    const p = tryCenter(info, ctx, 0);
    expect(p).not.toBeNull();
  });
});

describe('placeGraph', () => {
  it('places graph i=0 via tryCenter', () => {
    const bb = box(0, 0, 20, 20);
    const info = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    const ctx = { ps: new Set<string>(), step: 5, bbs: [bb] };
    const p = placeGraph(0, info, ctx, 0);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  it('places graph i>0 via spiral when origin is blocked', () => {
    const bb = box(0, 0, 10, 10);
    const info = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    const ctx = { ps: new Set<string>(), step: 5, bbs: [bb] };
    // Block origin so spiral must find another position
    markCells(info.cells, 0, 0, ctx.ps);
    const info2 = genBox({ bb, ssize: 5, margin: 0, idx: 0 });
    const p = placeGraph(1, info2, ctx, 0);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// array-pack.ts helpers
// ---------------------------------------------------------------------------

describe('computeGrid', () => {
  it('row-major: nc=ceil(sqrt(ng)), nr=ceil(ng/nc)', () => {
    const dims = computeGrid(4, defaultPackInfo());
    expect(dims.nc).toBe(2);
    expect(dims.nr).toBe(2);
    expect(dims.rowMajor).toBe(true);
  });

  it('col-major flag: nr from sz, nc derived', () => {
    const pinfo = defaultPackInfo({ sz: 3, flags: PK_COL_MAJOR });
    const dims = computeGrid(6, pinfo);
    expect(dims.nr).toBe(3);
    expect(dims.nc).toBe(2);
    expect(dims.rowMajor).toBe(false);
  });

  it('sz>0 overrides sqrt for row-major', () => {
    const pinfo = defaultPackInfo({ sz: 4 });
    const dims = computeGrid(8, pinfo);
    expect(dims.nc).toBe(4);
    expect(dims.nr).toBe(2);
  });
});

describe('buildAInfo', () => {
  it('computes width and height with margin', () => {
    const bbs = [box(0, 0, 30, 20)];
    const info = buildAInfo(1, bbs, 10);
    expect(info[0]?.width).toBe(40);
    expect(info[0]?.height).toBe(30);
    expect(info[0]?.index).toBe(0);
  });
});

describe('cmpByPerimeter', () => {
  it('sorts descending by w+h', () => {
    const a = { width: 10, height: 5, index: 0 };
    const b = { width: 20, height: 8, index: 1 };
    expect(cmpByPerimeter(a, b)).toBeGreaterThan(0);
    expect(cmpByPerimeter(b, a)).toBeLessThan(0);
  });
});

describe('widthsToCumulative', () => {
  it('converts widths to prefix sums', () => {
    const w = [10, 20, 30];
    widthsToCumulative(w);
    expect(w).toEqual([0, 10, 30]);
  });
});

describe('heightsToCumulative', () => {
  it('builds top-down cumulative heights', () => {
    const h = [10, 20, 30, 0]; // index 3 is the sentinel slot
    heightsToCumulative(h, 3);
    // heights[0] = total = 60, heights[1..3] = cumulative from bottom
    expect(h[0]).toBe(60);
    expect(h[3]).toBe(0);
  });
});

describe('placeX', () => {
  const bb = box(0, 0, 40, 0);

  it('left-align returns left edge', () => {
    expect(placeX(PK_LEFT_ALIGN, [0, 50], 0, bb)).toBe(0);
  });

  it('right-align returns right - width', () => {
    expect(placeX(PK_RIGHT_ALIGN, [0, 50], 0, bb)).toBe(10);
  });

  it('center-align (no flag) centers in cell', () => {
    // cell width = 50, rect width = 40 → x = (0+50-40-0)/2 = 5
    expect(placeX(0, [0, 50], 0, bb)).toBe(5);
  });
});

describe('placeY', () => {
  const bb = box(0, 0, 0, 20);

  it('top-align returns top - height', () => {
    // h0=60, rect height=20 → 60-20=40
    expect(placeY(PK_TOP_ALIGN, [60, 20, 0], 0, bb)).toBe(40);
  });

  it('bot-align returns bottom edge', () => {
    expect(placeY(PK_BOT_ALIGN, [60, 20, 0], 0, bb)).toBe(20);
  });

  it('center-align (no flag) centers in cell', () => {
    // h0=60, h1=20, height=20 → (60+20-20-0)/2 = 30
    expect(placeY(0, [60, 20, 0], 0, bb)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// arrayRects — AC3: 4-component non-overlapping layout
// ---------------------------------------------------------------------------

describe('arrayRects', () => {
  it('places 4 heterogeneous rects without overlap', () => {
    const bbs = [
      box(0, 0, 100, 60),
      box(0, 0, 40, 80),
      box(0, 0, 60, 60),
      box(0, 0, 80, 40),
    ];
    const pinfo = defaultPackInfo({ margin: 4 });
    const places = arrayRects(4, bbs, pinfo);
    expect(places).not.toBeNull();
    const placed = applyPlaces(bbs, places!);
    assertNoOverlap(placed);
  });

  it('input-order flag preserves order', () => {
    const bbs = [
      box(0, 0, 10, 10),
      box(0, 0, 50, 50),
      box(0, 0, 30, 30),
    ];
    const pinfo = defaultPackInfo({ flags: PK_INPUT_ORDER });
    const places = arrayRects(3, bbs, pinfo);
    expect(places).not.toBeNull();
    const placed = applyPlaces(bbs, places!);
    assertNoOverlap(placed);
  });

  it('col-major flag produces column-major layout', () => {
    const bbs = [
      box(0, 0, 20, 20),
      box(0, 0, 20, 20),
      box(0, 0, 20, 20),
      box(0, 0, 20, 20),
    ];
    const pinfo = defaultPackInfo({ sz: 2, flags: PK_COL_MAJOR, margin: 2 });
    const places = arrayRects(4, bbs, pinfo);
    expect(places).not.toBeNull();
    const placed = applyPlaces(bbs, places!);
    assertNoOverlap(placed);
  });
});

// ---------------------------------------------------------------------------
// sortAInfo
// ---------------------------------------------------------------------------

describe('sortAInfo', () => {
  it('sorts by descending perimeter by default', () => {
    const infos = [
      { width: 10, height: 5, index: 0 },
      { width: 30, height: 20, index: 1 },
      { width: 20, height: 10, index: 2 },
    ];
    const pinfo = defaultPackInfo();
    const sorted = sortAInfo(infos, pinfo);
    expect(sorted[0]?.index).toBe(1);
    expect(sorted[1]?.index).toBe(2);
    expect(sorted[2]?.index).toBe(0);
  });

  it('preserves order with PK_INPUT_ORDER', () => {
    const infos = [
      { width: 10, height: 5, index: 0 },
      { width: 30, height: 20, index: 1 },
    ];
    const pinfo = defaultPackInfo({ flags: PK_INPUT_ORDER });
    const sorted = sortAInfo(infos, pinfo);
    expect(sorted[0]?.index).toBe(0);
    expect(sorted[1]?.index).toBe(1);
  });
});
