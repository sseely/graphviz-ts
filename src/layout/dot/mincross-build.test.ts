// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for fillRanks / realFillRanks — the NEW_RANK placeholder-rank pass.
 * @see lib/dotgen/mincross.c:fillRanks (1013), realFillRanks (976)
 */

import { it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { agnode, agsubg, agsubnode } from '../../model/cgraph-ops.js';
import { fillRanks } from './mincross-build.js';

/** Add a cluster to `root` whose member nodes occupy `clusterRanks`. */
function addCluster(root: Graph, name: string, clusterRanks: number[]): Graph {
  const cluster = agsubg(root, name, true)!;
  cluster.info.minrank = 0;
  cluster.info.maxrank = 2;
  for (const r of clusterRanks) {
    const n = agnode(cluster, `${name}_n${r}`, true)!;
    agsubnode(cluster, n, true);
    n.info.rank = r;
  }
  return cluster;
}

/** Build a root + clusters with rank range [0,2] and wired n_cluster/clust. */
function buildGraph(clusterRanks: number[][]): { root: Graph; clusters: Graph[] } {
  const root = new Graph('root', 'directed');
  const clusters = clusterRanks.map((ranks, i) =>
    addCluster(root, `cluster_${i}`, ranks),
  );
  root.info.minrank = 0;
  root.info.maxrank = 2;
  root.info.n_cluster = clusters.length;
  root.info.clust = clusters; // 0-indexed: clust[0] is C's clust[1]
  return { root, clusters };
}

it('inserts one placeholder into a single empty rank', () => {
  // Cluster occupies ranks {0, 2}; rank 1 is empty.
  const { root, clusters } = buildGraph([[0, 2]]);
  const cluster = clusters[0];

  fillRanks(root);

  const sg = agsubg(root, '_new_rank', false);
  expect(sg).not.toBeNull();

  const placeholders = [...sg!.nodes.values()];
  expect(placeholders).toHaveLength(1);

  const fill = placeholders[0];
  expect(fill.info.rank).toBe(1);
  expect(fill.info.lw).toBe(0.5);
  expect(fill.info.rw).toBe(0.5);
  expect(fill.info.ht).toBe(1);
  expect(fill.info.UF_size).toBe(1);
  expect(fill.info.in).toEqual({ list: [], size: 0 });
  expect(fill.info.out).toEqual({ list: [], size: 0 });

  // Member of _new_rank, the cluster, and root.
  expect(sg!.nodes.get(fill.name)).toBe(fill);
  expect(cluster.nodes.get(fill.name)).toBe(fill);
  expect(root.nodes.get(fill.name)).toBe(fill);
});

it('creates no _new_rank subgraph when there are no rank gaps', () => {
  const { root, clusters } = buildGraph([[0, 1, 2]]);
  const before = clusters[0].nodes.size;

  fillRanks(root);

  expect(agsubg(root, '_new_rank', false)).toBeNull();
  expect(clusters[0].nodes.size).toBe(before);
});

it('creates two distinct placeholders for two clusters sharing a gap rank', () => {
  // Two clusters each occupy {0, 2} → both have a gap at rank 1.
  const { root, clusters } = buildGraph([[0, 2], [0, 2]]);
  const [a, b] = clusters;

  fillRanks(root);

  const sg = agsubg(root, '_new_rank', false);
  expect(sg).not.toBeNull();

  const fills = [...sg!.nodes.values()];
  expect(fills).toHaveLength(2);
  expect(fills.every((n) => n.info.rank === 1)).toBe(true);

  const names = new Set(fills.map((n) => n.name));
  expect(names.size).toBe(2); // distinct names via seq uniqueness

  // One placeholder lands in each cluster.
  const inA = fills.filter((n) => a.nodes.get(n.name) === n);
  const inB = fills.filter((n) => b.nodes.get(n.name) === n);
  expect(inA).toHaveLength(1);
  expect(inB).toHaveLength(1);
  expect(inA[0]).not.toBe(inB[0]);
});
