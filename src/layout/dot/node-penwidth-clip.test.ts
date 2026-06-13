// SPDX-License-Identifier: EPL-2.0

/**
 * Node-penwidth edge-clip regression. C's poly_inside clips the edge spline
 * (and places the arrow) at the node's OUTLINE periphery — the boundary grown
 * by penwidth/2 — so a thick-bordered endpoint clips slightly further out. The
 * port previously always used the default pen width (1.0), so an edge into a
 * penwidth>=2 node ended ~0.5pt short of C (the divergence originally
 * mis-attributed to box-shaped nodes; it is shape-independent).
 *
 * Output verified against C graphviz 15.0.0 (dot -Tsvg).
 *
 * @see src/layout/dot/edge-route-helpers.ts:nodeBoxOf (penwidth)
 * @see src/layout/dot/edge-route-routing.ts:nodeInsideFn
 * @see lib/common/shapes.c:poly_inside (outline / penwidth)
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

/** First edge path's `d`, with M/C stripped to coordinate tokens (regex-free). */
function splineEnd(svg: string): string {
  const path = (svg.match(/<path fill=.none.[^>]*\/>/g) ?? [])[0] ?? '';
  const i = path.indexOf('d="');
  const d = i < 0 ? '' : path.slice(i + 3, path.indexOf(String.fromCharCode(34), i + 3));
  const toks = d.split('M').join(' ').split('C').join(' ').split(' ').filter(Boolean);
  return toks[toks.length - 1] ?? '';
}

describe('edge clip honors the endpoint node pen width', () => {
  it('box endpoint penwidth=2: spline reaches the outline (matches C -47.9)', () => {
    const svg = renderSvg('digraph { a -> b; b [shape=box, penwidth=2] }', 'dot');
    expect(splineEnd(svg)).toBe('27,-47.9');
  });

  it('ellipse endpoint penwidth=2 clips the same as box (shape-independent)', () => {
    const svg = renderSvg('digraph { a -> b; b [penwidth=2] }', 'dot');
    expect(splineEnd(svg)).toBe('27,-47.9');
  });

  it('default penwidth (1) is unchanged', () => {
    const svg = renderSvg('digraph { a -> b; b [shape=box] }', 'dot');
    expect(splineEnd(svg)).toBe('27,-47.54');
  });
});
