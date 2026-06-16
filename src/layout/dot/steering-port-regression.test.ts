// SPDX-License-Identifier: EPL-2.0

/**
 * Dot-oracle pins for graphviz-ts steering-port routing. These cases were once
 * accepted divergences (mid-corridor too narrow, left bulge clamped at x=0,
 * node region shifted, drawing bbox too large). Two faithful fixes closed the
 * whole class:
 *  - per-rank MINW corridor bounds (edge-route-rank.ts, dotsplines.c:278)
 *  - adaptive refined-curve bb growth (splines-geom.ts updateBbBz, emit.c:746)
 * After both, every case below matches dot 15.0.0 within ~0.7pt of geometry and
 * ±1pt of the drawing bbox. The values pinned here are dot's; a regression in
 * either fix re-opens the divergence and fails these tests.
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const Q = String.fromCharCode(34);
const RE_PATH = new RegExp('<path[^>]*\\sd=' + Q + '(M[^' + Q + ']+)' + Q, 'g');
const RE_NUM = new RegExp('-?[0-9.]+', 'g');
const RE_VB = new RegExp('viewBox=' + Q + '([^' + Q + ']+)' + Q);

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

/** The steering loop / self-loop: the path spanning the largest y-range. */
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

interface OracleCase {
  label: string;
  src: string;
  vb: [number, number]; // dot viewBox [width, height]
  tol: number;
  pts: number[][]; // dot 15.0.0 loop control points
}

// Values from a locally built dot (15.1.0-dev; geometry identical to 15.0.0).
const CASES: OracleCase[] = [
  {
    label: 'An-Bs compound double-steering A:n->B:s (mid-corridor matches dot)',
    src: 'digraph{A:n->B:s}', vb: [87, 134], tol: 0.7,
    pts: [[27, -118.01], [27, -130.01], [45.67, -125.65], [54, -117.01],
      [87.5, -82.24], [87.5, -43.13], [54, -8.36], [49.44, -3.64],
      [41.8, -0.19], [35.8, 0]],
  },
  {
    label: 'multi-rank left-lateral A:w->C (left bulge reaches x=-21, matches dot)',
    src: 'digraph{A:w->C; A->B->C}', vb: [103, 188], tol: 0.5,
    pts: [[25.3, -162], [-20.97, -162], [7.27, -86.97], [26.35, -45.61]],
  },
  {
    label: 'multi-rank deep 4-rank A:n->E (left bulge reaches x=-11, matches dot)',
    src: 'digraph{A:n->E; A->B->C->D->E}', vb: [90, 341], tol: 0.5,
    pts: [[27, -325.32], [27, -337.33], [45.67, -332.97], [54, -324.32],
      [65.2, -312.7], [60.07, -302.96], [54, -288], [45.61, -267.32],
      [27.39, -272.68], [19, -252], [-11.09, -177.88], [13.01, -151.78],
      [19, -72], [19.6, -63.99], [20.71, -55.35], [21.91, -47.43]],
  },
  {
    label: 'TOP-steering A:n->B (drawing bbox 68x125, matches dot)',
    src: 'digraph{A:n->B}', vb: [68, 125], tol: 0.5,
    pts: [[27, -109.32], [27, -121.33], [45.67, -116.97], [54, -108.32],
      [65.2, -96.7], [57.77, -87.7], [54, -72], [51.76, -62.68],
      [47.6, -53.15], [43.2, -44.79]],
  },
  {
    label: 'lateral self-loop A:e->A:w (node region matches dot, no bb shift)',
    src: 'digraph{A:e->A:w; A->B}', vb: [85, 152], tol: 0.5,
    pts: [[65.77, -90], [83.52, -108], [83.52, -144], [38.52, -144],
      [0.38, -144], [-5.44, -118.13], [4.49, -99.29]],
  },
];

describe('steering-port dot-oracle pins (match dot 15.0.0 after bb + bound fix)', () => {
  for (const c of CASES) {
    it(`${c.label}`, () => {
      const svg = renderSvg(c.src, 'dot');
      const vb = (svg.match(RE_VB)?.[1] ?? '0 0 0 0').split(/\s+/).map(Number);
      expect(Math.abs(vb[2] - c.vb[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(vb[3] - c.vb[1])).toBeLessThanOrEqual(1);
      const ts = loopPath(svg);
      expect(ts.length).toBe(c.pts.length);
      for (let i = 0; i < c.pts.length; i++) {
        expect(dist(ts[i], c.pts[i])).toBeLessThanOrEqual(c.tol);
      }
    });
  }
});
