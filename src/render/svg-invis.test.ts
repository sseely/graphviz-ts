// SPDX-License-Identifier: EPL-2.0

/**
 * style=invis must omit the whole node/edge from the SVG, matching dot 15.0.0
 * (C emit_node / emit_edge `return` on an "invis" style token, before the group
 * is begun). Regression for the bug where graphviz-ts drew invisible edges and
 * nodes with a visible black stroke.
 *
 * @see lib/common/emit.c:emit_edge (style "invis" return)
 * @see lib/common/emit.c:emit_node (style "invis" return)
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

const edgeGroups = (svg: string): number => (svg.match(/class="edge"/g) ?? []).length;
const ellipses = (svg: string): number => (svg.match(/<ellipse/g) ?? []).length;

describe('style=invis omits the object (vs dot 15.0.0)', () => {
  it('an invisible edge emits no edge group or path', () => {
    const svg = renderSvg('digraph{A->B [style=invis]; A->C}', 'dot');
    expect(edgeGroups(svg)).toBe(1);              // only A->C
    expect(svg).not.toContain('<title>A&#45;&gt;B</title>');
    expect(svg).toContain('<title>A&#45;&gt;C</title>');
  });

  it('an invisible node emits no shape', () => {
    const svg = renderSvg('digraph{A [style=invis]; A->B}', 'dot');
    expect(ellipses(svg)).toBe(1);                // only B (A is invisible)
    expect(edgeGroups(svg)).toBe(1);              // the visible A->B edge still draws
  });

  it('visible siblings are unaffected', () => {
    const svg = renderSvg('digraph{A->B; B->C [style=invis]; C->D}', 'dot');
    expect(edgeGroups(svg)).toBe(2);              // A->B and C->D
    expect(svg).not.toContain('<title>B&#45;&gt;C</title>');
  });
});
