// SPDX-License-Identifier: EPL-2.0
//
// End-to-end SVG emit for style="tapered" edges (emit.c:2422 tapered branch).
// Oracle-pinned against native dot 15.1.0 for `digraph{a->b[style=tapered]}`.

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';
import { edgeIsTapered } from './svg-tapered-edge.js';
import type { Edge } from '../model/edge.js';

const attrs = (m: Record<string, string>): Edge =>
  ({ attrs: { get: (k: string) => m[k] } }) as unknown as Edge;

describe('edgeIsTapered — style token scan', () => {
  it('matches a bare tapered token and within a list', () => {
    expect(edgeIsTapered(attrs({ style: 'tapered' }))).toBe(true);
    expect(edgeIsTapered(attrs({ style: 'solid, tapered' }))).toBe(true);
  });
  it('does not match absent or unrelated styles', () => {
    expect(edgeIsTapered(attrs({}))).toBe(false);
    expect(edgeIsTapered(attrs({ style: 'dashed' }))).toBe(false);
  });
});

describe('tapered edge — filled polygon instead of a stroked path', () => {
  const tapered = renderSvg('digraph { a -> b [style=tapered] }', 'dot');
  const plain = renderSvg('digraph { a -> b }', 'dot');

  it('emits a filled taper polygon with stroke="none"', () => {
    // Oracle: <polygon fill="black" stroke="none" points="27.5,-71.7 ...">
    expect(tapered).toContain('<polygon fill="black" stroke="none" points="27.5,-71.7');
  });

  it('does not emit a stroked bezier <path> for the tapered edge spline', () => {
    // The plain edge draws its spline as a fill="none" stroke="black" path;
    // the tapered edge replaces that path with the polygon.
    expect(plain).toContain('<path fill="none" stroke="black"');
    expect(tapered).not.toContain('<path fill="none" stroke="black"');
  });

  it('still emits the arrowhead after the taper polygon', () => {
    // Oracle arrowhead: <polygon fill="black" stroke="black" points="30.5,-47.62 ...">
    expect(tapered).toContain('<polygon fill="black" stroke="black" points="30.5,-47.62');
  });
});

describe('tapered edge — honors the edge color as the fill', () => {
  it('fills the taper polygon in the edge color, stroke none', () => {
    const svg = renderSvg('digraph { a -> b [style=tapered, color="#9b59b6"] }', 'dot');
    expect(svg).toContain('<polygon fill="#9b59b6" stroke="none"');
  });
});
