// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

/** Render a single-node graph of the given shape and return its SVG. */
function shapeSvg(shape: string): string {
  return renderSvg(
    `graph G { a [shape=${shape}, label="", width=0.75, height=0.5]; }`,
    'dot',
  );
}

describe('special node shapes (round_corners port)', () => {
  // The base node box is the 5-point periphery; a special shape adds its own
  // custom polygon/path, so a correctly-ported shape has MORE than one polygon
  // (or a <path> for cylinder) and is not just the plain box.
  it('cds renders the 5-point arrow polygon, not a plain box', () => {
    const svg = shapeSvg('cds');
    expect(svg).toContain('points="42,-30 0,-30 0,-6 42,-6 54,-18 42,-30"');
  });

  it('folder adds a tab outline (more than the single box polygon)', () => {
    const polys = shapeSvg('folder').match(/<polygon/g) ?? [];
    expect(polys.length).toBeGreaterThan(1);
  });

  it('promoter emits a polygon + the dsDNA polyline', () => {
    const svg = shapeSvg('promoter');
    expect(svg).toContain('<polyline');
    expect((svg.match(/<polygon/g) ?? []).length).toBeGreaterThan(1);
  });

  it('cylinder renders bezier <path> elements, not a polygon body', () => {
    const paths = shapeSvg('cylinder').match(/<path /g) ?? [];
    expect(paths.length).toBe(2); // outline + top arc
  });

  it('a plain box adds no special polygon (just graph bg + the box)', () => {
    // graph background polygon + the node box periphery = 2; no custom draw.
    const polys = shapeSvg('box').match(/<polygon/g) ?? [];
    expect(polys.length).toBe(2);
  });

  it('Mdiamond/Msquare add corner-diagonal polylines', () => {
    expect(shapeSvg('Mdiamond')).toContain('<polyline');
    expect(shapeSvg('Msquare')).toContain('<polyline');
  });

  it('Mcircle draws the two ellipse chords', () => {
    const lines = shapeSvg('Mcircle').match(/<polyline/g) ?? [];
    expect(lines.length).toBe(2);
  });

  it('shape=underline strokes only the bottom edge', () => {
    const svg = shapeSvg('underline');
    expect(svg).toContain('<polyline');
  });

  it('style=rounded renders a bezier <path>, not a polygon box', () => {
    const svg = renderSvg('graph G { a [shape=box, style=rounded, label="hi"]; }', 'dot');
    expect(svg).toContain('<path');
  });

  // STAR is a port-internal option.shape marker for the star vertex generator,
  // NOT a round_corners special shape (C's p_star has option.shape=0). A plain
  // star draws its 10-vertex custom polygon; a rounded/diagonals star must fall
  // through to rounded_draw/diagonals_draw over those vertices, never the
  // special-shape switch (which has no case STAR and used to throw).
  it('a plain star draws its custom 10-vertex polygon, not a plain box', () => {
    const svg = shapeSvg('star');
    // graph bg polygon + the star polygon; the star has 10 vertices (11 pts).
    const star = svg.match(/<polygon fill="none"[^>]*points="([^"]*)"/);
    expect(star).not.toBeNull();
    expect(star![1]!.trim().split(/\s+/).length).toBe(11);
  });

  it('style=rounded on a star renders a bezier <path>, not a throw', () => {
    const svg = renderSvg(
      'digraph { a [shape=star, style="filled,rounded", label="x"]; }',
      'dot',
    );
    expect(svg).toContain('<path');
    expect(svg).not.toContain('<polygon fill="none"'); // rounded → path, no star polygon
  });

  it('style=diagonals on a star draws corner polylines over the star vertices', () => {
    const svg = renderSvg('graph G { a [shape=star, style=diagonals, label=""]; }', 'dot');
    expect(svg).toContain('<polyline');
  });

  // A star needs star_size (shapes.c:4039) to inflate the label box to the
  // node size that contains its outer points. Without it the node box stays
  // label-sized and the star's lower points render outside the viewport.
  // Oracle (headless estimate path): shape=star,label="Amazing Result" = 287x273.
  it('star node is sized by star_size so the whole star fits the viewport', () => {
    const svg = renderSvg('digraph { n [shape=star, label="Amazing Result"]; }', 'dot');
    expect(svg).toMatch(/width="287pt"\s+height="273pt"/);
    // every star vertex y (in the translated frame) sits within the canvas:
    // the polygon's lowest point must not exceed the drawing height.
    const pts = svg.match(/<polygon fill="none"[^>]*points="([^"]*)"/)![1]!;
    const ys = pts.trim().split(/\s+/).map((p) => parseFloat(p.split(',')[1]!));
    // bottom points reach y=0 (the baseline), never positive (below canvas).
    expect(Math.max(...ys)).toBeLessThanOrEqual(0.01);
  });

  // cylinder_size (shapes.c:4153) scales height by 1.375; the generic ellipse
  // fit would over-widen. Masked by the min node size for short labels, so use
  // a wide multi-line label. Oracle: 148x65.
  it('cylinder node is sized by cylinder_size, not the ellipse fit', () => {
    const svg = renderSvg(
      'digraph { n [shape=cylinder, label="A Big Database Label\\nSecond Line Here"]; }',
      'dot',
    );
    expect(svg).toMatch(/width="148pt"\s+height="65pt"/);
  });

  // AC5 (rounded-clusters-mrecord): extracting emitRoundedBezier out of
  // roundedDraw must not change box-node output. This control already
  // conformant with the oracle pre-mission; lock its exact <path d>.
  it('rounded box-node <path> is conformant to the oracle after extraction', () => {
    const svg = renderSvg('digraph{a[shape=box,style=rounded]}', 'dot');
    expect(svg).toContain(
      'd="M42,-36C42,-36 12,-36 12,-36 6,-36 0,-30 0,-24 0,-24 0,-12 0,-12 ' +
      '0,-6 6,0 12,0 12,0 42,0 42,0 48,0 54,-6 54,-12 54,-12 54,-24 54,-24 ' +
      '54,-30 48,-36 42,-36"',
    );
  });
});
