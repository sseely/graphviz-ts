// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for stripedBox, wedgedEllipse, and ellipticWedge.
 *
 * Oracle values verified against C graphviz 15.0.0 (dot -Tsvg).
 *
 * @see src/render/svg-multicolor.ts
 * @see lib/common/emit.c:595  stripedBox
 * @see lib/common/emit.c:549  wedgedEllipse
 * @see lib/common/ellipse.c:274 ellipticWedge
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';
import { THIN_LINE } from './svg-multicolor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function svgNode(attrs: string, shape = 'ellipse'): string {
  return renderSvg(`digraph { a [shape=${shape} ${attrs}] }`, 'dot');
}

/** Extract filled-band <polygon> elements (not the background or boundary). */
function bandPolygons(svg: string): string[] {
  return (svg.match(/<polygon[^>]*\/>/g) ?? []).filter(
    (p) => !p.includes('stroke="none"') && !p.includes('fill="none"'),
  );
}

/** Extract boundary <polygon> elements (fill="none"). */
function boundaryPolygons(svg: string): string[] {
  return (svg.match(/<polygon[^>]*\/>/g) ?? []).filter(
    (p) => p.includes('fill="none"'),
  );
}

/** Extract <path> elements (wedge arcs). */
function wedgePaths(svg: string): string[] {
  return (svg.match(/<path[^>]*\/>/g) ?? []);
}

/** Extract <ellipse> elements (excluding background polygon). */
function ellipses(svg: string): string[] {
  return (svg.match(/<ellipse[^>]*\/>/g) ?? []);
}

// ---------------------------------------------------------------------------
// THIN_LINE constant
// ---------------------------------------------------------------------------

describe('THIN_LINE constant', () => {
  it('equals 0.5 matching C #define THIN_LINE 0.5', () => {
    expect(THIN_LINE).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// stripedBox — 3-color equal bands (oracle: dot -Tsvg)
// ---------------------------------------------------------------------------

describe('stripedBox — 3-color equal bands', () => {
  const svg = svgNode('style=striped fillcolor="red:green:blue"', 'box');

  it('emits exactly 3 filled band polygons', () => {
    expect(bandPolygons(svg)).toHaveLength(3);
  });

  it('red band: fill="red" stroke="black" stroke-width="0.5" x=[0,18]', () => {
    const [red] = bandPolygons(svg);
    expect(red).toContain('fill="red"');
    expect(red).toContain('stroke="black"');
    expect(red).toContain('stroke-width="0.5"');
    expect(red).toContain('points="0,0 18,0 18,-36 0,-36 0,0"');
  });

  it('green band: fill="green" stroke="black" stroke-width="0.5" x=[18,36]', () => {
    const bands = bandPolygons(svg);
    expect(bands[1]).toContain('fill="green"');
    expect(bands[1]).toContain('stroke-width="0.5"');
    expect(bands[1]).toContain('points="18,0 36,0 36,-36 18,-36 18,0"');
  });

  it('blue band: fill="blue" stroke="black" stroke-width="0.5" x=[36,54]', () => {
    const bands = bandPolygons(svg);
    expect(bands[2]).toContain('fill="blue"');
    expect(bands[2]).toContain('stroke-width="0.5"');
    expect(bands[2]).toContain('points="36,0 54,0 54,-36 36,-36 36,0"');
  });

  it('boundary polygon: fill="none" stroke="black" no stroke-width', () => {
    const [bnd] = boundaryPolygons(svg);
    expect(bnd).toContain('fill="none"');
    expect(bnd).toContain('stroke="black"');
    expect(bnd).not.toContain('stroke-width');
    expect(bnd).toContain('points="54,-36 0,-36 0,0 54,0 54,-36"');
  });

  it('total: 3 bands + 1 boundary = 4 node polygons', () => {
    const all = (svg.match(/<polygon[^>]*\/>/g) ?? []).filter(
      (p) => !p.includes('stroke="none"'),
    );
    expect(all).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// stripedBox — weighted fractions (oracle: dot -Tsvg)
// ---------------------------------------------------------------------------

describe('stripedBox — weighted fractions red;0.25:green;0.25:blue', () => {
  const svg = svgNode(
    'style=striped fillcolor="red;0.25:green;0.25:blue"',
    'box',
  );

  it('red band width = 0.25 of total = 13.5 points', () => {
    const [red] = bandPolygons(svg);
    expect(red).toContain('points="0,0 13.5,0 13.5,-36 0,-36 0,0"');
  });

  it('green band x=[13.5,27]', () => {
    const bands = bandPolygons(svg);
    expect(bands[1]).toContain('points="13.5,0 27,0 27,-36 13.5,-36 13.5,0"');
  });

  it('blue band (remaining 0.5) x=[27,54]', () => {
    const bands = bandPolygons(svg);
    expect(bands[2]).toContain('points="27,0 54,0 54,-36 27,-36 27,0"');
  });
});

// ---------------------------------------------------------------------------
// stripedBox — single-color (non-multicolor path)
// ---------------------------------------------------------------------------

describe('stripedBox — single-color fillcolor', () => {
  it('single color still emits SVG without crash', () => {
    const svg = svgNode('style=striped fillcolor="red"', 'box');
    expect(svg).toContain('<svg');
    // One band (full-width) + boundary polygon
    const bands = bandPolygons(svg);
    expect(bands).toHaveLength(1);
    expect(bands[0]).toContain('fill="red"');
  });
});

// ---------------------------------------------------------------------------
// wedgedEllipse — 3-color wedges
// ---------------------------------------------------------------------------

describe('wedgedEllipse — 3-color', () => {
  const svg = svgNode('style=wedged fillcolor="red:green:blue"');

  it('emits exactly 3 <path> wedge elements', () => {
    expect(wedgePaths(svg)).toHaveLength(3);
  });

  it('each wedge has fill, stroke="black", stroke-width="0.5"', () => {
    for (const p of wedgePaths(svg)) {
      expect(p).toContain('stroke="black"');
      expect(p).toContain('stroke-width="0.5"');
    }
  });

  it('wedge fills are red, green, blue in order', () => {
    const paths = wedgePaths(svg);
    expect(paths[0]).toContain('fill="red"');
    expect(paths[1]).toContain('fill="green"');
    expect(paths[2]).toContain('fill="blue"');
  });

  it('all wedge paths start at center M27,-18', () => {
    for (const p of wedgePaths(svg)) {
      expect(p).toContain('d="M27,-18');
    }
  });

  it('boundary ellipse: fill="none" stroke="black" cx=27 cy=-18 rx=27 ry=18', () => {
    const [el] = ellipses(svg);
    expect(el).toContain('fill="none"');
    expect(el).toContain('stroke="black"');
    expect(el).toContain('cx="27"');
    expect(el).toContain('cy="-18"');
    expect(el).toContain('rx="27"');
    expect(el).toContain('ry="18"');
    expect(el).not.toContain('stroke-width');
  });
});

// ---------------------------------------------------------------------------
// wedgedEllipse — weighted fractions
// ---------------------------------------------------------------------------

describe('wedgedEllipse — weighted fractions red;0.25:green;0.25:blue', () => {
  const svg = svgNode('style=wedged fillcolor="red;0.25:green;0.25:blue"');

  it('emits exactly 3 <path> wedge elements', () => {
    expect(wedgePaths(svg)).toHaveLength(3);
  });

  it('wedge fills are red, green, blue in order', () => {
    const paths = wedgePaths(svg);
    expect(paths[0]).toContain('fill="red"');
    expect(paths[1]).toContain('fill="green"');
    expect(paths[2]).toContain('fill="blue"');
  });

  it('all wedges have thin-line stroke', () => {
    for (const p of wedgePaths(svg)) {
      expect(p).toContain('stroke-width="0.5"');
    }
  });
});

// ---------------------------------------------------------------------------
// wedgedEllipse — single-color (non-multicolor path — unchanged behavior)
// ---------------------------------------------------------------------------

describe('wedgedEllipse — single-color (unchanged, no wedge emitted)', () => {
  it('single-color wedged emits ellipse element, no <path>', () => {
    const svg = svgNode('style=wedged fillcolor="red"');
    expect(svg).toContain('<svg');
    expect(wedgePaths(svg)).toHaveLength(0);
    expect(ellipses(svg)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Byte-stability: solid/default nodes unchanged
// ---------------------------------------------------------------------------

describe('byte-stability — unstyled and solid-filled nodes unchanged', () => {
  it('unstyled ellipse: fill="none" stroke="black" no stroke-width', () => {
    const svg = renderSvg('digraph { a }', 'dot');
    const [el] = (svg.match(/<ellipse[^>]*\/>/g) ?? []);
    expect(el).toContain('fill="none"');
    expect(el).toContain('stroke="black"');
    expect(el).not.toContain('stroke-width');
  });

  it('style=filled fillcolor=lightblue: fill="lightblue" no stroke-width', () => {
    const svg = svgNode('style=filled fillcolor=lightblue');
    const [el] = (svg.match(/<ellipse[^>]*\/>/g) ?? []);
    expect(el).toContain('fill="lightblue"');
    expect(el).not.toContain('stroke-width');
  });
});
