// SPDX-License-Identifier: EPL-2.0

/**
 * Periphery rendering: ring counts and suppression.
 * Expected values verified against C graphviz 15.0.0 on 2026-06-12.
 * @see lib/common/shapes.c:poly_gencode (peripheries draw loop)
 * @see lib/common/shapes.c:poly_init (ring vertex generation)
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

const polygons = (svg: string): string[] =>
  (svg.match(/<polygon[^>]*stroke="black"[^>]*/g) ?? []);
const ellipses = (svg: string): string[] => (svg.match(/<ellipse[^>]*/g) ?? []);

describe('peripheries=0 shapes draw no node boundary', () => {
  it('shape=plaintext', () => {
    expect(polygons(renderSvg('digraph { A [shape=plaintext label="hi"] }', 'dot'))).toHaveLength(0);
  });

  it('shape=none', () => {
    expect(polygons(renderSvg('digraph { A [shape=none label="hi"] }', 'dot'))).toHaveLength(0);
  });

  it('peripheries=0 attr on a box', () => {
    expect(polygons(renderSvg('digraph { A [shape=box peripheries=0] }', 'dot'))).toHaveLength(0);
  });
});

describe('multi-periphery rings', () => {
  it('doublecircle draws inner then outer ellipse, GAP=4 apart', () => {
    const els = ellipses(renderSvg('digraph { A [shape=doublecircle] }', 'dot'));
    expect(els).toHaveLength(2);
    expect(els[0]).toContain('rx="18"');
    expect(els[1]).toContain('rx="22"');
  });

  it('tripleoctagon draws three rings', () => {
    expect(polygons(renderSvg('digraph { A [shape=tripleoctagon] }', 'dot'))).toHaveLength(3);
  });

  it('doubleoctagon inner ring matches C bisector offsets', () => {
    const svg = renderSvg('digraph { A [shape=doubleoctagon] }', 'dot');
    expect(svg).toContain('points="58,-14.54 58,-29.46 42.18,-40 19.82,-40 4,-29.46 4,-14.54 19.82,-4 42.18,-4 58,-14.54"');
  });

  it('peripheries attr adds box rings', () => {
    expect(polygons(renderSvg('digraph { A [shape=box peripheries=3] }', 'dot'))).toHaveLength(3);
  });
});

describe('single-periphery output unchanged', () => {
  it('default ellipse node still draws one ring', () => {
    expect(ellipses(renderSvg('digraph { A }', 'dot'))).toHaveLength(1);
  });
});
