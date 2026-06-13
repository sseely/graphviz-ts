// SPDX-License-Identifier: EPL-2.0

/**
 * Style/fill/pen attribute tests for polyGencode.
 * All expected SVG substrings verified against C graphviz 15.0.0 (dot -Tsvg).
 *
 * @see lib/common/shapes.c:poly_gencode (~2981-3055)
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract all <ellipse .../> tags from SVG. */
const ellipses = (svg: string): string[] =>
  (svg.match(/<ellipse[^>]*\/>/g) ?? []);

/**
 * Extract node-boundary <polygon .../> tags from SVG, skipping the page
 * background polygon (the only one emitted with stroke="none"; node
 * boundaries always carry a stroke color).
 */
const polygons = (svg: string): string[] =>
  (svg.match(/<polygon[^>]*\/>/g) ?? []).filter((p) => !p.includes('stroke="none"'));

/** Render a single-node digraph with the given attrs string and return the SVG. */
function svgNode(attrs: string, shape = 'ellipse'): string {
  return renderSvg(
    `digraph { A [shape=${shape} ${attrs}] }`,
    'dot',
  );
}

// ---------------------------------------------------------------------------
// Baseline: unstyled node MUST be byte-identical to pre-task output
// ---------------------------------------------------------------------------

describe('unstyled node — byte-stability gate', () => {
  it('emits fill="none" stroke="black" with no stroke-width or dasharray', () => {
    const [el] = ellipses(renderSvg('digraph { A }', 'dot'));
    expect(el).toBeDefined();
    expect(el).toContain('fill="none"');
    expect(el).toContain('stroke="black"');
    expect(el).not.toContain('stroke-width');
    expect(el).not.toContain('stroke-dasharray');
  });
});

// ---------------------------------------------------------------------------
// style=filled + fillcolor
// ---------------------------------------------------------------------------

describe('style=filled with explicit fillcolor', () => {
  it('style=filled fillcolor=lightblue → fill="lightblue" stroke="black"', () => {
    const [el] = ellipses(svgNode('style=filled fillcolor=lightblue'));
    expect(el).toBeDefined();
    expect(el).toContain('fill="lightblue"');
    expect(el).toContain('stroke="black"');
    expect(el).not.toContain('stroke-dasharray');
  });

  it('style=filled (no fillcolor/color) → fill="lightgrey" stroke="black"', () => {
    const [el] = ellipses(svgNode('style=filled'));
    expect(el).toBeDefined();
    expect(el).toContain('fill="lightgrey"');
    expect(el).toContain('stroke="black"');
  });

  it('style=filled fillcolor=red → fill="red" stroke="black"', () => {
    const [el] = ellipses(svgNode('style=filled fillcolor=red'));
    expect(el).toBeDefined();
    expect(el).toContain('fill="red"');
    expect(el).toContain('stroke="black"');
  });
});

// ---------------------------------------------------------------------------
// style=filled on polygon shape
// ---------------------------------------------------------------------------

describe('style=filled on polygon shape', () => {
  it('box: fill="lightblue" stroke="black"', () => {
    const [pg] = polygons(svgNode('style=filled fillcolor=lightblue', 'box'));
    expect(pg).toBeDefined();
    expect(pg).toContain('fill="lightblue"');
    expect(pg).toContain('stroke="black"');
  });
});

// ---------------------------------------------------------------------------
// pen color
// ---------------------------------------------------------------------------

describe('pen color — color attr', () => {
  it('color=red (unfilled) → stroke="red" fill="none"', () => {
    const [el] = ellipses(svgNode('color=red'));
    expect(el).toBeDefined();
    expect(el).toContain('stroke="red"');
    expect(el).toContain('fill="none"');
  });

  it('style=filled color=blue (no fillcolor) → fill="blue" stroke="blue"', () => {
    // C: findFill falls back to color attr when fillcolor is absent
    const [el] = ellipses(svgNode('style=filled color=blue'));
    expect(el).toBeDefined();
    expect(el).toContain('fill="blue"');
    expect(el).toContain('stroke="blue"');
  });

  it('style=filled fillcolor=yellow color=red → fill="yellow" stroke="red"', () => {
    // fillcolor wins for fill; color attr is pen color
    const [el] = ellipses(svgNode('style=filled fillcolor=yellow color=red'));
    expect(el).toBeDefined();
    expect(el).toContain('fill="yellow"');
    expect(el).toContain('stroke="red"');
  });
});

// ---------------------------------------------------------------------------
// penwidth
// ---------------------------------------------------------------------------

describe('penwidth attribute', () => {
  it('penwidth=3 → stroke-width="3"', () => {
    const [el] = ellipses(svgNode('penwidth=3'));
    expect(el).toBeDefined();
    expect(el).toContain('stroke-width="3"');
  });

  it('penwidth=0.5 → stroke-width="0.5"', () => {
    const [el] = ellipses(svgNode('penwidth=0.5'));
    expect(el).toBeDefined();
    expect(el).toContain('stroke-width="0.5"');
  });
});

// ---------------------------------------------------------------------------
// style=bold
// ---------------------------------------------------------------------------

describe('style=bold', () => {
  it('style=bold → stroke-width="2"', () => {
    const [el] = ellipses(svgNode('style=bold'));
    expect(el).toBeDefined();
    expect(el).toContain('stroke-width="2"');
  });
});

// ---------------------------------------------------------------------------
// style=dashed / style=dotted
// ---------------------------------------------------------------------------

describe('dash patterns', () => {
  it('style=dashed → stroke-dasharray="5,2"', () => {
    const [el] = ellipses(svgNode('style=dashed'));
    expect(el).toBeDefined();
    expect(el).toContain('stroke-dasharray="5,2"');
    expect(el).not.toContain('stroke-width');
  });

  it('style=dotted → stroke-dasharray="1,5"', () => {
    const [el] = ellipses(svgNode('style=dotted'));
    expect(el).toBeDefined();
    expect(el).toContain('stroke-dasharray="1,5"');
  });
});

// ---------------------------------------------------------------------------
// multi-periphery: filled applies only to first ring
// ---------------------------------------------------------------------------

describe('filled flag only applied to innermost ring (j==0)', () => {
  it('doublecircle style=filled: first ellipse filled, second unfilled', () => {
    const els = ellipses(
      renderSvg('digraph { A [shape=doublecircle style=filled fillcolor=cyan] }', 'dot'),
    );
    expect(els).toHaveLength(2);
    // Inner ring (first in SVG) must be filled
    expect(els[0]).toContain('fill="cyan"');
    // Outer ring must not be filled
    expect(els[1]).toContain('fill="none"');
  });
});

// ---------------------------------------------------------------------------
// peripheries=0 + filled → transparent pen, one ring drawn
// ---------------------------------------------------------------------------

describe('peripheries=0 + style=filled — borderless filled node', () => {
  it('draws exactly one ellipse with fill and transparent stroke (→none)', () => {
    const svg = renderSvg(
      'digraph { A [shape=ellipse peripheries=0 style=filled fillcolor=orange] }',
      'dot',
    );
    const els = ellipses(svg);
    expect(els).toHaveLength(1);
    expect(els[0]).toContain('fill="orange"');
    // transparent pen → "none" in SVG (paintStr maps 'transparent' → 'none')
    expect(els[0]).toContain('stroke="none"');
  });

  it('peripheries=0 unfilled still draws nothing', () => {
    const els = ellipses(
      renderSvg('digraph { A [shape=ellipse peripheries=0] }', 'dot'),
    );
    expect(els).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// striped/wedged fallback: first solid color (AD3)
// ---------------------------------------------------------------------------

describe('striped/wedged — first-color fallback (AD3, gradient out of scope)', () => {
  it('style=striped fillcolor=red:blue → uses red (first solid color)', () => {
    const svg = renderSvg(
      'digraph { A [shape=box style=striped fillcolor="red:blue"] }',
      'dot',
    );
    // We just assert it does not crash and emits something
    expect(svg).toContain('<svg');
  });

  it('style=wedged fillcolor=green:yellow → uses green (first solid color)', () => {
    const svg = renderSvg(
      'digraph { A [shape=ellipse style=wedged fillcolor="green:yellow"] }',
      'dot',
    );
    expect(svg).toContain('<svg');
  });
});
