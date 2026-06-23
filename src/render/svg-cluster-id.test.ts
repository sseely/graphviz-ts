// SPDX-License-Identifier: EPL-2.0

/**
 * Cluster SVG `@id` AGSEQ numbering — acceptance tests for T2.
 *
 * Cluster ids come from getObjId (emit.c:230): `clust<AGSEQ(subgraph)>`, where
 * AGSEQ is the root-level subgraph creation counter (graph.c:152), counting
 * anonymous subgraphs in source order. When anonymous subgraphs interleave
 * between clusters, the dense `job.clusterId++` the port previously used
 * diverges from the oracle — `nestedclust` is the canonical example.
 *
 * Oracle values confirmed against native `dot -Tsvg`.
 *
 * @see lib/common/emit.c:getObjId
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../index.js';

/** Cluster group ids in document order: `<g id="clustN" class="cluster">`. */
function clusterIds(svg: string): string[] {
  const ids: string[] = [];
  const re = /<g id="([^"]*)" class="cluster([^"]*)">/g;
  for (let m = re.exec(svg); m !== null; m = re.exec(svg)) ids.push(m[1]!);
  return ids;
}

describe('cluster SVG ids use AGSEQ seq', () => {
  // Anon subgraphs interleave: oracle clust2, clust6, clust7 (not 1,2,3).
  const nestedclust =
    'digraph G {' +
    ' subgraph {e->f subgraph cluster_ss81 {a->b->c}};' +
    ' subgraph { subgraph { subgraph { subgraph cluster_x {' +
    '   x; subgraph cluster_y {y }}}}}' +
    '}';

  it('nestedclust → clust2, clust6, clust7', () => {
    expect(clusterIds(renderSvg(nestedclust, 'dot'))).toEqual([
      'clust2',
      'clust6',
      'clust7',
    ]);
  });

  it('two clusters with no anon interleave → clust1, clust2 (unchanged)', () => {
    const svg = renderSvg(
      'digraph G { subgraph cluster_0 {a} subgraph cluster_1 {b} }',
      'dot',
    );
    expect(clusterIds(svg)).toEqual(['clust1', 'clust2']);
  });

  it('explicit DOT id="foo" overrides the seq fallback', () => {
    const svg = renderSvg(
      'digraph G { subgraph cluster_0 { id="foo"; a } }',
      'dot',
    );
    expect(clusterIds(svg)).toEqual(['foo']);
  });
});
