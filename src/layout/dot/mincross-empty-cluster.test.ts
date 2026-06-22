// SPDX-License-Identifier: EPL-2.0

/**
 * D2 regression: a node referenced in several clusters is pruned to its first
 * cluster by mark_clusters agdelete (defect A), emptying the later clusters.
 * `merge_ranks` aliases each cluster's rank `v[]` into the shared root rank
 * array (vStart), so expanding an emptied cluster clobbered the slot a sibling
 * filled — the node was lost and `rank.v[0]` went null, crashing setYcoords.
 * `removeEmptyClusters` drops the emptied clusters (matching C, which installs
 * from the root node list and never draws an empty cluster).
 *
 * @see lib/dotgen/mincross.c:dot_mincross (empty-cluster removal)
 * @see plans/cluster-subsystem/README.md (defect D2)
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { removeEmptyClusters } from './mincross.js';
import { parse } from '../../parser/index.js';
import { renderSvg } from '../../index.js';

// tests/1221.dot and tests/2721.dot: one node shared by two clusters, no edges.
const DOT_1221 = `digraph G {
  graph [ newrank=true ];
  subgraph cluster_1 { 1; }
  subgraph cluster_2 { 1 }
}`;
const DOT_2721 = `digraph G {
  subgraph "cluster_std" { "622"; }
  subgraph "cluster_uni" { "622"; }
}`;

const count = (svg: string, re: RegExp): number => (svg.match(re) ?? []).length;
const clusters = (svg: string): number => count(svg, /class="cluster"/g);
const nodes = (svg: string): number => count(svg, /class="node"/g);

describe('removeEmptyClusters', () => {
  it('drops clusters with no member nodes and renumbers n_cluster', () => {
    const g = new Graph('root', 'directed');
    const full = new Graph('cfull', 'directed');
    full.nodes.set('a', new Node(0, 'a', g));
    const empty = new Graph('cempty', 'directed'); // no nodes
    g.info.clust = [full, empty];
    g.info.n_cluster = 2;
    removeEmptyClusters(g);
    expect(g.info.n_cluster).toBe(1);
    expect(g.info.clust).toEqual([full]);
  });

  it('keeps all clusters when none are empty', () => {
    const g = new Graph('root', 'directed');
    const c = new Graph('c', 'directed');
    c.nodes.set('a', new Node(0, 'a', g));
    g.info.clust = [c];
    g.info.n_cluster = 1;
    removeEmptyClusters(g);
    expect(g.info.n_cluster).toBe(1);
  });
});

describe('one node in two clusters renders (D2: 1221/2721)', () => {
  it('renders 1221-style to SVG with exactly one cluster + one node', () => {
    let svg = '';
    expect(() => { svg = renderSvg(DOT_1221, 'dot'); }).not.toThrow();
    expect(clusters(svg)).toBe(1); // empty cluster_2 dropped, matching C
    expect(nodes(svg)).toBe(1);
  });

  it('renders 2721-style to SVG (was timeout→crash before)', () => {
    let svg = '';
    expect(() => { svg = renderSvg(DOT_2721, 'dot'); }).not.toThrow();
    expect(clusters(svg)).toBe(1);
    expect(nodes(svg)).toBe(1);
  });

  it('still parses the shared node into both cluster subgraphs pre-layout', () => {
    // sanity: the dedup happens in layout (mark_clusters), not the parser.
    const g = parse(DOT_1221);
    expect(g.nodes.has('1')).toBe(true);
  });
});
