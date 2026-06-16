// SPDX-License-Identifier: EPL-2.0

/**
 * T2 — oracle-pinned geometry for a non-adjacent labeled flat edge.
 *
 * A `rank=same` edge carrying a center label must emit its label `<text>` and
 * route around the label virtual node (flat.ts:flatNode + make_flat_labeled_edge,
 * splines-flat-labeled.ts), dispatched from the live router
 * (edge-route.ts:routeForwardEdge). Non-adjacency is forced with an invisible
 * same-rank ordering chain `a->c->b`, placing c between a and b.
 *
 * EDGETYPE_SPLINE (the dot default) is pinned to dot 15.0.0 below — it matches
 * byte-exact. The EDGETYPE_LINE 7-point branch (flatLabeledLinePoints) is unit-
 * tested directly because `splines=line` is not yet wired into edgeType in this
 * port (dotPhaseInit hardcodes EDGETYPE_SPLINE); the full-render line case is
 * quarantined in comparisons/dot-flat-label-line.md (AD-5).
 *
 * Oracle: ~/git/graphviz/build/cmd/dot/dot -Tsvg, GVBINDIR=/tmp/gvplugins,
 * graphviz 15.0.0, 2026-06-16.
 *
 * @see lib/dotgen/dotsplines.c:make_flat_labeled_edge
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';
import { flatLabeledLinePoints } from './splines-flat-labeled.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';

const Q = String.fromCharCode(34);
const RE_PATH = new RegExp('<path[^>]*\\sd=' + Q + '(M[^' + Q + ']+)' + Q, 'g');
const RE_NUM = new RegExp('-?[0-9.]+', 'g');
const TOL = 0.5;

interface Pt { x: number; y: number; }

/** All edge `<path d="M...">` control-point lists in document order. */
function allPaths(svg: string): Pt[][] {
  const out: Pt[][] = [];
  let m: RegExpExecArray | null;
  RE_PATH.lastIndex = 0;
  while ((m = RE_PATH.exec(svg)) !== null) {
    const nums = m[1].match(RE_NUM) ?? [];
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
    out.push(pts);
  }
  return out;
}

/** Edge path control points spanning the largest y-range (the label loop). */
function loopPath(svg: string): Pt[] {
  let best: Pt[] = [];
  let bestRange = -1;
  for (const pts of allPaths(svg)) {
    const ys = pts.map(p => p.y);
    const range = Math.max(...ys) - Math.min(...ys);
    if (range > bestRange) { bestRange = range; best = pts; }
  }
  return best;
}

/** Position of the `<text>x</text>` label element. */
function labelXY(svg: string): Pt | null {
  const re = new RegExp('<text[^>]*\\sx=' + Q + '([-0-9.]+)' + Q + '[^>]*\\sy=' + Q + '([-0-9.]+)' + Q + '[^>]*>x</text>');
  const m = svg.match(re);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

const dist = (p: Pt, q: number[]): number => Math.hypot(p.x - q[0], p.y - q[1]);

const SPLINE_SRC = 'digraph{ {rank=same; a->c->b[style=invis]} a->b[label="x"] }';
// dot 15.0.0 oracle: label "x" at (117, -57.2); edge spline control points.
const SPLINE_LABEL = [117, -57.2];
const SPLINE_PTS = [
  [45.88, -31.26], [62.74, -42.24], [88.59, -57], [113.62, -63.12],
  [138.5, -69.21], [164.55, -54.61], [182.8, -40.43],
];

describe('T2 — non-adjacent flat label spline vs dot 15.0.0', () => {
  it('emits the label <text>x</text> at dot lp within 0.5pt', () => {
    const lp = labelXY(renderSvg(SPLINE_SRC, 'dot'));
    expect(lp).not.toBeNull();
    expect(dist(lp!, SPLINE_LABEL)).toBeLessThanOrEqual(TOL);
  });

  it('routes the spline around the label, matching dot control points', () => {
    const ts = loopPath(renderSvg(SPLINE_SRC, 'dot'));
    expect(ts.length).toBe(SPLINE_PTS.length);
    for (let i = 0; i < SPLINE_PTS.length; i++) {
      expect(dist(ts[i], SPLINE_PTS[i])).toBeLessThanOrEqual(TOL);
    }
  });
});

const ADJ_SRC = 'digraph{ {rank=same; a b} a->b[label="x"] }';
// dot 15.0.0 oracle: straight flat segment + label "x" centered above it.
const ADJ_LABEL = [72, -24.2];
const ADJ_PTS = [[54.49, -18], [61.99, -18], [70.27, -18], [78.27, -18]];

describe('T3 — adjacent flat label vs dot 15.0.0', () => {
  it('emits the label <text>x</text> at dot lp within 0.5pt', () => {
    const lp = labelXY(renderSvg(ADJ_SRC, 'dot'));
    expect(lp).not.toBeNull();
    expect(dist(lp!, ADJ_LABEL)).toBeLessThanOrEqual(TOL);
  });

  it('routes a straight flat segment matching dot control points', () => {
    const ts = allPaths(renderSvg(ADJ_SRC, 'dot'))[0];
    expect(ts.length).toBe(ADJ_PTS.length);
    for (let i = 0; i < ADJ_PTS.length; i++) {
      expect(dist(ts[i], ADJ_PTS[i])).toBeLessThanOrEqual(TOL);
    }
  });
});

/** Minimal synthetic tail/head/edge for the pure-function line-branch test. */
function lineFixture(): { tn: Node; hn: Node; e: Edge } {
  const tn = { info: { coord: { x: 0, y: 0 } } } as unknown as Node;
  const hn = { info: { coord: { x: 100, y: 0 } } } as unknown as Node;
  const e = {
    info: {
      tail_port: { p: { x: 1, y: 2 } },
      head_port: { p: { x: -1, y: 2 } },
      label: { pos: { x: 50, y: 30 }, dimen: { x: 8, y: 14 } },
    },
  } as unknown as Edge;
  return { tn, hn, e };
}

// EDGETYPE_LINE branch (quarantined at full render — splines=line is unported;
// see comparisons/dot-flat-label-line.md): the 7-point polyline is start, start,
// lp lowered by half label height (x3), end, end.
// @see lib/dotgen/dotsplines.c:make_flat_labeled_edge 1335-1347
describe('T2 — flat label line branch (unit)', () => {
  it('flatLabeledLinePoints builds the faithful 7-point polyline', () => {
    const { tn, hn, e } = lineFixture();
    expect(flatLabeledLinePoints(tn, hn, e)).toEqual([
      { x: 1, y: 2 }, { x: 1, y: 2 },
      { x: 50, y: 23 }, { x: 50, y: 23 }, { x: 50, y: 23 },
      { x: 99, y: 2 }, { x: 99, y: 2 },
    ]);
  });
});
