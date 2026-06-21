// SPDX-License-Identifier: EPL-2.0

/**
 * Edge port/compass wiring: DOT syntax `A:port:compass` lands in the edge's
 * tailport/headport attrs (the C path: mkport sets the attr, common_init_edge
 * reads it). Explicit headport=/tailport= attrs win over DOT syntax.
 *
 * @see lib/cgraph/grammar.y:396 (mkport)
 * @see lib/common/utils.c:common_init_edge (port block)
 */

import { describe, it, expect } from 'vitest';
import { parse } from './index.js';
import { nodeAttr } from '../common/poly-init.js';

function firstEdge(src: string) {
  return parse(src).edges[0]!;
}

describe('edge port/compass → tailport/headport attrs', () => {
  it('A:s -> B:n sets tailport="s", headport="n"', () => {
    const e = firstEdge('digraph { A:s -> B:n; }');
    expect(e.attrs.get('tailport')).toBe('s');
    expect(e.attrs.get('headport')).toBe('n');
  });

  it('A:f0:ne -> B sets tailport="f0:ne" (port:compass joined)', () => {
    const e = firstEdge('digraph { A:f0:ne -> B; }');
    expect(e.attrs.get('tailport')).toBe('f0:ne');
    expect(e.attrs.get('headport')).toBeUndefined();
  });

  it('no port syntax leaves tailport/headport unset', () => {
    const e = firstEdge('digraph { A -> B; }');
    expect(e.attrs.get('tailport')).toBeUndefined();
    expect(e.attrs.get('headport')).toBeUndefined();
  });

  it('explicit tailport= attr wins over DOT syntax', () => {
    const e = firstEdge('digraph { A:s -> B [tailport="e"]; }');
    expect(e.attrs.get('tailport')).toBe('e');
  });

  it('explicit tailport= attr alone is preserved', () => {
    const e = firstEdge('digraph { A -> B [tailport="e"]; }');
    expect(e.attrs.get('tailport')).toBe('e');
  });
});

// A `node [...]` default set inside a subgraph applies to nodes declared there,
// resolved by walking the node's declaring subgraph up to root. @see nodeAttr
describe('subgraph-scoped node-attribute defaults', () => {
  it('records the declaring subgraph on nodes created via an edge stmt', () => {
    const g = parse('digraph{subgraph cluster_0{node[style=filled];a->b}}');
    const a = g.nodes.get('a')!;
    expect(a.subg).toBe(g.subgraphs.get('cluster_0'));
    expect(nodeAttr(a, g, 'style')).toBe('filled');
  });

  it('inner subgraph default overrides the root default', () => {
    const g = parse(
      'digraph{node[color=black];subgraph cluster_0{node[color=white];a->b}}');
    expect(nodeAttr(g.nodes.get('a')!, g, 'color')).toBe('white');
  });

  it('a node at root scope ignores a cluster-only default', () => {
    const g = parse('digraph{subgraph cluster_0{node[style=filled];a}b}');
    expect(g.nodes.get('b')!.subg).toBeUndefined();
    expect(nodeAttr(g.nodes.get('b')!, g, 'style')).toBeUndefined();
  });

  it("an explicit node attr still wins over the subgraph default", () => {
    const g = parse(
      'digraph{subgraph cluster_0{node[shape=box];a[shape=ellipse]}}');
    expect(nodeAttr(g.nodes.get('a')!, g, 'shape')).toBe('ellipse');
  });
});
