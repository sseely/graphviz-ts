// SPDX-License-Identifier: EPL-2.0

/**
 * Regression test for the ldbxtried cluster X-coordinate / within-rank-order
 * divergence (mission fix-ldbxtried).
 *
 * Root cause (Batch 0): `interclexp` (cluster.ts) iterated a cluster node's
 * incident edges in `g.edges` INSERTION order instead of C's `agfstedge` order
 * (out-edges sorted by head.id,seq then in-edges sorted by tail.id,seq). That
 * separated parallel intercluster multi-edges (n488->n2, split by n488->n469),
 * so the `prev`-chain merge never accumulated the parallel's ED_xpenalty into
 * the direct fast edge that `rcross` reads (port xpenalty 1 vs C 2). The wrong
 * crossing count at rank 3 flipped the ReMincross best within-rank order, which
 * cascaded into 13 nodes' X coordinates and reordered rank y=-38
 * (n518 jumped rightmost->leftmost).
 *
 * The fix makes `interclexp` iterate `[...n.outEdges(g), ...n.inEdges(g)]`
 * (= agfstedge order), so parallels stay adjacent and merge correctly.
 *
 * Values pinned from the native C oracle (dot 15.x, headless/estimate metrics):
 *   GVBINDIR=/tmp/ghl dot -Tsvg graphs/ldbxtried.gv
 *
 * @see lib/dotgen/cluster.c:interclexp
 * @see lib/cgraph/edge.c:agfstedge
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderSvg } from '../../index.js';

const FIXTURE = join(
  process.cwd(),
  'test/golden/inputs/parallel-cluster-ldbxtried.gv',
);

/** Node center {cx,cy} keyed by title, parsed from rendered SVG. */
function nodeCenters(svg: string): Map<string, { cx: number; cy: number }> {
  const out = new Map<string, { cx: number; cy: number }>();
  const re = /<g[^>]*class="node"[^>]*>([\s\S]*?)<\/g>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const blk = m[1];
    const t = /<title>([^<]*)<\/title>/.exec(blk);
    if (!t) continue;
    const e = /<ellipse[^>]*cx="([-\d.]+)"[^>]*cy="([-\d.]+)"/.exec(blk);
    if (e) {
      out.set(t[1], { cx: +e[1], cy: +e[2] });
      continue;
    }
    const p = /points="([^"]+)"/.exec(blk);
    if (p) {
      const pts = p[1].trim().split(/\s+/).map((s) => s.split(',').map(Number));
      const xs = pts.map((a) => a[0]);
      const ys = pts.map((a) => a[1]);
      out.set(t[1], {
        cx: (Math.min(...xs) + Math.max(...xs)) / 2,
        cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      });
    }
  }
  return out;
}

// C-oracle X coordinate for every node whose X diverged pre-fix (all 13) plus
// the cluster/anchor nodes that frame the two reordered ranks.
const ORACLE_CX: Record<string, number> = {
  n454: 772.89,
  n449: 543.89, n474: 640.89, n461: 99.89, n460: 161.89, n484: 307.89, n488: 376.89,
  n482: 202.89, n483: 264.89, n503: 353.89, n500: 529.89, n496: 610.89, n469: 709.89,
  n505: 30.89, n487: 260.89, n486: 322.89, n526: 471.89, n513: 572.89, n518: 642.89, n479: 730.89,
};

describe('ldbxtried cluster x-coord / within-rank order (interclexp agfstedge order)', () => {
  const svg = renderSvg(readFileSync(FIXTURE, 'utf8'), 'dot');
  const centers = nodeCenters(svg);

  it('places every diverged node at the C-oracle X (±0.01)', () => {
    for (const [name, cx] of Object.entries(ORACLE_CX)) {
      const c = centers.get(name);
      expect(c, `node ${name} missing from render`).toBeDefined();
      expect(Math.abs(c!.cx - cx), `${name} cx ${c!.cx} != oracle ${cx}`)
        .toBeLessThanOrEqual(0.01);
    }
  });

  it('orders rank y=-38 left-to-right as n505,n487,n486,n526,n513,n518,n479', () => {
    // The signature reorder: pre-fix the port placed n518 leftmost in this rank
    // (n518,n526,n513); C orders the trailing free nodes n526,n513,n518.
    const n518 = centers.get('n518');
    expect(n518).toBeDefined();
    const rowY = n518!.cy;
    const row = [...centers.entries()]
      .filter(([, c]) => Math.abs(c.cy - rowY) < 1)
      .sort((a, b) => a[1].cx - b[1].cx)
      .map(([name]) => name);
    expect(row).toEqual(['n505', 'n487', 'n486', 'n526', 'n513', 'n518', 'n479']);
  });
});
