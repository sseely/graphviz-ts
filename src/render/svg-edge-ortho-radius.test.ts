// SPDX-License-Identifier: EPL-2.0
//
// Oracle-pinned against native dot (emit.c find_ortho_corners / process_corner /
// calculate_wedge_parameters) for graphs/radius.gv edge1. The edge1 spline
// (graphviz-internal y-up) bends vertical→horizontal at (27,18); native's
// GV_XDUMP reports wedge_center=(35,26), a1=PI, a2=3PI/2, trunc_prev=(27,26),
// trunc_next=(35,18).

import { describe, it, expect } from 'vitest';
import {
  findOrthoCorners, orthoRoundedPolylines, type CornerInfo,
} from './svg-edge-ortho-radius.js';

// graphs-radius edge1 spline control points, internal y-up (SVG negates y).
// M27,71.83 C 27,50.5  27,18  27,18   27,18  51.04,18  51.04,18
const EDGE1: { x: number; y: number }[] = [
  { x: 27, y: 71.83 }, { x: 27, y: 50.5 }, { x: 27, y: 18 },
  { x: 27, y: 18 }, { x: 27, y: 18 }, { x: 51.04, y: 18 }, { x: 51.04, y: 18 },
];

describe('findOrthoCorners — oracle-pinned vs native emit.c', () => {
  it('finds exactly one corner at the (27,18) bend (duplicates deduped)', () => {
    const corners = findOrthoCorners(EDGE1, 8);
    expect(corners.length).toBe(1);
    expect(EDGE1[corners[0].idx]).toEqual({ x: 27, y: 18 });
  });

  it('computes the C truncation points and wedge for that corner', () => {
    const c: CornerInfo = findOrthoCorners(EDGE1, 8)[0];
    expect(c.truncPrev.x).toBeCloseTo(27, 4);
    expect(c.truncPrev.y).toBeCloseTo(26, 4);
    expect(c.truncNext.x).toBeCloseTo(35, 4);
    expect(c.truncNext.y).toBeCloseTo(18, 4);
    expect(c.wedgeCenter.x).toBeCloseTo(35, 4);
    expect(c.wedgeCenter.y).toBeCloseTo(26, 4);
    expect(c.angle1).toBeCloseTo(Math.PI, 9);
    expect(c.angle2).toBeCloseTo((3 * Math.PI) / 2, 9);
  });

  it('returns no corner for a non-orthogonal (diagonal) bend', () => {
    const diag = [
      { x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 },
    ];
    expect(findOrthoCorners(diag, 8)).toEqual([]);
  });

  it('covers a right-then-down corner (case 1): center=(curr-r, curr-r), a1=0 a2=PI/2', () => {
    // horizontal (left→right) then vertical (down): prev=(0,10) curr=(10,10) next=(10,0)
    const pts = [{ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }];
    const c = findOrthoCorners(pts, 4)[0];
    expect(c.wedgeCenter).toEqual({ x: 6, y: 6 });
    expect(c.angle1).toBeCloseTo(0, 9);
    expect(c.angle2).toBeCloseTo(Math.PI / 2, 9);
  });
});

describe('orthoRoundedPolylines — emit order matches native (seg1, seg2, arc)', () => {
  it('emits 3 polylines conformant with graphs-radius edge1', () => {
    const polys = orthoRoundedPolylines(EDGE1, 8);
    expect(polys.length).toBe(3);
    // seg1: start → through (27,50.5) → trunc_prev (27,26)
    expect(polys[0]).toEqual([
      { x: 27, y: 71.83 }, { x: 27, y: 50.5 }, { x: 27, y: 26 },
    ]);
    // seg2: trunc_next (35,18) → end (51.04,18)
    expect(polys[1]).toEqual([{ x: 35, y: 18 }, { x: 51.04, y: 18 }]);
    // arc: the 25-point wedge slice (27,26)…(35,18)
    expect(polys[2].length).toBe(25);
    expect(polys[2][0].x).toBeCloseTo(27, 4);
    expect(polys[2][0].y).toBeCloseTo(26, 4);
    expect(polys[2][24].x).toBeCloseTo(35, 4);
    expect(polys[2][24].y).toBeCloseTo(18, 4);
  });

  it('returns [] when there is no orthogonal corner (caller falls back to bezier)', () => {
    const diag = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }];
    expect(orthoRoundedPolylines(diag, 8)).toEqual([]);
  });
});
