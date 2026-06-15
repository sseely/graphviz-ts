// SPDX-License-Identifier: EPL-2.0

/**
 * SR7 — oracle-pinned geometry for faithful multi-rank side-port routing.
 *
 * A forward edge spanning ≥2 ranks with an active side-mask port is routed
 * through the faithful pipeline (`routeMultiRankEdgeFaithful`,
 * edge-route-faithful.ts): begin at the tail (REGULAREDGE side boxes steer the
 * port), walk the virtual-node chain accumulating rank + maximal boxes, end at
 * the head, then completeRegularPath (its adjustregularpath inter-rank widening
 * finally fires) → routeSplines. Wired into `routeOneEdge` ahead of the
 * simplified multi-rank fitter, behind the same `hasSidePort` gate SR3 uses.
 *
 * Scope (verified vs dot 15.0.0, .probes/sr7-*.ts, 2026-06-14): the steering
 * cases below match within 0.32pt. The straight-mode run optimization
 * (straight_len ≥ threshold) is not ported; chains up to 3 ranks here do not
 * trigger it. Left-bulge cases (`A:w->C` lateral, and deep ≥4-rank chains whose
 * loop crosses the left boundary) clamp where C goes negative and are
 * journal-excluded with a comparison page (comparisons/multirank-left-bulge.md).
 *
 * The multi-rank loop is the largest-y-range path in the SVG (the single-rank
 * chain segments A->B, B->C are short); title parity is SR8, so geometry (not
 * <title>) selects the edge.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag forward path)
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const Q = String.fromCharCode(34);
const RE_PATH = new RegExp('<path[^>]*\\sd=' + Q + '(M[^' + Q + ']+)' + Q, 'g');
const RE_NUM = new RegExp('-?[0-9.]+', 'g');

interface Pt { x: number; y: number; }

function allPaths(svg: string): Pt[][] {
  const out: Pt[][] = [];
  let m: RegExpExecArray | null;
  RE_PATH.lastIndex = 0;
  while ((m = RE_PATH.exec(svg)) !== null) {
    const nums = m[1].match(RE_NUM) ?? [];
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
    }
    out.push(pts);
  }
  return out;
}

/** The multi-rank loop: path spanning the largest y-range. */
function loopPath(svg: string): Pt[] {
  let best: Pt[] = [];
  let bestRange = -1;
  for (const p of allPaths(svg)) {
    const ys = p.map(q => q.y);
    const range = Math.max(...ys) - Math.min(...ys);
    if (range > bestRange) { bestRange = range; best = p; }
  }
  return best;
}

const dist = (p: Pt, q: number[]): number => Math.hypot(p.x - q[0], p.y - q[1]);

interface OracleCase { label: string; src: string; pts: number[][]; }

// Values from dot - graphviz version 15.0.0 (.probes/sr7-pin.ts, 2026-06-14).
const CASES: OracleCase[] = [
  {
    label: 'A:n->C (2-rank TOP steering over B)', src: 'digraph{A:n->C; A->B->C}',
    pts: [[27, -181.32], [27, -193.33], [45.67, -188.97], [54, -180.32],
      [65.2, -168.7], [60.07, -158.96], [54, -144], [45.61, -123.32],
      [27.39, -128.68], [19, -108], [11.1, -88.54], [13.79, -64.78], [18.08, -46.71]],
  },
  {
    label: 'A:e->C (2-rank RIGHT lateral)', src: 'digraph{A:e->C; A->B->C}',
    pts: [[69.25, -162], [115.55, -162], [86.78, -86.97], [67.39, -45.61]],
  },
  {
    label: 'A:n->D (3-rank TOP steering, no straight-mode)',
    src: 'digraph{A:n->D; A->B->C->D}',
    pts: [[27, -253.32], [27, -265.33], [45.67, -260.97], [54, -252.32],
      [65.2, -240.7], [60.07, -230.96], [54, -216], [45.61, -195.32],
      [27.39, -200.68], [19, -180], [1.19, -136.12], [10.42, -79.9], [18.72, -46.83]],
  },
];

const TOL = 0.5;

describe('SR7 — multi-rank side-port edge geometry vs dot 15.0.0', () => {
  for (const c of CASES) {
    it(`${c.label}: chain loop control points within tolerance`, () => {
      const ts = loopPath(renderSvg(c.src, 'dot'));
      expect(ts.length).toBe(c.pts.length);
      for (let i = 0; i < c.pts.length; i++) {
        expect(dist(ts[i], c.pts[i])).toBeLessThanOrEqual(TOL);
      }
    });
  }
});
