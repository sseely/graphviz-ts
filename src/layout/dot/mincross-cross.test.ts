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
  shouldSwap, transposeCounts, left2rightCluster, setReMincross,
} from './mincross-cross.js';
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

/** Node carrying a single in-edge whose tail sits at `srcOrder`. */
function inNode(srcOrder: number): Node {
  const e = { tail: { info: { order: srcOrder } }, info: { tail_port: { order: 0 } } } as unknown as Edge;
  return { info: { in: { list: [e], size: 1 }, out: undefined } } as unknown as Node;
}

describe('transposeCounts', () => {
  it('counts c0 (current) when v sources right of w, c1 (swapped) otherwise', () => {
    // v's in-edge from order 5, w's from order 2: cross in current order (c0=1).
    expect(transposeCounts(inNode(5), inNode(2))).toEqual([1, 0]);
    // reversed sources: cross only if swapped (c1=1).
    expect(transposeCounts(inNode(2), inNode(5))).toEqual([0, 1]);
    // equal source order: no crossing either way.
    expect(transposeCounts(inNode(4), inNode(4))).toEqual([0, 0]);
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
