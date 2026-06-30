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

/** Count <text> elements in an SVG. */
function texts(svg: string): number {
  return svg.split('<text').length - 1;
}

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
// Baseline: unstyled node MUST be conformant to pre-task output
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
// shape=point — filled-black default, explicit color wins, no label
// Oracle-verified against C graphviz 15.1.0 (dot -Tsvg)
// @see lib/common/shapes.c:point_gencode
// ---------------------------------------------------------------------------

describe('shape=point — fill (point_gencode)', () => {
  it('bare point → one ellipse fill="black" stroke="black", no text (AC2)', () => {
    const svg = svgNode('', 'point');
    const els = ellipses(svg);
    expect(els).toHaveLength(1);
    expect(els[0]).toContain('fill="black"');
    expect(els[0]).toContain('stroke="black"');
    expect(els[0]).toContain('rx="1.8"');
    expect(texts(svg)).toBe(0);
  });

  it('point color=red → fill="red" stroke="red" (explicit color wins, AC3)', () => {
    const [el] = ellipses(svgNode('color=red', 'point'));
    expect(el).toContain('fill="red"');
    expect(el).toContain('stroke="red"');
  });

  it('point fillcolor=blue color=red → fill="blue" stroke="red"', () => {
    const [el] = ellipses(svgNode('fillcolor=blue color=red', 'point'));
    expect(el).toContain('fill="blue"');
    expect(el).toContain('stroke="red"');
  });
});

describe('shape=point — label suppression (point_gencode)', () => {
  it('point with a label still emits no text', () => {
    expect(texts(svgNode('label="hi"', 'point'))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// S1: style=striped multicolor — wire into poly_gencode
// Oracle-verified against C graphviz 15.0.0 (dot -Tsvg)
// ---------------------------------------------------------------------------

describe('S1: style=striped multicolor — poly_gencode dispatch', () => {
  it('3-color striped box emits 3 filled bands + 1 unfilled boundary', () => {
    const svg = svgNode('style=striped fillcolor="red:green:blue"', 'box');
    // 3 filled bands (no fill="none")
    const bands = polygons(svg).filter((p) => !p.includes('fill="none"'));
    expect(bands).toHaveLength(3);
    // 1 boundary unfilled
    const bnd = polygons(svg).filter((p) => p.includes('fill="none"'));
    expect(bnd).toHaveLength(1);
  });

  it('striped bands have thin-line stroke-width="0.5"', () => {
    const svg = svgNode('style=striped fillcolor="red:green:blue"', 'box');
    const bands = polygons(svg).filter((p) => !p.includes('fill="none"'));
    for (const b of bands) {
      expect(b).toContain('stroke-width="0.5"');
    }
  });

  it('boundary polygon has no stroke-width (default 1.0 suppressed)', () => {
    const svg = svgNode('style=striped fillcolor="red:green:blue"', 'box');
    const bnd = polygons(svg).find((p) => p.includes('fill="none"'));
    expect(bnd).toBeDefined();
    expect(bnd).not.toContain('stroke-width');
  });
});

describe('S1: style=striped multicolor — band coordinates', () => {
  it('oracle conformant: red band points="0,0 18,0 18,-36 0,-36 0,0"', () => {
    const svg = svgNode('style=striped fillcolor="red:green:blue"', 'box');
    const bands = polygons(svg).filter((p) => !p.includes('fill="none"'));
    expect(bands[0]).toContain('fill="red"');
    expect(bands[0]).toContain('points="0,0 18,0 18,-36 0,-36 0,0"');
  });

  it('oracle conformant: blue band points="36,0 54,0 54,-36 36,-36 36,0"', () => {
    const svg = svgNode('style=striped fillcolor="red:green:blue"', 'box');
    const bands = polygons(svg).filter((p) => !p.includes('fill="none"'));
    expect(bands[2]).toContain('fill="blue"');
    expect(bands[2]).toContain('points="36,0 54,0 54,-36 36,-36 36,0"');
  });
});

// ---------------------------------------------------------------------------
// S1: style=wedged multicolor — wire into poly_gencode
// ---------------------------------------------------------------------------

describe('S1: style=wedged multicolor — poly_gencode dispatch', () => {
  it('3-color wedged ellipse emits 3 <path> wedges + 1 boundary <ellipse>', () => {
    const svg = svgNode('style=wedged fillcolor="red:green:blue"');
    const paths = (svg.match(/<path[^>]*\/>/g) ?? []);
    expect(paths).toHaveLength(3);
    expect(paths[0]).toContain('fill="red"');
    expect(paths[1]).toContain('fill="green"');
    expect(paths[2]).toContain('fill="blue"');
    // Boundary ellipse unfilled
    const [el] = (svg.match(/<ellipse[^>]*\/>/g) ?? []);
    expect(el).toContain('fill="none"');
  });

  it('wedge paths have thin-line stroke-width="0.5"', () => {
    const svg = svgNode('style=wedged fillcolor="red:green:blue"');
    for (const p of (svg.match(/<path[^>]*\/>/g) ?? [])) {
      expect(p).toContain('stroke-width="0.5"');
    }
  });

  it('boundary ellipse has no stroke-width (default 1.0 suppressed)', () => {
    const svg = svgNode('style=wedged fillcolor="red:green:blue"');
    const [el] = (svg.match(/<ellipse[^>]*\/>/g) ?? []);
    expect(el).not.toContain('stroke-width');
  });

  it('all wedge paths start at center M27,-18', () => {
    const svg = svgNode('style=wedged fillcolor="red:green:blue"');
    for (const p of (svg.match(/<path[^>]*\/>/g) ?? [])) {
      expect(p).toContain('d="M27,-18');
    }
  });
});

// ---------------------------------------------------------------------------
// S1: single-color striped/wedged unchanged (no multicolor gate)
// ---------------------------------------------------------------------------

describe('S1: single-color striped/wedged', () => {
  it('style=striped fillcolor=red → emits SVG with at least one polygon', () => {
    const svg = svgNode('style=striped fillcolor=red', 'box');
    expect(svg).toContain('<svg');
    expect(polygons(svg).length).toBeGreaterThan(0);
  });

  it('style=wedged fillcolor=red → emits SVG with ellipse, no paths', () => {
    const svg = svgNode('style=wedged fillcolor=red');
    expect(svg).toContain('<svg');
    expect((svg.match(/<path[^>]*\/>/g) ?? [])).toHaveLength(0);
    expect(ellipses(svg)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// G3: node gradient fills — oracle-verified against dot -Tsvg (graphviz 15.0.0)
// ---------------------------------------------------------------------------

describe('G3: node linear gradient — fillcolor="red:blue" style=filled', () => {
  it('emits <linearGradient> with id="node1_l_0" (obj.id prefix)', () => {
    const svg = renderSvg('digraph { a [style=filled, fillcolor="red:blue"] }', 'dot');
    expect(svg).toContain('<linearGradient id="node1_l_0"');
  });

  it('emits gradientUnits="userSpaceOnUse"', () => {
    const svg = renderSvg('digraph { a [style=filled, fillcolor="red:blue"] }', 'dot');
    expect(svg).toContain('gradientUnits="userSpaceOnUse"');
  });

  it('ellipse fill references url(#node1_l_0)', () => {
    const svg = renderSvg('digraph { a [style=filled, fillcolor="red:blue"] }', 'dot');
    expect(svg).toContain('fill="url(#node1_l_0)"');
  });
});

describe('G3: node radial gradient — style="radial,filled" fillcolor="red:blue"', () => {
  it('emits <radialGradient> with id="node1_r_0"', () => {
    const svg = renderSvg('digraph { a [style="radial,filled", fillcolor="red:blue"] }', 'dot');
    expect(svg).toContain('<radialGradient id="node1_r_0"');
  });

  it('ellipse fill references url(#node1_r_0)', () => {
    const svg = renderSvg('digraph { a [style="radial,filled", fillcolor="red:blue"] }', 'dot');
    expect(svg).toContain('fill="url(#node1_r_0)"');
  });
});

describe('G3: node solid fill unchanged', () => {
  it('style=filled fillcolor=red → plain fill="red", no gradient defs', () => {
    const svg = renderSvg('digraph { a [style=filled, fillcolor="red"] }', 'dot');
    expect(svg).not.toContain('<linearGradient');
    expect(svg).not.toContain('<radialGradient');
    expect(svg).toContain('fill="red"');
  });
});
