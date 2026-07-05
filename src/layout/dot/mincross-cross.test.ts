// SPDX-License-Identifier: EPL-2.0

/**
 * Unit tests for the transpose swap decision (mincross-c-parity Batch 1).
 *
 * shouldSwap was the inverted-reverse bug: the TS swapped on `cross < 0`,
 * but C swaps on `c1 < c0 || (c0 > 0 && reverse && c1 == c0)`.
 * @see lib/dotgen/mincross.c:transpose_step
 */

import { describe, it, expect } from 'vitest';
import {
  shouldSwap, transposeCounts, left2rightCluster, left2right, setReMincross,
} from './mincross-cross.js';
import { newMatrix, matrixSet } from './mincross-utils.js';
import { CLUSTER } from './rank.js';
import { VIRTUAL } from './fastgr.js';
import type { Node } from '../../model/node.js';
import type { Graph } from '../../model/graph.js';
import type { Edge } from '../../model/edge.js';

describe('shouldSwap — forward', () => {
  it('swaps only on strict improvement (c1 < c0)', () => {
    expect(shouldSwap(5, 3, false)).toBe(true);
    expect(shouldSwap(3, 3, false)).toBe(false); // tie: no swap forward
    expect(shouldSwap(3, 5, false)).toBe(false); // worse
    expect(shouldSwap(0, 0, false)).toBe(false);
  });
});

describe('shouldSwap — reverse', () => {
  it('swaps on improvement, and on a tie only when crossings exist', () => {
    expect(shouldSwap(5, 3, true)).toBe(true); // improvement
    expect(shouldSwap(3, 3, true)).toBe(true); // tie with crossings → swap
    expect(shouldSwap(0, 0, true)).toBe(false); // tie, no crossings → no swap
    expect(shouldSwap(3, 5, true)).toBe(false); // worse: never swap
  });
});

/** Node carrying a single in-edge whose tail sits at `srcOrder`. The tail_port
 *  carries a complete `p` (every real Port has one — geom.ts:87) so the
 *  ND_order-then-p.x compare in accumCross can read `p.x`. p.x is 0 here, so the
 *  ND_order term (srcOrder) drives the result, which is what this test pins. */
function inNode(srcOrder: number): Node {
  const e = { tail: { info: { order: srcOrder } }, info: { tail_port: { order: 0, p: { x: 0, y: 0 } } } } as unknown as Edge;
  return { info: { in: { list: [e], size: 1 }, out: undefined } } as unknown as Node;
}

/** Node carrying a single out-edge whose head sits at `dstOrder`. Mirrors
 *  `inNode` but for the head-endpoint (out-edge) side of accumCross. */
function outNode(dstOrder: number): Node {
  const e = { head: { info: { order: dstOrder } }, info: { head_port: { order: 0, p: { x: 0, y: 0 } } } } as unknown as Edge;
  return { info: { out: { list: [e], size: 1 }, in: undefined } } as unknown as Node;
}

describe('transposeCounts', () => {
  it('counts c0 (current) when v sources right of w, c1 (swapped) otherwise', () => {
    // v's in-edge from order 5, w's from order 2: cross in current order (c0=1).
    expect(transposeCounts(inNode(5), inNode(2), true, true)).toEqual([1, 0]);
    // reversed sources: cross only if swapped (c1=1).
    expect(transposeCounts(inNode(2), inNode(5), true, true)).toEqual([0, 1]);
    // equal source order: no crossing either way.
    expect(transposeCounts(inNode(4), inNode(4), true, true)).toEqual([0, 0]);
  });

  // C transpose_step (mincross.c:646-652) gates: in_cross only added when
  // r > 0, out_cross only added when the next rank's calloc'd n > 0 (the
  // over-allocated maxrank+2 slot reads n == 0 past a cluster's bottom
  // rank). transposeCounts must honor useIn/useOut exactly like those gates.
  it('ignores out-crossings when useOut=false (cluster bottom-rank gate)', () => {
    // Would cross (c0=1) if out-crossings were counted; gated off entirely.
    expect(transposeCounts(outNode(5), outNode(2), true, false)).toEqual([0, 0]);
  });

  it('ignores in-crossings when useIn=false (r === 0 gate)', () => {
    // Would cross (c0=1) if in-crossings were counted; gated off entirely.
    expect(transposeCounts(inNode(5), inNode(2), false, true)).toEqual([0, 0]);
  });
});

/** Node carrying cluster membership + optional ranktype/node_type. */
function clNode(clust: Graph | undefined, rt?: number, nt?: number): Node {
  return { info: { clust, ranktype: rt, node_type: nt } } as unknown as Node;
}

// C left2right cluster guard (mincross.c:557). Non-remincross forces ordering
// only for pairs whose nodes are BOTH in different clusters, releasing the pair
// when a cluster skeleton vnode sits on either side. The mc3 cluster-mincross
// hang came from the old agContainsNode port forcing (cluster, non-cluster)
// pairs and lacking the skeleton-vnode release.
const cA = {} as unknown as Graph;
const cB = {} as unknown as Graph;

describe('left2rightCluster — non-remincross', () => {
  it('forces two non-skeleton nodes in different clusters', () => {
    setReMincross(false);
    expect(left2rightCluster(clNode(cA), clNode(cB))).toBe(1);
  });

  it('releases the pair when either side is a cluster-skeleton vnode', () => {
    setReMincross(false);
    expect(left2rightCluster(clNode(cA, CLUSTER, VIRTUAL), clNode(cB))).toBe(0);
    expect(left2rightCluster(clNode(cA), clNode(cB, CLUSTER, VIRTUAL))).toBe(0);
  });

  it('does not force a (cluster, non-cluster) pair — the mc3 reorder swap', () => {
    setReMincross(false);
    expect(left2rightCluster(clNode(cA), clNode(undefined))).toBe(0);
    expect(left2rightCluster(clNode(undefined), clNode(cA))).toBe(0);
    expect(left2rightCluster(clNode(cA), clNode(cA))).toBe(0); // same cluster
  });
});

describe('left2rightCluster — remincross', () => {
  it('forces any cross-cluster pair, with no skeleton release', () => {
    setReMincross(true);
    expect(left2rightCluster(clNode(cA), clNode(cB))).toBe(1);
    expect(left2rightCluster(clNode(cA), clNode(undefined))).toBe(1);
    expect(left2rightCluster(clNode(cA, CLUSTER, VIRTUAL), clNode(cB))).toBe(1);
    setReMincross(false); // restore module global for other tests
  });
});

// C indexes the flat adjacency matrix by flatindex(v) = ND_low(v) (mincross.c:115,
// 578) and BUILDS it by `low` (mincross-flat.ts matrixSet hLow/vLow). The port's
// left2right formerly read it by `order - vStart`, which equals `low` only right
// after flatBreakcycles and drifts once a reorder pass mutates `order` — the b58
// FLATORDER 6->8 enforcement bug (pass-1 mincrossIter wrongly swapped 6,8).
/** Flat node at rank 0 with distinct low/order, no cluster. */
function flatNode(low: number, order: number): Node {
  return { info: { rank: 0, low, order, clust: undefined } } as unknown as Node;
}
/** Graph whose rank 0 carries a 3x3 flat matrix; vStart offsets order, not low.
 *  `flip` mirrors GD_flip(g): C swaps v,w before its single matrix_get. */
function flatGraph(vStart: number, flip = false): { g: Graph; setEdge: (a: number, b: number) => void } {
  const flat = newMatrix(3, 3);
  const g = { info: { rank: [{ flat, vStart, v: [], n: 0 }], flip } } as unknown as Graph;
  return { g, setEdge: (a, b) => matrixSet(flat, a, b) };
}

describe('left2right — flat matrix indexed by low, not order', () => {
  it('finds the 6->8 constraint by low even after order drifts (b58 regression)', () => {
    setReMincross(false);
    const { g, setEdge } = flatGraph(0);
    setEdge(1, 2); // M[low(6)=1][low(8)=2] = "6 must be left of 8"
    // Post-reorder state: 6.order=0, 8.order=1 — order != low. Reading by
    // order-vStart would look up M[0][1] (unset) and miss; reading by low hits.
    const six = flatNode(1, 0);
    const eight = flatNode(2, 1);
    expect(left2right(g, six, eight)).toBe(1);   // forced: 6 before 8
  });

  it('returns 0 when neither low-indexed direction is constrained', () => {
    setReMincross(false);
    const { g } = flatGraph(0); // empty matrix
    expect(left2right(g, flatNode(1, 0), flatNode(2, 1))).toBe(0);
  });

  it('ignores vStart for the matrix index (low is already window-local)', () => {
    setReMincross(false);
    const { g, setEdge } = flatGraph(5); // nonzero vStart must not shift the lookup
    setEdge(1, 2);
    expect(left2right(g, flatNode(1, 0), flatNode(2, 1))).toBe(1);
  });

  // C left2right reads exactly ONE matrix cell, matrix_get(flatindex(v),
  // flatindex(w)), with v,w pre-swapped iff GD_flip (mincross.c:575-578, bool).
  // The OPPOSITE-direction pair must read as 0 (no constraint). A prior port
  // read BOTH cells and returned -1 here, spuriously blocking a reorder swap and
  // shifting the captured best order on graphs-shells (rc/KornShell, rank 7).
  it('reads ONE direction: the reverse of a forward edge is unconstrained (shells)', () => {
    setReMincross(false);
    const { g, setEdge } = flatGraph(0);
    setEdge(1, 2); // edge low(1)->low(2): "node@low1 must be left of node@low2"
    const a = flatNode(1, 0);
    const b = flatNode(2, 1);
    expect(left2right(g, a, b)).toBe(1); // forward, constrained
    expect(left2right(g, b, a)).toBe(0); // reverse: NOT constrained (was -1 pre-fix)
  });

  it('GD_flip selects the reverse cell, mirroring C SWAP(v,w)', () => {
    setReMincross(false);
    const { g, setEdge } = flatGraph(0, /* flip */ true);
    setEdge(1, 2); // only the (1,2) cell is set
    const a = flatNode(1, 0);
    const b = flatNode(2, 1);
    // flip=true => C reads matrix_get(flatindex(w), flatindex(v)); so the
    // constrained pair is (b, a), reading cell (1,2); (a, b) reads (2,1) = unset.
    expect(left2right(g, b, a)).toBe(1);
    expect(left2right(g, a, b)).toBe(0);
  });
});
