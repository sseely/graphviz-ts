// SPDX-License-Identifier: EPL-2.0
/**
 * vStart-window regression tests for keepout_othernodes in position-cluster.ts.
 *
 * C reads v = GD_rank(g)[r].v[0], the cluster's leftmost node, from the
 * already-offset window pointer. TS keeps rk.v as the full root array plus a
 * separate vStart, so v0 must be read via rankGet(rk, 0); a raw rk.v[0] returns
 * the ROOT's leftmost node (order ~0), which collapses the left-side scan
 * `for (i = order(v0) - 1; i >= 0; i--)` to nothing and mis-bounds the
 * right-side scan. On tests/2475_2.dot (805 clusters) this dropped 6905 of the
 * 13924 keepout aux edges — the exact gap that made the x-coord network simplex
 * do 34434 pivots instead of native's 8748.
 * @see lib/dotgen/position.c:keepout_othernodes
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { NORMAL } from './fastgr.js';
import type { RankEntry } from '../../model/rankEntry.js';
import { keepoutLeft, keepoutRight } from './position-cluster.js';

function mkNode(g: Graph, id: number, order: number, name = `n${id}`): Node {
  const n = new Node(id, name, g);
  n.info = makeNodeInfo();
  n.info.node_type = NORMAL;
  n.info.order = order;
  n.info.rw = 5;
  n.info.lw = 5;
  g.nodes.set(n.name, n);
  return n;
}

function mkRank(nodes: Node[], n: number, vStart: number): RankEntry {
  return {
    n, v: nodes, an: nodes.length, av: nodes,
    ht1: 0, ht2: 0, pht1: 0, pht2: 0,
    candidate: false, valid: false, cache_nc: 0,
    vStart,
  };
}

const MARGIN = 8;

// Root rank order: [leftNormal, cLeft, cRight, rightNormal]. The cluster g owns
// only the middle two via a vStart=1 window of length 2. keepout must therefore
// constrain leftNormal (just left of the window) and rightNormal (just right).
function setup(): { root: Graph; g: Graph; leftNormal: Node; rightNormal: Node; cLeft: Node; cRight: Node } {
  const root = new Graph('root', 'directed');
  root.info.minrank = 0;
  root.info.maxrank = 0;
  const leftNormal = mkNode(root, 0, 0, 'leftNormal');
  const cLeft = mkNode(root, 1, 1, 'cLeft');
  const cRight = mkNode(root, 2, 2, 'cRight');
  const rightNormal = mkNode(root, 3, 3, 'rightNormal');
  const vlist = [leftNormal, cLeft, cRight, rightNormal];
  root.info.rank = [mkRank(vlist, 4, 0)];

  const g = new Graph('clust', 'directed');
  g.info.minrank = 0;
  g.info.maxrank = 0;
  g.info.rank = [mkRank(vlist, 2, 1)]; // window = [cLeft, cRight]
  const ln = mkNode(root, 100, -1, 'ln');
  const rn = mkNode(root, 101, -1, 'rn');
  g.info.ln = ln;
  g.info.rn = rn;
  return { root, g, leftNormal, rightNormal, cLeft, cRight };
}

describe('keepoutLeft: respects vStart window (cluster-local v0)', () => {
  it('constrains the normal node just left of the cluster window', () => {
    const { root, g, leftNormal } = setup();
    keepoutLeft(root, g, 0, MARGIN);
    // C: make_aux_edge(leftNormal, GD_ln(g), margin + rw(leftNormal), 0).
    const ln = g.info.ln!;
    expect(ln.info.in?.size).toBe(1);
    const e = ln.info.in!.list[0];
    expect(e.tail).toBe(leftNormal);
    expect(e.info.minlen).toBe(MARGIN + 5); // margin + ND_rw(leftNormal)
  });

  it('makes no left edge when v0 is read raw (pre-fix bug would skip it)', () => {
    // With the raw rk.v[0] bug, v0 = leftNormal (order 0) so the scan
    // `for i = -1` never runs and ln gets no incoming keepout edge. This test
    // would fail against that bug; it passes once v0 = rankGet(rk, 0) = cLeft.
    const { root, g, leftNormal } = setup();
    keepoutLeft(root, g, 0, MARGIN);
    expect(g.info.ln!.info.in!.list[0].tail).toBe(leftNormal);
  });
});

describe('keepoutRight: respects vStart window (cluster-local v0)', () => {
  it('constrains the normal node just right of the cluster window', () => {
    const { root, g, rightNormal, cRight } = setup();
    keepoutRight(root, g, 0, MARGIN);
    // C: make_aux_edge(GD_rn(g), rightNormal, margin + lw(rightNormal), 0).
    const rn = g.info.rn!;
    expect(rn.info.out?.size).toBe(1);
    const e = rn.info.out!.list[0];
    expect(e.head).toBe(rightNormal);
    expect(e.head).not.toBe(cRight); // raw-v[0] bug would target the wrong node
    expect(e.info.minlen).toBe(MARGIN + 5); // margin + ND_lw(rightNormal)
  });
});
