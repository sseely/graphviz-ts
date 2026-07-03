// SPDX-License-Identifier: EPL-2.0

/**
 * Self-loop label bounding-box growth.
 *
 * After routing a self-loop group, C loops the group and calls
 * `updateBB(g, ED_label(e))` for every labeled self-loop edge, expanding the
 * graph bbox to include the label (which sits to the side the loop bulges
 * toward). Right-going loops also reserve label space at ranking time
 * (selfRightSpace), so they grow anyway — but LEFT- and TOP-going loops get NO
 * ranking-time reservation, so this post-routing updateBB is their only growth
 * path. Without it, a left/top self-loop label is silently omitted from the
 * canvas and every absolute coordinate on that side shifts.
 *
 * @see lib/dotgen/dotsplines.c:405-409
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const WIDE = 'AAAAAAAAAAAAAAAAAAAAAAAA';
const NARROW = 'A';

/** viewBox width/height of the rendered SVG. */
function extent(dot: string): { w: number; h: number } {
  const svg = renderSvg(dot, 'dot');
  const m = /viewBox="[\d.-]+ [\d.-]+ ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!m) throw new Error('no viewBox');
  return { w: Number(m[1]), h: Number(m[2]) };
}

const loop = (label: string, ports: string): string =>
  `digraph{ a -> a [label="${label}", ${ports}]; }`;

describe('self-loop label bbox growth', () => {
  it('left-going self-loop: a wide label widens the canvas', () => {
    const narrow = extent(loop(NARROW, 'tailport=w, headport=w')).w;
    const wide = extent(loop(WIDE, 'tailport=w, headport=w')).w;
    expect(wide).toBeGreaterThan(narrow);
  });

  it('left-going and right-going loops include the label symmetrically', () => {
    const left = extent(loop(WIDE, 'tailport=w, headport=w')).w;
    const right = extent(loop(WIDE, 'tailport=e, headport=e')).w;
    expect(left).toBeCloseTo(right, 0);
  });

  it('top-going self-loop: a wide (horizontal) label widens the canvas', () => {
    // The label sits above the loop but extends horizontally, so a wider label
    // grows WIDTH (height is fixed by the loop's vertical extent).
    const narrow = extent(loop(NARROW, 'tailport=n, headport=n')).w;
    const wide = extent(loop(WIDE, 'tailport=n, headport=n')).w;
    expect(wide).toBeGreaterThan(narrow);
  });

  // A second labeled self-loop on the same node must reserve space beyond the
  // first: C widens dx by (label.width - stepx) after each labeled loop so the
  // next loop clears it (splines.c:1045-1046). Without the widen the second
  // label overlaps the first and the canvas is too narrow.
  it('a second labeled self-loop reserves additional width (widen step)', () => {
    const one = extent('digraph{ a->a [label="LOOPLABELWIDE"]; }').w;
    const two = extent('digraph{ a->a [label="LOOPLABELWIDE"]; a->a [label="LOOPLABELWIDE"]; }').w;
    // The second loop's label adds roughly its own width; require a clear jump.
    expect(two).toBeGreaterThan(one + 100);
  });
});
