// SPDX-License-Identifier: EPL-2.0

/**
 * Regression: a long back edge routed around the side must expand the graph
 * bounding box, so the SVG viewport does not clip it.
 *
 * The chain/long-edge router installs splines via `installEdgeSpline`, which
 * (unlike the general `clipAndInstall`) did NOT call `update_bb_bz(&GD_bb(g))`.
 * So an edge bowing outside the node hull — here `n9--n0`, the edge closing the
 * cycle, which routes around the right — was drawn past the computed bb and
 * clipped on the right.
 *
 * Oracle: dot 15.1.0 -Tsvg renders this graph at width 228pt (bb.ur.x 220.49);
 * the port was producing 200pt before the fix.
 *
 * @see lib/common/splines.c:312 (update_bb_bz in clip_and_install)
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const CLIP_GRAPH =
  'graph G { n0--n1; n9--n0; n1--n2; n2--n3; n3--n4; n4--n5; n5--n6; ' +
  'n6--n7; n7--n8; n8--n9; n0--n5; n2--n7; n0--L1; n5--L2; }';

/** Largest x emitted in any path `d`, polygon `points`, or ellipse `cx`. */
function maxDrawnX(svg: string): number {
  let max = -Infinity;
  for (const m of svg.matchAll(/(?:\sd=|points=)"([^"]+)"/g)) {
    for (const pair of m[1].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) {
      max = Math.max(max, Number(pair[1]));
    }
  }
  for (const m of svg.matchAll(/<ellipse[^>]*\scx="(-?[\d.]+)"/g)) {
    max = Math.max(max, Number(m[1]));
  }
  return max;
}

function svgWidth(svg: string): number {
  const m = /<svg width="(\d+)pt"/.exec(svg);
  if (m === null) throw new Error('no <svg width>');
  return Number(m[1]);
}

describe('back-edge spline bbox (no right-clip)', () => {
  const svg = renderSvg(CLIP_GRAPH, 'dot');

  it('renders at native width (back-edge spline included in bb)', () => {
    // Native dot 15.1.0: 228pt. Before the fix the port produced 200pt.
    expect(svgWidth(svg)).toBe(228);
  });

  it('does not clip: no drawn coordinate exceeds the viewport width', () => {
    // The whole drawing (group translate(4 …)) sits at x >= -4; the rightmost
    // drawn x must fit inside the padded canvas (width - pad).
    expect(maxDrawnX(svg)).toBeLessThanOrEqual(svgWidth(svg));
  });
});
