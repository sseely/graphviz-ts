// SPDX-License-Identifier: EPL-2.0

/**
 * SR4 — oracle-pinned geometry for the faithful side-port router.
 *
 * SR3 wired forward adjacent-rank regular edges with an active side-mask port
 * (`tail_port.side || head_port.side`) through the faithful
 * `beginPath → routeSplines → endPath → clipAndInstall` pipeline. This test
 * pins each side-port edge's first-path control points and arrowhead tip to the
 * geometry emitted by the installed `dot` 15.0.0 binary (`dot -Tsvg`), captured
 * 2026-06-14 via `.probes/sr4-oracle.ts`.
 *
 * Tolerance (AD6 / T6a precedent): the faithful fitter is numerically close to
 * but not byte-identical with C's `routesplines` (Proutespline renormalization +
 * libm), so attachment + interior points are pinned at 0.5pt. Cases whose start
 * matches C exactly are additionally pinned tight at 0.06pt.
 *
 * Coordinates are in the SVG frame (y negated from graphviz-internal y-up).
 *
 * Findings carried to the decision journal:
 *  - C's ±1 port-box nudge does NOT survive to the rendered output (every
 *    attachment point is ≤0.32pt off, never ~1pt) — same as the simplified path.
 *  - Edge `<title>` port parity (`A:f0:n->B` → `A:n->B`, hyphen escaping) is a
 *    separate, SR8-scoped fix; not asserted here.
 *  - The compound both-ends case `A:n->B:s` diverges 24pt in its lateral
 *    excursion and is journal-excluded with a comparison page (out of batch-2
 *    named scope); it is intentionally absent below.
 *
 * @see lib/dotgen/dotsplines.c:make_regular_edge
 * @see lib/common/routespl.c:routesplines_
 * @see lib/common/splines.c:clip_and_install
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';
import { pinLutMeasurer } from "../../../test/helpers/measurer.js";

pinLutMeasurer();

const Q = String.fromCharCode(34);
const RE_PATH = new RegExp('<path[^>]*\\sd=' + Q + '(M[^' + Q + ']+)' + Q);
const RE_NUM = new RegExp('-?[0-9.]+', 'g');
const RE_ARROW = new RegExp(
  '<polygon fill=' + Q + 'black' + Q + '[^>]*points=' + Q + '([^' + Q + ']+)' + Q,
);
const RE_WS = new RegExp('\\s+');

interface Pt { x: number; y: number; }

/** First edge `<path d="M...">` control points, in the SVG frame. */
function pathPoints(svg: string): Pt[] {
  const m = svg.match(RE_PATH);
  if (m === null) throw new Error('no edge path in SVG');
  const nums = m[1].match(RE_NUM) ?? [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  }
  return pts;
}

/** First black arrowhead's tip: the vertex furthest from the polygon centroid. */
function arrowTip(svg: string): Pt {
  const m = svg.match(RE_ARROW);
  if (m === null) throw new Error('no black arrowhead in SVG');
  const pts = m[1].trim().split(RE_WS).map(pair => {
    const xy = pair.split(',').map(Number);
    return { x: xy[0], y: xy[1] };
  });
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  let best = pts[0];
  let bd = -1;
  for (const p of pts) {
    const d = (p.x - cx) ** 2 + (p.y - cy) ** 2;
    if (d > bd) { bd = d; best = p; }
  }
  return best;
}

const dist = (p: Pt, q: number[]): number => Math.hypot(p.x - q[0], p.y - q[1]);

interface OracleCase {
  label: string;
  src: string;
  pts: number[][];   // dot 15.0.0 first-path control points
  tip: number[];     // dot 15.0.0 arrowhead tip
  exactStart: boolean;
}

const REC = 'A[shape=record,label=' + Q + '<f0>a|<f1>b' + Q + '];';

// All values from dot - graphviz version 15.0.0 (.probes/sr4-oracle.ts, 2026-06-14).
const CASES: OracleCase[] = [
  {
    label: 'A:n->B (TOP steering loop)', src: 'digraph{A:n->B}', exactStart: false,
    pts: [[27, -109.32], [27, -121.33], [45.67, -116.97], [54, -108.32],
      [65.20, -96.70], [57.77, -87.70], [54, -72], [51.76, -62.68],
      [47.60, -53.15], [43.20, -44.79]],
    tip: [38.37, -36.25],
  },
  {
    label: 'A:s->B (toward head, straight)', src: 'digraph{A:s->B}', exactStart: true,
    pts: [[27, -72], [27, -64.06], [27, -55.44], [27, -47.52]],
    tip: [27, -37.70],
  },
  {
    label: 'A:e->B (right lateral bulge)', src: 'digraph{A:e->B}', exactStart: false,
    pts: [[55.25, -90], [73.37, -90], [70.27, -66.60], [64.35, -46.66]],
    tip: [61.25, -37.26],
  },
  {
    label: 'A:w->B (left lateral bulge)', src: 'digraph{A:w->B}', exactStart: false,
    pts: [[25.75, -90], [7.63, -90], [10.73, -66.60], [16.65, -46.66]],
    tip: [19.75, -37.26],
  },
  {
    label: 'A:s->B:n (T8 11pt geometry blocker, now exact)',
    src: 'digraph{A:s->B:n}', exactStart: true,
    pts: [[27, -72], [27, -60.62], [27, -55.32], [27, -47.45]],
    tip: [27, -37.51],
  },
  {
    label: 'rankdir=LR A:e->B (LR frame steering)',
    src: 'digraph{rankdir=LR;A:e->B}', exactStart: true,
    pts: [[54, -18], [61.88, -18], [70.33, -18], [78.37, -18]],
    tip: [88.24, -18],
  },
  {
    label: 'rankdir=LR A:e->B:w (aligned LR)',
    src: 'digraph{rankdir=LR;A:e->B:w}', exactStart: true,
    pts: [[54, -18], [65.38, -18], [70.68, -18], [78.55, -18]],
    tip: [88.49, -18],
  },
  {
    label: 'A->B:s (contradictory head loop)', src: 'digraph{A->B:s}', exactStart: false,
    pts: [[37.63, -81.76], [43.74, -71.62], [50.82, -57.94], [54, -44.69],
      [57.77, -28.99], [65.20, -19.99], [54, -8.36], [49.44, -3.64],
      [41.80, -0.19], [35.80, 0]],
    tip: [28.16, -6.39],
  },
  {
    label: 'record A:f0:n->B (field+side loop, exact)',
    src: 'digraph{' + REC + 'A:f0:n->B}', exactStart: true,
    pts: [[27, -109.50], [27, -115.29], [17.94, -112.75], [14, -108.50],
      [2.98, -96.60], [12.05, -88.11], [14, -72], [14.99, -63.78],
      [16.82, -55.01], [18.80, -47]],
    tip: [21.34, -37.46],
  },
];

const ATTACH_TOL = 0.5;
const INTERIOR_TOL = 0.5;
const EXACT_TOL = 0.06;

describe('SR4 — side-port edge geometry vs dot 15.0.0', () => {
  for (const c of CASES) {
    it(`${c.label}: control points + tip within tolerance`, () => {
      const svg = renderSvg(c.src, 'dot');
      const ts = pathPoints(svg);
      expect(ts.length).toBe(c.pts.length);
      const startTol = c.exactStart ? EXACT_TOL : ATTACH_TOL;
      expect(dist(ts[0], c.pts[0])).toBeLessThanOrEqual(startTol);   // attachment
      expect(dist(arrowTip(svg), c.tip)).toBeLessThanOrEqual(ATTACH_TOL); // arrow tip
      for (let i = 1; i < c.pts.length; i++) {
        expect(dist(ts[i], c.pts[i])).toBeLessThanOrEqual(INTERIOR_TOL);
      }
    });
  }
});
