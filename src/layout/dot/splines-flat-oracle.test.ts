// SPDX-License-Identifier: EPL-2.0

/**
 * SR5 — oracle-pinned geometry for faithful flat-edge side-port routing.
 *
 * A flat (same-rank) edge carrying a side-mask port is routed through the
 * faithful `beginPath → routeSplines → endPath → clipAndInstall` pipeline
 * (`routeFlatEdgeFaithful`, splines-flat.ts), wired into `routeForwardEdge`
 * behind the same `hasSidePort` gate SR3 uses for regular edges.
 *
 * Scope (verified vs dot 15.0.0, .probes/sr5-*.ts, 2026-06-14): C's
 * `make_flat_edge` has two families —
 *  - ADJACENT endpoints (no node between them on the rank) → `make_flat_adj_edges`
 *    (a recursive rotated-aux pipeline, still deferred in TS); these fall back
 *    to the simplified fitter.
 *  - NON-ADJACENT endpoints (a node sits between them) → the box-channel branch
 *    (`makeFlatEnd`/`make_flat_bottom_edges` + BeginFlatSide/EndFlatSide), which
 *    this task ports. The cases below force non-adjacency with an invisible
 *    same-rank ordering chain `A->C->B`, placing C between A and B.
 *
 * The top-routing aligned cases match dot 15.0.0 exactly / within 0.25pt and
 * are pinned here. Bottom-tail (`:s` tail) cases match the loop SHAPE but carry
 * a constant ~5–7pt vertical offset and are journal-excluded with a comparison
 * page (comparisons/flat-bottom-port-offset.md), as are the adjacent cases.
 *
 * The flat edge is the largest-y-range path in the SVG (the invisible ordering
 * chain edges are flat horizontal segments); the title parity fix is SR8, so
 * selecting by geometry (not <title>) is intentional.
 *
 * @see lib/dotgen/dotsplines.c:make_flat_edge, makeFlatEnd
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const Q = String.fromCharCode(34);
const RE_PATH = new RegExp('<path[^>]*\\sd=' + Q + '(M[^' + Q + ']+)' + Q, 'g');
const RE_NUM = new RegExp('-?[0-9.]+', 'g');

interface Pt { x: number; y: number; }

/** All edge `<path d="M...">` point lists in the SVG, in document order. */
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

/** The steering loop: the path spanning the largest y-range (flat chain edges
 *  are horizontal, so they have ~0 y-range). */
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
  pts: number[][];
  tol: number;
}

// Force non-adjacency: an invisible same-rank chain A->C->B puts C between A,B.
const CHAIN = '{rank=same; A->C->B [style=invis]} ';

// Values from dot - graphviz version 15.0.0 (.probes/sr5-pin.ts, 2026-06-14).
const CASES: OracleCase[] = [
  {
    label: 'A:n->B:n (top loop over the middle node, exact)',
    src: 'digraph{' + CHAIN + 'A:n->B:n}', tol: 0.06,
    pts: [[27, -36], [27, -64.25], [139.23, -67.56], [165.53, -45.93]],
  },
  {
    label: 'A:e->B:w (lateral facing, over the middle node)',
    src: 'digraph{' + CHAIN + 'A:e->B:w}', tol: 0.5,
    pts: [[55.25, -18], [63.96, -18], [59.33, -28.1], [63, -36], [66.77, -44.11],
      [64.39, -49.3], [72, -54], [92.42, -66.62], [105.58, -66.62], [126, -54],
      [133.61, -49.3], [131.23, -44.11], [135, -36], [136.26, -33.28],
      [136.54, -30.31], [136.72, -27.57]],
  },
];

describe('SR5 — flat-edge side-port geometry vs dot 15.0.0', () => {
  for (const c of CASES) {
    it(`${c.label}: loop control points within tolerance`, () => {
      const ts = loopPath(renderSvg(c.src, 'dot'));
      expect(ts.length).toBe(c.pts.length);
      for (let i = 0; i < c.pts.length; i++) {
        expect(dist(ts[i], c.pts[i])).toBeLessThanOrEqual(c.tol);
      }
    });
  }
});
