// SPDX-License-Identifier: EPL-2.0

/**
 * RED oracle test — adjacent-flat edge grouping (#241_0, nodes 2↔3).
 *
 * C `dot_splines_` groups all three adjacent flat edges between nodes 2 and 3
 * into ONE `make_flat_adj_edges` call (cnt=3). The port dispatches each edge
 * in isolation (cnt=1), so the back-edge `3:sw->2:se` is routed as a forward
 * edge in its own aux → straight spline (size=4) instead of a back-edge curl
 * (size=7).
 *
 * RED until T2 grouping lands (edge-route.ts caller-side grouping pass).
 *
 * ## C oracle (dot 15.0.0 / native, clean binary, 2026-06-20):
 *
 * edge11 — 2:ne->3:nw (forward, already correct in port shape):
 *   d="M185.02,-40.9C186.01,-41.89 184.88,-43.06 186.02,-43.88
 *      191.39,-47.75 206.14,-48.86 217.03,-45.95"
 *   7 coord-pairs, Y-range ≈ 7.96pt (curl)
 *
 * edge12 — 3:sw->2:se (back edge, BUG — port emits size=4 straight):
 *   C oracle:
 *     d="M228.98,-10.86C227.99,-9.87 229.12,-8.7 227.98,-7.88
 *        216.52,0.37 206.01,1.79 195.86,-3.95"
 *     7 coord-pairs, Y-range ≈ 12.65pt (curl)
 *   Port (current / buggy):
 *     d="M227.98,-2.98C217.82,-2.98 207.66,-2.98 197.49,-2.98"
 *     4 coord-pairs, Y-range = 0pt (straight line)
 *
 * ## AD-1 resolution (from T1 C instrumentation, 2026-06-20):
 *   e0_tail=2, e0_head=3 (e0 is normalized-forward; `tn`=node2 determines auxt)
 *   edges[0]: 3->2 (back edge, lower AGSEQ=2)
 *   edges[1]: 2->3 (forward ne->nw, same main AGSEQ=2)
 *   edges[2]: 2->3 (forward e->w, same main AGSEQ=2)
 *   auxt cloned from: 2  (tn = agtail(e0) = node2)
 *   auxh cloned from: 3
 *   aux_spline sizes: 2->3 size=7, 2->3 size=4, 2->3 size=4, 3->2 size=7
 *
 * @see plans/group-adjacent-flats/findings-ordering-contract.md
 * @see lib/dotgen/dotsplines.c:make_flat_adj_edges, make_flat_edge
 * @see src/layout/dot/edge-route.ts:routeFaithfulSidePort
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

// The 241_0.dot source (from ~/git/graphviz/tests/241_0.dot), inlined to avoid
// filesystem dependency. The red edges between nodes 2 and 3 are the target.
const DOT_241_0 = `\
digraph {
  splines=true
  { rank=same
    0 [label="("]
    1 [label="("]
    2 [label=A]
    3 [label="*"]
    4 [label=B]
    5 [label="|"]
    6 [label=A]
    7 [label=C]
    8 [label=")"]
    9 [label=D]
    10 [label=")"]
    5 -> 6 [style=invis]
    2:e -> 3:w
    4:e -> 5:w
    6:e -> 7:w
    7:e -> 8:w
    9:e -> 10:w
    0:e -> 1:w [color=red]
    1:e -> 2:w [color=red]
    3:e -> 4:w [color=red]
    8:e -> 9:w [color=red]
    2:ne -> 3:nw [color=red]
    3:sw -> 2:se [color=red]
    1:se -> 6:sw [color=red]
    5:ne -> 8:nw [color=red]
  }
}`;

// ---------- SVG parsing helpers ----------

interface Pt { x: number; y: number; }

const Q = String.fromCharCode(34);
const RE_EDGE = new RegExp(
  '<g[^>]*class=' + Q + 'edge' + Q + '[^>]*>[\\s\\S]*?</g>',
  'g',
);
const RE_TITLE = /<title>([^<]+)<\/title>/;
const RE_PATH = new RegExp('\\sd=' + Q + '(M[^' + Q + ']+)' + Q);
const RE_NUM = /-?[0-9]+(?:\.[0-9]+)?/g;

interface EdgePath {
  title: string;
  pts: Pt[];
}

/** Parse the d="M..." coordinate pairs from an SVG path string. */
function parsePts(d: string): Pt[] {
  const nums = d.match(RE_NUM) ?? [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  }
  return pts;
}

/** Extract all edge paths from the SVG, keyed by unescaped title. */
function edgePaths(svg: string): EdgePath[] {
  const out: EdgePath[] = [];
  let m: RegExpExecArray | null;
  RE_EDGE.lastIndex = 0;
  while ((m = RE_EDGE.exec(svg)) !== null) {
    const block = m[0];
    const titleM = RE_TITLE.exec(block);
    const pathM = RE_PATH.exec(block);
    if (!titleM || !pathM) continue;
    // Unescape &#45; → -
    const title = titleM[1].replace(/&#45;/g, '-').replace(/&#62;/g, '>');
    out.push({ title, pts: parsePts(pathM[1]) });
  }
  return out;
}

function yRange(pts: Pt[]): number {
  const ys = pts.map(p => p.y);
  return Math.max(...ys) - Math.min(...ys);
}

// ---------- Tests ----------

/**
 * GUARD: forward edge 2:ne->3:nw must ALREADY be a 7-point curl.
 * GREEN now; must stay GREEN after T2.
 * C oracle: 7 pts, Y-range ≈ 7.96pt. Port: same shape, Y-shifted ~7.88pt.
 */
function assertFwdCurl(svg: string): void {
  const edges = edgePaths(svg);
  const fwd = edges.find(e => e.title.includes('2:ne') && e.title.includes('3:nw'));
  expect(fwd).toBeDefined();
  expect(fwd!.pts.length).toBe(7);
  expect(yRange(fwd!.pts)).toBeGreaterThan(5);
}

/**
 * RED: back edge 3:sw->2:se must be a 7-point curl (size=7), not a
 * 4-point straight line (size=4).
 * C oracle: 7 pts, Y-range ≈ 12.65pt. Port bug: 4 pts, Y-range = 0.
 * RED until T2 grouping lands.
 */
function assertBackCurl(svg: string): void {
  const edges = edgePaths(svg);
  const back = edges.find(e => e.title.includes('3:sw') && e.title.includes('2:se'));
  expect(back).toBeDefined();
  expect(back!.pts.length).toBe(7);
  expect(yRange(back!.pts)).toBeGreaterThan(10);
}

describe('flat-group #241_0 — adjacent flat edges 2↔3', () => {
  it('GUARD: 2:ne->3:nw forward edge is already a curl (7 pts, Y-range > 5pt)', () => {
    assertFwdCurl(renderSvg(DOT_241_0, 'dot'));
  });

  // XFAIL (expected-fail tripwire): grouping (T2) landed and is golden-neutral,
  // but a SECOND divergence blocks the curl — the aux back-edge clone (auxh->auxt,
  // a regular adjacent-rank back edge in the aux) is routed straight by
  // routeFaithfulAdjacentBack, which does not honor its corner ports, where C's
  // make_regular_edge curls it (size 7). Fix is OUT OF SCOPE here (core back-edge
  // routing, not the adjacent-flat dispatch — AD-2/scope-creep STOP). When that
  // fix lands, assertBackCurl will pass and this `.fails` flips RED — un-fail it.
  // @see plans/group-adjacent-flats/findings-second-divergence.md
  it.fails('XFAIL: 3:sw->2:se back edge stays straight — blocked on aux back-edge port-curl', () => {
    assertBackCurl(renderSvg(DOT_241_0, 'dot'));
  });
});
