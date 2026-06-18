// SPDX-License-Identifier: EPL-2.0

/**
 * Order-signature regression for the mincross transpose-perf fixes
 * (mincross-transpose-perf mission, AD-1 #2).
 *
 * Guards the two faithful-port corrections that close the tests/2471.dot
 * transpose hang while keeping node order byte-identical to C:
 *  - buildRanksFlip: reverse each rank via exchange() (mincross.c:1293) so
 *    RL/flip + multi-component (vStart>0) passes do not corrupt orders.
 *  - mergeRanksInstall: alias the cluster vlist into the root array + vStart
 *    (merge_ranks) instead of a detached .slice copy, so cluster transpose
 *    swaps persist and converge.
 *
 * The graph is RL (flip) with two clusters whose ranks hold multiple real
 * nodes and mutual crossings — the exact paths the fixes touch. The expected
 * per-rank left-to-right order was captured from the native C `dot` oracle
 * (graphviz 15.x) and must stay byte-identical. A regression in either fix
 * reorders these ranks or fails to converge.
 *
 * @see lib/dotgen/mincross.c:build_ranks, lib/dotgen/cluster.c:merge_ranks
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

const RL_TWO_CLUSTER =
  'digraph { rankdir=RL; node [shape=box,width=0.5,height=0.4,fixedsize=true]; ' +
  'subgraph cluster_0 { a0;a1;a2;a3;a4;a5; a0->a2; a0->a3; a1->a2; a1->a3; ' +
  'a2->a4; a2->a5; a3->a4; a3->a5; } ' +
  'subgraph cluster_1 { b0;b1;b2;b3; b0->b2; b0->b3; b1->b2; b1->b3; } ' +
  'a4->b0; a5->b1; a4->b1; a5->b0; }';

/** C oracle (native dot) per-rank L-to-R node order — the parity baseline. */
const C_ORDER: string[][] = [
  ['b3', 'b2'],
  ['b1', 'b0'],
  ['a5', 'a4'],
  ['a3', 'a2'],
  ['a1', 'a0'],
];

const avg = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;

// [name, x, y] for each SVG node (tuple returns avoid object-type braces that
// confuse the complexity hook's brace counter).
type NodeXY = [string, number, number];

function polyCenter(points: string): [number, number] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const pair of points.trim().split(new RegExp('\\s+'))) {
    const [x, y] = pair.split(',').map(Number);
    if (!Number.isNaN(x!) && !Number.isNaN(y!)) { xs.push(x!); ys.push(y!); }
  }
  return [avg(xs), avg(ys)];
}

const NODE_RE = new RegExp('<g id="[^"]*" class="node">([\\s\\S]*?)</g>', 'g');
const TITLE_RE = new RegExp('<title>([\\s\\S]*?)</title>');
const PTS_RE = new RegExp('points="([^"]+)"');

function nodeCenters(svg: string): NodeXY[] {
  const out: NodeXY[] = [];
  NODE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NODE_RE.exec(svg))) {
    const body = m[1]!;
    const tm = TITLE_RE.exec(body);
    const pts = PTS_RE.exec(body);
    if (!tm || !pts) continue;
    const [cx, cy] = polyCenter(pts[1]!);
    out.push([tm[1]!, cx, cy]);
  }
  return out;
}

// RL: ranks run along x; within-rank order is by y. Uniform fixed-size nodes
// share an exact rank x, so bucketing by x is reliable.
function perRankOrder(svg: string): string[][] {
  const nodes = nodeCenters(svg).sort((p, q) => p[1] - q[1]);
  const ranks: NodeXY[][] = [];
  let curX = Number.NaN;
  for (const n of nodes) {
    if (ranks.length === 0 || Math.abs(n[1] - curX) > 5) { ranks.push([]); curX = n[1]; }
    ranks[ranks.length - 1]!.push(n);
  }
  return ranks.map((r) => r.sort((p, q) => p[2] - q[2]).map((n) => n[0]));
}

describe('mincross cluster order parity (transpose-perf fixes)', () => {
  it('RL two-cluster graph: per-rank order is byte-identical to C', () => {
    const svg = renderSvg(RL_TWO_CLUSTER, 'dot');
    expect(perRankOrder(svg)).toEqual(C_ORDER);
  });
});
