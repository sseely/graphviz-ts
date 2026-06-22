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
import { Edge } from '../../model/edge.js';
import { markClusters, markClusterNode } from './cluster.js';
import { CLUSTER } from './rank.js';
import { parse } from '../../parser/index.js';
import { renderSvg } from '../../index.js';
import { dotLayoutEntry } from './index.js';

// 1767.dot: overlapping clusters — a,c declared in cluster_0 then referenced in
// cluster_1; f declared in cluster_1 then referenced in cluster_2/3. Node belongs
// to the FIRST cluster (C mark_clusters agdelete drops it from later ones).
const DOT_1767 = `digraph clusters {
  subgraph cluster_0 { a -> b -> c -> d -> e }
  subgraph cluster_1 { a -> f -> c }
  subgraph cluster_2 { rank=same; p1; p2; p3->f }
  subgraph cluster_3 { rank=same; S1->a; S2->f; S3->p1 }
}`;

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

/** Root with two clusters that both list node `shared` (first cluster wins). */
function twoClusterOverlap(): Graph {
  const g = new Graph('root', 'directed');
  const mk = (name: string, parent: Graph): Node => {
    const n = new Node(g.nodes.size, name, g);
    parent.nodes.set(name, n);
    g.nodes.set(name, n);
    return n;
  };
  const c0 = new Graph('cluster0', 'directed');
  const c1 = new Graph('cluster1', 'directed');
  for (const c of [c0, c1]) { c.parent = g; c.root = g; }
  const own0 = mk('own0', c0);
  const shared = mk('shared', c0); // first appears in cluster0
  c1.nodes.set('shared', shared);  // also listed in cluster1
  const own1 = mk('own1', c1);
  c0.info.leader = own0;
  c1.info.leader = own1;
  g.info.n_cluster = 2;
  g.info.clust = [c0, c1];
  return g;
}

describe('markClusters — first-cluster-wins (C agdelete)', () => {
  it('removes an already-claimed node from the later cluster node set', () => {
    const g = twoClusterOverlap();
    const [c0, c1] = [g.info.clust![0], g.info.clust![1]];
    expect(c1.nodes.has('shared')).toBe(true); // before: leaked into cluster1
    markClusters(g);
    // cluster0 claims `shared`; cluster1 must drop it (mirror agdelete(clust,n)).
    expect(c0.nodes.has('shared')).toBe(true);
    expect(c1.nodes.has('shared')).toBe(false);
    expect(g.nodes.get('shared')!.info.clust).toBe(c0); // still in root, owned by c0
  });
});

describe('markClusterNode — agdelete also drops incident edges (1332 defect C)', () => {
  it('removes a foreign node AND its induced edge from the cluster edge set', () => {
    // node_induce pulls a root edge whose endpoints are transient cluster
    // members into clust.edges. When the node is later dropped (first-cluster-
    // wins), C's agdelnode removes the incident edge too; node-only delete
    // leaves the edge behind, so agContainsEdge() reports it internal and
    // interclexp skips it, orphaning the intercluster chain (1332 mapPath crash).
    const g = new Graph('root', 'directed');
    const clust = new Graph('cluster1', 'directed');
    clust.parent = g;
    clust.root = g;
    const foreign = new Node(0, 'a', g); // claimed by an earlier sibling cluster
    const inside = new Node(1, 'b', g);
    foreign.info.ranktype = CLUSTER;       // already claimed → must be dropped
    const crossing = new Edge(foreign, inside, '');
    clust.nodes.set('a', foreign);
    clust.nodes.set('b', inside);
    clust.edges.push(crossing);            // induced into the cluster edge set
    clust.info.leader = inside;

    markClusterNode(clust, foreign);

    expect(clust.nodes.has('a')).toBe(false);
    expect(clust.edges.includes(crossing)).toBe(false); // edge dropped with node
    expect(clust.nodes.has('b')).toBe(true);            // owned node untouched
  });
});

describe('build_skeleton — overlapping clusters (1767, RC3 membership+rl)', () => {
  it('lays out 1767 with owned-only cluster node sets (matches native C)', () => {
    const g = parse(DOT_1767);
    dotLayoutEntry(g);
    const byName = (n: string) =>
      [...(g.info.clust ?? [])].find((c) => c.name === n)!;
    const keys = (n: string) => [...byName(n).nodes.keys()].sort();
    expect(keys('cluster_1')).toEqual(['f']);          // a,c belong to cluster_0
    expect(keys('cluster_2')).toEqual(['p1', 'p2', 'p3']); // f belongs to cluster_1
  });

  it('renders 1767 to SVG (was undefined-info crash in build_skeleton)', () => {
    expect(() => renderSvg(DOT_1767, 'dot')).not.toThrow();
  });
});
