// SPDX-License-Identifier: EPL-2.0

/**
 * Star shape vertices. C's star_gen fills 10 vertices alternating an outer
 * radius `r` (even indices) and an inner radius `r0` (odd indices); the port
 * previously rendered `shape=star` as a plain regular decagon.
 *
 * @see lib/common/shapes.c:star_vertices
 */

import { describe, it, expect } from 'vitest';
import { starVertices, boxVertices } from './poly-vertices.js';
import { renderSvg } from '../index.js';

describe('boxVertices orientation', () => {
  it('orientation=0 starts at the top-right corner (unchanged legacy order)', () => {
    expect(boxVertices(10, 6, 0)).toEqual([
      { x: 5, y: 3 }, { x: -5, y: 3 }, { x: -5, y: -3 }, { x: 5, y: -3 },
    ]);
  });

  it('orientation steps the first corner TR->TL->BL->BR', () => {
    expect(boxVertices(10, 6, 90)[0]).toEqual({ x: -5, y: 3 }); // TL
    expect(boxVertices(10, 6, 180)[0]).toEqual({ x: -5, y: -3 }); // BL
    expect(boxVertices(10, 6, 270)[0]).toEqual({ x: 5, y: -3 }); // BR
  });

  it('always yields the same rectangle regardless of orientation', () => {
    const set = (o: number): string =>
      boxVertices(10, 6, o).map((p) => `${p.x},${p.y}`).sort().join(' ');
    expect(set(270)).toBe(set(0));
  });
});

describe('starVertices', () => {
  it('produces 10 vertices', () => {
    expect(starVertices(100, 100)).toHaveLength(10);
  });

  it('alternates an outer ring (even) fully outside the inner ring (odd)', () => {
    const v = starVertices(100, 100);
    const dist = (i: number): number => Math.hypot(v[i]!.x, v[i]!.y);
    const outer = [0, 2, 4, 6, 8].map(dist);
    const inner = [1, 3, 5, 7, 9].map(dist);
    // A star: the closest outer point is still farther than the farthest inner
    // point (a regular decagon would have all ten equidistant).
    expect(Math.min(...outer)).toBeGreaterThan(Math.max(...inner));
  });
});

// A star's outer points reach beyond its label box, so poly_init folds the
// aspect-adjusted vertex extent into ND_ht (shapes.c:2214-2277 poly_desc
// branch, star_vertices *bb mutation). Undercounting it (a regular decagon
// inscribed in the box) leaves the node at the un-inflated 0.5in minimum and
// shrinks every rank gap. Oracle-pinned (native dot 15.1.0): two default star
// nodes on a->b render a 147pt-tall SVG (rank pitch 87.35, not 72).
// Regression: 1718 (16x-row star grid) had a 21% too-short bbox.
describe('shape=star — node height folds the star vertex extent (native 15.1.0)', () => {
  it('two stacked default stars yield a 147pt SVG, not 116pt', () => {
    const svg = renderSvg('digraph { node[shape=star label="" style=filled]; a -> b }', 'dot');
    const m = /<svg width="\d+pt" height="(\d+)pt"/.exec(svg);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(147);
  });

  // Edge clipping must use the star's own inside test (the outer-tip pentagram),
  // not the generic concave-decagon poly_inside — otherwise the edge stops
  // short of the star point. Oracle: the a->b spline ends at 27,-64.06 (reaching
  // node b's top tip), not the pre-fix 27,-43.48. @see shapes.c:star_inside
  it('edge clips to the star tip (spline reaches native 27,-64.06)', () => {
    const svg = renderSvg('digraph { node[shape=star label="" style=filled]; a -> b }', 'dot');
    expect(svg).toContain('d="M27,-99.07C27,-89.72 27,-76.58 27,-64.06"');
  });
});
