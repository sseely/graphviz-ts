// SPDX-License-Identifier: EPL-2.0

/**
 * Port-bearing adjacent flat edges route via the rotated aux graph
 * (make_flat_adj_edges). The aux pipeline's virtual nodes must be
 * repositioned (DOT-11a) so the spline is conformant to dot 15.0.0, and the
 * label must be copied back at the correct position (DOT-11b + DOT-10).
 *
 * Oracle: ~/git/graphviz/build/cmd/dot/dot -Tsvg, GVBINDIR=/tmp/gvplugins,
 * graphviz 15.0.0, 2026-06-17.
 *
 * @see lib/dotgen/dotsplines.c:make_flat_adj_edges
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';
import { pinLutMeasurer } from "../../../test/helpers/measurer.js";

pinLutMeasurer();

const Q = String.fromCharCode(34);
const RE_PATH = new RegExp('<path[^>]*\\sd=' + Q + '(M[^' + Q + ']+)' + Q, 'g');
const RE_NUM = new RegExp('-?[0-9.]+', 'g');
const TOL = 0.5;

interface Pt { x: number; y: number; }

/** First edge `<path d="M...">` control-point list. */
function firstPath(svg: string): Pt[] {
  RE_PATH.lastIndex = 0;
  const m = RE_PATH.exec(svg);
  if (m === null) return [];
  const nums = m[1].match(RE_NUM) ?? [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  return pts;
}

const dist = (p: Pt, q: number[]): number => Math.hypot(p.x - q[0], p.y - q[1]);

function pinPath(ts: Pt[], want: number[][]): void {
  expect(ts.length).toBe(want.length);
  for (let i = 0; i < want.length; i++) expect(dist(ts[i], want[i])).toBeLessThanOrEqual(TOL);
}

// DOT-11a: labeled port-bearing adjacent flat — spline conformant to dot.
const LABELED_SRC = 'digraph{ {rank=same; a b} a:e->b:w[label="x"] }';
const LABELED_SPLINE = [
  [54, -18], [62.13, -18], [60.91, -26.42], [68.62, -29], [71.47, -29.95],
  [72.53, -29.95], [75.38, -29], [78.03, -28.11], [79.62, -26.54], [80.91, -24.85],
];

// DOT-11a regression: no-label port-bearing adjacent flat stays conformant.
const PLAIN_SRC = 'digraph{ {rank=same; a b} a:e->b:w }';
const PLAIN_SPLINE = [[54, -18], [56.75, -18], [58.79, -18], [60.61, -18]];

describe('DOT-11a — aux reposition makes labeled flat spline conformant', () => {
  it('routes the labeled flat spline matching dot 15.0.0', () => {
    pinPath(firstPath(renderSvg(LABELED_SRC, 'dot')), LABELED_SPLINE);
  });

  it('leaves the no-label ported flat spline conformant', () => {
    pinPath(firstPath(renderSvg(PLAIN_SRC, 'dot')), PLAIN_SPLINE);
  });
});

// DOT-12 + DOT-10: the label vnode is repositioned onto the spline
// (recover_slack) and copied back, so the label lands at the dot position.
function labelXY(svg: string): Pt | null {
  const re = new RegExp('<text[^>]*\\sx=' + Q + '([-0-9.]+)' + Q + '[^>]*\\sy=' + Q + '([-0-9.]+)' + Q + '[^>]*>x</text>');
  const m = svg.match(re);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

describe('DOT-12 + DOT-10 — port-bearing labeled flat emits its label', () => {
  it('places <text>x</text> at the dot 15.0.0 position (72, -32.91)', () => {
    const lp = labelXY(renderSvg(LABELED_SRC, 'dot'));
    expect(lp).not.toBeNull();
    expect(dist(lp!, [72, -32.91])).toBeLessThanOrEqual(TOL);
  });
});

// #1949: make_flat_adj_edges clones the flat endpoints into a rotated aux graph
// and re-sizes them there. A node that INHERITS an attr (here `node[fontsize=24]`
// — the node never sets fontsize itself) must keep resolving it in the aux, which
// has no node defaults of its own. C's cloneNode does agcopyattr (materialises
// inherited values); the port carries the origin's nodeDefaultsSnapshot. Without
// that, the cloned node re-measures its label at the built-in fontsize=14, the
// aux node shrinks, and the routed spline (and thus graph height) is wrong: this
// graph rendered 129pt pre-fix vs 143pt with the inherited fontsize=24 (native
// dot 15.0.0 estimate: 148pt). @see lib/dotgen/dotsplines.c:cloneNode (agcopyattr)
// 2026-07-01 (fix/nan-a2-retire T3): 143→142 — the aux 2-cycle clones no longer
// route as an erroneous Multisep fan (markAdjacent same-rank guard + collected
// lane order, @see flat.c:272-276); under the render-one/oracle environment the
// frame now matches native exactly (148=148). The 142 pin is this test env's
// in-process-measurer value; the guarded quantity is still fontsize inheritance
// (≫129), not routing.
const INHERIT_FONT_SRC =
  'digraph{rankdir=LR; node[fontsize=24]; {rank=same; a b} a:s->b:n; b:s->a:n;}';

function graphHeight(svg: string): number {
  const m = svg.match(new RegExp('height=' + Q + '([0-9.]+)pt' + Q));
  return m ? Number(m[1]) : NaN;
}

describe('#1949 — aux clone inherits the graph fontsize default', () => {
  it('sizes the flat-adj aux node at the inherited fontsize (not the built-in 14)', () => {
    expect(graphHeight(renderSvg(INHERIT_FONT_SRC, 'dot'))).toBe(142);
  });
});
