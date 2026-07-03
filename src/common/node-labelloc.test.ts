// SPDX-License-Identifier: EPL-2.0

/**
 * Node label vertical placement honors `labelloc` (top/center/bottom).
 *
 * C's poly_init computes ND_label(n)->space from the final node box and
 * emit_label positions the first span per valign (labels.c:240-251). The port
 * previously never computed `space` (frozen == dimen) and renderLabel ignored
 * valign, so every node label centered — a labelloc=b label on a tall node sat
 * in the middle instead of at the bottom.
 *
 * @see lib/common/shapes.c:poly_init (2132-2152)
 * @see lib/common/labels.c:emit_label (240-251)
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

/** The first label `<text>` y in a tall fixed-size box node with the given labelloc. */
function labelY(loc: string): number {
  const svg = renderSvg(
    `digraph{ a[shape=box, height=2, fixedsize=true, label="X", labelloc=${loc}]; }`,
    'dot',
  );
  const m = /<text[^>]*\by="([-\d.]+)"/.exec(svg);
  if (!m) throw new Error('no label text');
  return Number(m[1]);
}

describe('node label labelloc placement', () => {
  it('a tall node places the label top < center < bottom (SVG y increases downward)', () => {
    const top = labelY('t');
    const center = labelY('c');
    const bottom = labelY('b');
    expect(top).toBeLessThan(center);
    expect(center).toBeLessThan(bottom);
  });

  it('default (no labelloc) matches labelloc=c', () => {
    const svg = renderSvg('digraph{ a[shape=box, height=2, fixedsize=true, label="X"]; }', 'dot');
    const y = Number(/<text[^>]*\by="([-\d.]+)"/.exec(svg)![1]);
    expect(y).toBeCloseTo(labelY('c'), 5);
  });
});
