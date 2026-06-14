// SPDX-License-Identifier: EPL-2.0

/**
 * SR6 — oracle-pinned geometry for self-edge side-port routing.
 *
 * SR6 finding (verify-first): self-edges already route through the faithful
 * `makeSelfEdge` common path (`src/common/splines-selfedge.ts`), dispatched by
 * `routeSelfEdgeGroup` (self-loop.ts) from `dotSplines_` — NOT through
 * `routeOneEdge`/`hasSidePort`. `routeDotEdges` skips self-edges
 * (`e.tail === e.head` continue). So SR6 is a validation+pin task, not a port:
 * `self-loop.ts` is unchanged. A side port reaches the self-edge router via
 * `e.info.tail_port`/`head_port` and `makeSelfEdge` honors it.
 *
 * This test pins each self-loop's first-path control points and arrowhead tip to
 * the geometry emitted by the installed `dot` 15.0.0 binary (`dot -Tsvg`),
 * captured 2026-06-14 via `.probes/sr6-self.ts`. The `; A->B` rank-below gives
 * the self-loop a proper rank gap (`computeSizey`), matching real usage; the
 * self-loop is the first `<path>` in both C and TS output.
 *
 * Tolerance (SR4 precedent): 0.5pt for side-port loops (clipAndInstall
 * renormalization), exact (0.06pt) for the plain loop which matches C byte-wise.
 * Coordinates are in the SVG frame (y negated from graphviz-internal y-up).
 *
 * The lateral `A:e->A:w` self-loop diverges ~5.7pt (node A's reserved width
 * shifts its center): the divergence traces into the frozen `selfRightSpace`
 * width reservation (AD5 black box), so it is journal-excluded with a
 * comparison page (comparisons/self-ew-double-lateral.md), not asserted here.
 *
 * @see lib/dotgen/dotsplines.c:dot_splines_ (self-edge branch, 305-409)
 * @see lib/common/splines.c:makeSelfEdge
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const Q = String.fromCharCode(34);
const RE_PATH = new RegExp('<path[^>]*\\sd=' + Q + '(M[^' + Q + ']+)' + Q);
const RE_NUM = new RegExp('-?[0-9.]+', 'g');
const RE_ARROW = new RegExp(
  '<polygon fill=' + Q + 'black' + Q + '[^>]*points=' + Q + '([^' + Q + ']+)' + Q,
);
const RE_WS = new RegExp('\\s+');

interface Pt { x: number; y: number; }

/** First edge `<path d="M...">` control points (the self-loop), SVG frame. */
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
  pts: number[][];
  tip: number[];
  exact: boolean;
}

// All values from dot - graphviz version 15.0.0 (.probes/sr6-self.ts, 2026-06-14).
const CASES: OracleCase[] = [
  {
    label: 'A->A (plain self-loop, exact)', src: 'digraph{A->A; A->B}', exact: true,
    pts: [[46.90, -102.43], [59.69, -105.68], [72, -101.53], [72, -90],
      [72, -81.98], [66.05, -77.54], [58.12, -76.66]],
    tip: [48.40, -77.45],
  },
  {
    label: 'A:n->A:s (both side ports)', src: 'digraph{A:n->A:s; A->B}', exact: false,
    pts: [[27, -108.32], [42, -126.32], [72, -126.32], [72, -90],
      [72, -59.64], [51.04, -54.66], [35.40, -64.35]],
    tip: [28.14, -70.68],
  },
  {
    label: 'A:n->A (one side port)', src: 'digraph{A:n->A; A->B}', exact: false,
    pts: [[27, -108.32], [42, -126.32], [72, -126.32], [72, -99.16],
      [72, -87.34], [66.32, -80.67], [58.67, -78.38]],
    tip: [48.88, -77.97],
  },
];

const TOL = 0.5;
const EXACT_TOL = 0.06;

describe('SR6 — self-edge side-port geometry vs dot 15.0.0', () => {
  for (const c of CASES) {
    it(`${c.label}: self-loop control points + tip within tolerance`, () => {
      const svg = renderSvg(c.src, 'dot');
      const ts = pathPoints(svg);
      expect(ts.length).toBe(c.pts.length);
      const tol = c.exact ? EXACT_TOL : TOL;
      for (let i = 0; i < c.pts.length; i++) {
        expect(dist(ts[i], c.pts[i])).toBeLessThanOrEqual(tol);
      }
      expect(dist(arrowTip(svg), c.tip)).toBeLessThanOrEqual(TOL);
    });
  }
});
