// SPDX-License-Identifier: EPL-2.0
/**
 * vStart-window regression tests for mincross-order.ts.
 *
 * C reads the already-offset window pointer GD_rank(g)[r].v (advanced by
 * init_mccomp, aliased by merge_ranks). TS keeps rk.v as the full root array
 * plus a separate vStart, so medians/reorder must read rk.v[vStart+i] and
 * iterate the absolute window [vStart, vStart+n). Before this fix they looped
 * rk.v[0..n) and processed the wrong nodes on any windowed (multi-component or
 * clustered) rank — leaving stale mval on the unreached tail.
 * @see lib/dotgen/mincross.c:medians, lib/dotgen/mincross.c:reorder
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { fastEdge } from './fastgr.js';
import { medians, reorderInner } from './mincross-order.js';
import type { MincrossContext } from './mincross-utils.js';
import type { RankEntry } from '../../model/rankEntry.js';

function makeCtx(root: Graph): MincrossContext {
  return {
    root,
    globalMinRank: root.info.minrank ?? 0,
    globalMaxRank: root.info.maxrank ?? 0,
    teList: [], tiList: [],
    reMincross: false, minQuit: 8, maxIter: 24,
  };
}

function makeNode(g: Graph, id: number, name = `n${id}`): Node {
  const n = new Node(id, name, g);
  g.nodes.set(n.name, n);
  return n;
}

function makeEdge(tail: Node, head: Node): Edge {
  const e = new Edge(tail, head, '');
  fastEdge(e);
  return e;
}

function makeRankEntry(nodes: Node[], n?: number): RankEntry {
  return {
    n: n ?? nodes.length,
    v: nodes,
    an: nodes.length,
    av: nodes,
    ht1: 0, ht2: 0, pht1: 0, pht2: 0,
    candidate: false, valid: false, cache_nc: 0,
  };
}

function mkPort() {
  return {
    p: { x: 0, y: 0 }, theta: 0, bp: null, defined: false,
    constrained: false, clip: false, dyna: false, order: 0, side: 0, name: '',
  };
}

// medians on a windowed rank (vStart>0) must process only rk.v[vStart..vStart+n)
// — the decoy before the window stays untouched. Before the fix medians looped
// rk.v[0..n) and recomputed the decoy instead of the real window node.
describe('medians: respects vStart window', () => {
  it('processes the offset node and leaves the pre-window decoy untouched', () => {
    const root = new Graph('root', 'directed');
    root.info.minrank = 0; root.info.maxrank = 0;
    const g = new Graph('g', 'directed');
    const ctx = makeCtx(root);
    const decoy = makeNode(g, 0, 'decoy');
    decoy.info.rank = 0;
    decoy.info.mval = 999; // sentinel: must NOT be recomputed
    const real = makeNode(g, 1, 'real');
    real.info.rank = 0;
    const m = makeNode(g, 2, 'm');
    m.info.rank = 1; m.info.order = 0;
    const e = makeEdge(real, m);
    e.info.xpenalty = 1;
    e.info.head_port = mkPort();
    real.info.out = { list: [e], size: 1 };
    const rk = makeRankEntry([decoy, real], 1); // n=1, window = [real]
    rk.vStart = 1;
    g.info.rank = [rk];
    expect(medians(ctx, g, 0, 1)).toBe(false);
    expect(real.info.mval).toBe(0);    // window node computed
    expect(decoy.info.mval).toBe(999); // decoy untouched
  });
});

// reorderInner with a non-zero window start swaps only within [start, ep) and
// never touches the node before the window.
describe('reorderInner: respects vStart window', () => {
  it('swaps within the window and leaves the pre-window node fixed', () => {
    const root = new Graph('root', 'directed');
    root.info.minrank = 0; root.info.maxrank = 0;
    const g = new Graph('g', 'directed');
    const ctx = makeCtx(root);

    const fixed = makeNode(g, 0, 'fixed');
    const a = makeNode(g, 1, 'a');
    const b = makeNode(g, 2, 'b');
    fixed.info.rank = 0; a.info.rank = 0; b.info.rank = 0;
    fixed.info.order = 0; a.info.order = 1; b.info.order = 2;
    a.info.mval = 3; b.info.mval = 1; // a (left) > b (right) -> swap

    const vlist = [fixed, a, b];
    root.info.rank = [makeRankEntry([fixed, a, b])];

    const changed = reorderInner(ctx, g, vlist, { start: 1, ep: 3 }, false);
    expect(changed).toBe(true);
    expect(a.info.order).toBe(2);     // a moved right
    expect(b.info.order).toBe(1);     // b moved left
    expect(fixed.info.order).toBe(0); // untouched
  });
});
