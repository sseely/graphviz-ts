// SPDX-License-Identifier: EPL-2.0

/**
 * Regression pins for graphviz-ts steering-port behavior that INTENTIONALLY
 * diverges from dot 15.0.0 by a documented amount. Scott reviewed the visual
 * comparison pages (plans/parity-steering-port-routing/comparisons/*.html) and
 * accepted graphviz-ts's output as proper for these cases; this file pins that
 * output so the geometry cannot silently drift.
 *
 * These are NOT oracle (dot-parity) tests — the pinned values are graphviz-ts's
 * own deterministic output, pinned tight (0.01pt). The measured delta vs dot
 * 15.0.0 is recorded in each comparison page:
 *  - An-Bs-double-steering.html      compound A:n->B:s, mid-corridor ~24pt
 *  - multirank-left-bulge.html       A:w->C / deep A:n->E, left bulge clamped at x=0
 *  - port-golden-bbox.html           A:n->B, drawing bbox ~4-5pt larger than dot
 *  - self-ew-double-lateral.html     A:e->A:w lateral self-loop, node shifted ~5.5pt
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

interface PinCase { label: string; src: string; viewBox?: string; pts: number[][]; }

// graphviz-ts deterministic output, captured 2026-06-15 (.probes/pin-capture.ts).
const CASES: PinCase[] = [
  {
    // Now matches dot 15.0.0 (mid-corridor x=87.3 vs dot 87.5) after the
    // per-rank MINW bound fix; the SR4 24pt exclusion is resolved. Residual
    // ~0.65pt is the start-clip renormalization.
    label: 'An-Bs compound double-steering A:n->B:s (mid-corridor x=87.3, matches dot)',
    src: 'digraph{A:n->B:s}', viewBox: '0.00 0.00 95.00 137.00',
    pts: [[27, -117.36], [27, -129.37], [45.67, -125.01], [54, -116.36],
      [87.31, -81.8], [87.31, -42.93], [54, -8.36], [49.44, -3.64],
      [41.8, -0.19], [35.8, 0]],
  },
  {
    label: 'multi-rank left-lateral A:w->C (left bulge clamped at x=0)',
    src: 'digraph{A:w->C; A->B->C}', viewBox: '0.00 0.00 123.00 188.00',
    pts: [[46.26, -162], [0, -162], [28.1, -86.97], [47.11, -45.61]],
  },
  {
    label: 'multi-rank deep 4-rank A:n->E (left bulge clamped at x=0)',
    src: 'digraph{A:n->E; A->B->C->D->E}', viewBox: '0.00 0.00 101.00 345.00',
    pts: [[38.09, -325], [38.09, -337.01], [56.76, -332.65], [65.09, -324],
      [76.2, -312.48], [71.11, -302.82], [65.09, -288], [56.7, -267.32],
      [38.49, -272.68], [30.09, -252], [0, -177.88], [24.11, -151.78],
      [30.09, -72], [30.69, -63.99], [31.8, -55.35], [33, -47.43]],
  },
  {
    label: 'TOP-steering A:n->B (drawing bbox 73x129; edge faithful to dot)',
    src: 'digraph{A:n->B}', viewBox: '0.00 0.00 73.00 129.00',
    pts: [[27, -109], [27, -121.01], [45.67, -116.65], [54, -108],
      [65.1, -96.48], [57.73, -87.56], [54, -72], [51.76, -62.68],
      [47.6, -53.15], [43.2, -44.79]],
  },
  {
    label: 'lateral self-loop A:e->A:w (node region shifted ~5.5pt vs dot)',
    src: 'digraph{A:e->A:w; A->B}',
    pts: [[71.01, -90], [89.01, -108], [89.01, -144], [44.01, -144],
      [5.69, -144], [0, -117.89], [10.27, -99.03]],
  },
];

const TOL = 0.01;

describe('steering-port regression pins (graphviz-ts behavior, Scott-accepted)', () => {
  for (const c of CASES) {
    it(`${c.label}`, () => {
      const svg = renderSvg(c.src, 'dot');
      if (c.viewBox !== undefined) expect(svg.match(RE_VB)?.[1]).toBe(c.viewBox);
      const ts = loopPath(svg);
      expect(ts.length).toBe(c.pts.length);
      for (let i = 0; i < c.pts.length; i++) {
        expect(dist(ts[i], c.pts[i])).toBeLessThanOrEqual(TOL);
      }
    });
  }
});
