// SPDX-License-Identifier: EPL-2.0

/**
 * Port-bearing adjacent flat edges route via the rotated aux graph
 * (make_flat_adj_edges). The aux pipeline's virtual nodes must be
 * repositioned (DOT-11a) so the spline is byte-exact to dot 15.0.0, and the
 * label must be copied back at the correct position (DOT-11b + DOT-10).
 *
 * Oracle: ~/git/graphviz/build/cmd/dot/dot -Tsvg, GVBINDIR=/tmp/gvplugins,
 * graphviz 15.0.0, 2026-06-17.
 *
 * @see lib/dotgen/dotsplines.c:make_flat_adj_edges
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

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

// DOT-11a: labeled port-bearing adjacent flat — spline byte-exact to dot.
const LABELED_SRC = 'digraph{ {rank=same; a b} a:e->b:w[label="x"] }';
const LABELED_SPLINE = [
  [54, -18], [62.13, -18], [60.91, -26.42], [68.62, -29], [71.47, -29.95],
  [72.53, -29.95], [75.38, -29], [78.03, -28.11], [79.62, -26.54], [80.91, -24.85],
];

// DOT-11a regression: no-label port-bearing adjacent flat stays byte-exact.
const PLAIN_SRC = 'digraph{ {rank=same; a b} a:e->b:w }';
const PLAIN_SPLINE = [[54, -18], [56.75, -18], [58.79, -18], [60.61, -18]];

describe('DOT-11a — aux reposition makes labeled flat spline byte-exact', () => {
  it('routes the labeled flat spline matching dot 15.0.0', () => {
    pinPath(firstPath(renderSvg(LABELED_SRC, 'dot')), LABELED_SPLINE);
  });

  it('leaves the no-label ported flat spline byte-identical', () => {
    pinPath(firstPath(renderSvg(PLAIN_SRC, 'dot')), PLAIN_SPLINE);
  });
});
