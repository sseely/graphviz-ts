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

// A `node [...]` default is snapshot onto each node at creation, in statement
// order — from the declaring subgraph up to root. @see effectiveNodeDefaults
describe('subgraph-scoped node-attribute defaults', () => {
  it('a subgraph node default reaches nodes created via an edge stmt', () => {
    const g = parse('digraph{subgraph cluster_0{node[style=filled];a->b}}');
    expect(nodeAttr(g.nodes.get('a')!, g, 'style')).toBe('filled');
  });

  it('inner subgraph default overrides the root default', () => {
    const g = parse(
      'digraph{node[color=black];subgraph cluster_0{node[color=white];a->b}}');
    expect(nodeAttr(g.nodes.get('a')!, g, 'color')).toBe('white');
  });

  it('a node at root scope ignores a cluster-only default', () => {
    const g = parse('digraph{subgraph cluster_0{node[style=filled];a}b}');
    expect(nodeAttr(g.nodes.get('b')!, g, 'style')).toBeUndefined();
  });

  it("an explicit node attr still wins over the subgraph default", () => {
    const g = parse(
      'digraph{subgraph cluster_0{node[shape=box];a[shape=ellipse]}}');
    expect(nodeAttr(g.nodes.get('a')!, g, 'shape')).toBe('ellipse');
  });

  it('a node[...] declared after a node does not apply to it (snapshot order)', () => {
    const g = parse('digraph{a;node[shape=box];b}');
    expect(nodeAttr(g.nodes.get('a')!, g, 'shape')).toBeUndefined(); // default
    expect(nodeAttr(g.nodes.get('b')!, g, 'shape')).toBe('box');
  });
});

// edge[...] defaults are snapshot onto each edge at creation, in statement
// order, so a later edge[color=...] in the same scope only affects subsequent
// edges. Edges read attrs from their own map only. @see snapshotEdgeDefaults
describe('edge-attribute defaults snapshot at creation', () => {
  it('root edge[color=red] colors all edges', () => {
    const g = parse('digraph{edge[color=red];a->b;c->d}');
    expect(g.edges.every((e) => e.attrs.get('color') === 'red')).toBe(true);
  });

  it('a re-declared edge default only affects edges created after it', () => {
    const g = parse('digraph{edge[color=red];a->b;edge[color=blue];c->d}');
    const byTail = (t: string) => g.edges.find((e) => e.tail.name === t)!;
    expect(byTail('a').attrs.get('color')).toBe('red');
    expect(byTail('c').attrs.get('color')).toBe('blue');
  });

  it('subgraph edge default overrides the root default; explicit attr wins', () => {
    const g = parse(
      'digraph{edge[color=red];subgraph c0{edge[color=green];a->b;x->y[color=blue]}}');
    const byTail = (t: string) => g.edges.find((e) => e.tail.name === t)!;
    expect(byTail('a').attrs.get('color')).toBe('green'); // inherited subgraph
    expect(byTail('x').attrs.get('color')).toBe('blue');  // explicit wins
  });
});
