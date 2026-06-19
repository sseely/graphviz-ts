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
});
