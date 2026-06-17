// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for markClusters' NORMAL-default guard (cluster.c:317 port).
 * C's ND_ranktype is a calloc-zeroed char (NORMAL==0); TS NodeInfo.ranktype is
 * optional (undefined by default). The guard must treat undefined as NORMAL,
 * else cross-cluster rank=same nodes under newrank never get ND_clust and are
 * double-installed (furthestNode hang). @see docs/newrank-c-trace.md
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { markClusters } from './cluster.js';
import { CLUSTER } from './rank.js';

function clusterGraph(): [Graph, Node] {
  const g = new Graph('root', 'directed');
  const clust = new Graph('cluster0', 'directed');
  clust.parent = g;
  clust.root = g;
  const leader = new Node(0, 'lead', g);
  const member = new Node(1, 'c', g); // ranktype left undefined (NORMAL in C)
  for (const n of [leader, member]) {
    clust.nodes.set(n.name, n);
    g.nodes.set(n.name, n);
  }
  clust.info.leader = leader;
  g.info.n_cluster = 1;
  g.info.clust = [clust];
  return [g, member];
}

describe('markClusters — undefined ranktype counts as NORMAL', () => {
  it('assigns ND_clust to a member whose ranktype is undefined', () => {
    const [g, member] = clusterGraph();
    expect(member.info.ranktype).toBeUndefined();
    markClusters(g);
    // Before the fix the `!= 0` guard skipped undefined-ranktype nodes, so
    // clust stayed unset; the fix coerces undefined→NORMAL and processes it.
    expect(member.info.clust).toBe(g.info.clust![0]);
    expect(member.info.ranktype).toBe(CLUSTER);
  });
});
