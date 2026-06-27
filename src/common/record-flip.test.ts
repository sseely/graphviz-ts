// SPDX-License-Identifier: EPL-2.0

/**
 * Regression: record nodes must apply the rankdir flip to their lw/rw/ht like
 * every other shape. C's `record_init` sets only ND_width/ND_height; ND_lw/rw/ht
 * come from `gv_nodesize(n, GD_flip)`, which swaps width↔height under
 * rankdir=LR/RL. The port previously set lw/rw/ht directly from the record's
 * (field-flipped) size, so the node stayed un-rotated while gvPostprocess rotated
 * the bbox → a transposed bbox that was far too narrow → the record drew OUTSIDE
 * the viewport (corpus 925: native 336×128, port rendered 59×518 and clipped).
 *
 * @see lib/common/shapes.c:record_init
 * @see lib/common/utils.c:gv_nodesize
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

const LR = 'digraph { rankdir=LR; a[shape=record label="X|Y|Z"] }';
const TB = 'digraph { a[shape=record label="X|Y|Z"] }';

describe('record node sizing under rankdir=LR (flip)', () => {
  it('flips the record to its native bbox (62×83), not the transposed/clipped one', () => {
    const svg = renderSvg(LR, 'dot');
    // headless 15.1.0: 62pt × 83pt (the pre-fix bug produced 59×518).
    expect(svg).toMatch(/<svg width="62pt" height="83pt"/);
  });

  it('stacks the fields (horizontal separators) and keeps the box in the viewport', () => {
    const svg = renderSvg(LR, 'dot');
    // record box polygon is 54pt wide (cells stacked vertically under LR).
    const poly = /<polygon fill="none"[^>]*points="([^"]+)"/.exec(svg)![1];
    const xs = poly.trim().split(/\s+/).map((p) => Number(p.split(',')[0]));
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(54, 0);
    // field separators run HORIZONTALLY (constant y) → flipped layout (the bug
    // left them vertical / the box transposed). Both endpoints share a y.
    const sep = /<polyline fill="none"[^>]*points="([^"]+)"/.exec(svg)![1];
    const ys = sep.trim().split(/\s+/).map((p) => Number(p.split(',')[1]));
    expect(ys[0]).toBeCloseTo(ys[1], 1);
  });

  it('leaves record TB orientation unchanged (no regression)', () => {
    expect(renderSvg(TB, 'dot')).toMatch(/<svg width="85pt" height="45pt"/);
  });
});
