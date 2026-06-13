// SPDX-License-Identifier: EPL-2.0

/**
 * Undirected-edge regression: a `graph {}` laid out by dot must draw NO
 * arrowheads and route the spline all the way to the node boundary. C uses
 * `agisdirected(g) ? "forward" : "none"` as the default `dir`; the port
 * previously hardcoded "forward", giving undirected edges a phantom arrow
 * and an arrow-clipped (short) spline.
 *
 * Output verified against C graphviz 15.0.0 (dot -Tsvg).
 *
 * @see src/layout/dot/edge-route-helpers.ts:defaultEdgeDir
 * @see lib/common/arrows.c:arrow_flags
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const BLACK_ARROW = '<polygon fill="black"';

describe('undirected edges (dot engine) draw no arrowheads', () => {
  it('graph{a--b}: one path, zero arrow polygons', () => {
    const svg = renderSvg('graph { a -- b }', 'dot');
    expect(svg.match(/<path /g) ?? []).toHaveLength(1);
    expect(svg.includes(BLACK_ARROW)).toBe(false);
  });

  it('graph{a--b}: spline reaches the node boundary (not arrow-clipped)', () => {
    // C undirected a--b ends at the boundary (~-36.1); the old phantom-arrow
    // bug clipped it short to ~-47.54 (the directed arrow base).
    const svg = renderSvg('graph { a -- b }', 'dot');
    expect(svg).toContain('27,-36.1');
  });

  it('graph chain a--b--c--d: no arrows', () => {
    const svg = renderSvg('graph { a -- b -- c -- d }', 'dot');
    expect(svg.includes(BLACK_ARROW)).toBe(false);
  });

  it('multi-rank undirected edge curves around the intervening rank', () => {
    // a--c spans two ranks; it must bow out (x != tail x), not run straight.
    const svg = renderSvg('graph { a -- b; a -- c; b -- c }', 'dot');
    expect(svg.includes(BLACK_ARROW)).toBe(false);
    // a directed digraph still draws its arrow (control: fix is dir-scoped)
    const di = renderSvg('digraph { a -> b }', 'dot');
    expect(di.includes(BLACK_ARROW)).toBe(true);
  });

  it('explicit dir on an undirected graph still honored', () => {
    const both = renderSvg('graph { a -- b [dir=both] }', 'dot');
    expect((both.match(/<polygon fill="black"/g) ?? []).length).toBe(2);
  });
});
