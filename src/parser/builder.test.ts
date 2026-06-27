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
import type { Graph } from '../model/graph.js';

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

// cgraph names anonymous subgraphs `%N` so siblings stay distinct. An empty
// name collides in graph.subgraphs (a Map), dropping all but the last — losing
// a cluster nested in an earlier anonymous block (nestedclust: cluster_ss81).
describe('anonymous subgraphs get distinct names', () => {
  it('keeps two sibling anonymous subgraphs (and their nested clusters)', () => {
    const g = parse('digraph{subgraph{e->f subgraph cluster_a{a}} subgraph{subgraph cluster_b{b}}}');
    expect(g.subgraphs.size).toBe(2);
    const sgs = [...g.subgraphs.values()];
    const nested = sgs.flatMap((s) => [...s.subgraphs.keys()]).sort();
    expect(nested).toEqual(['cluster_a', 'cluster_b']);
  });

  it('does not collide an anonymous subgraph with a named one', () => {
    const g = parse('digraph{subgraph{x} subgraph cluster_n{n}}');
    expect(g.subgraphs.size).toBe(2);
    expect(g.subgraphs.has('cluster_n')).toBe(true);
  });
});

// AGSEQ: cgraph assigns each subgraph a global sequence number from a root-level
// counter (clos->seq[AGRAPH], graph.c:152) at creation in source order, counting
// anonymous subgraphs. getObjId (emit.c:230) emits `clust<AGSEQ>`. The port must
// reproduce the counter so cluster ids match native dot.
// @see lib/cgraph/graph.c:agopen (AGSEQ assignment), :152 (agnextseq)
function findSubg(g: Graph, name: string): Graph | undefined {
  const direct = g.subgraphs.get(name);
  if (direct !== undefined) return direct;
  for (const sg of g.subgraphs.values()) {
    const found = findSubg(sg, name);
    if (found !== undefined) return found;
  }
  return undefined;
}

describe('subgraph AGSEQ numbering matches cgraph', () => {
  // nestedclust.gv: anon subgraphs interleave between clusters, so a dense
  // counter (clust1,2,3) diverges from native (clust2,6,7).
  const nestedclust =
    'digraph G {' +
    ' subgraph {e->f subgraph cluster_ss81 {a->b->c}};' +
    ' subgraph { subgraph { subgraph { subgraph cluster_x {' +
    '   x; subgraph cluster_y {y }}}}}' +
    '}';

  it('nestedclust clusters get seq 2, 6, 7', () => {
    const g = parse(nestedclust);
    expect(findSubg(g, 'cluster_ss81')!.seq).toBe(2);
    expect(findSubg(g, 'cluster_x')!.seq).toBe(6);
    expect(findSubg(g, 'cluster_y')!.seq).toBe(7);
  });

  it('two named clusters with no anon interleave get seq 1, 2', () => {
    const g = parse('digraph G { subgraph cluster_0 {a} subgraph cluster_1 {b} }');
    expect(findSubg(g, 'cluster_0')!.seq).toBe(1);
    expect(findSubg(g, 'cluster_1')!.seq).toBe(2);
  });

  it('root graph keeps seq 0', () => {
    expect(parse('digraph G { subgraph cluster_0 {a} }').seq).toBe(0);
    expect(parse('digraph { a->b }').seq).toBe(0);
  });

  it('a repeated named subgraph keeps its first seq (no double-increment)', () => {
    // `subgraph cluster_0` reopened mid-graph must not re-advance the counter;
    // a later cluster_1 stays at seq 2.
    const g = parse(
      'digraph G { subgraph cluster_0 {a} subgraph cluster_0 {b} subgraph cluster_1 {c} }',
    );
    expect(findSubg(g, 'cluster_0')!.seq).toBe(1);
    expect(findSubg(g, 'cluster_1')!.seq).toBe(2);
  });
});

// cgraph names each anonymous object `%(2*counter+1)` from one parse-wide
// counter advanced by: the unnamed root graph, every anonymous subgraph (at
// open), and every keyless edge. The port must reproduce that numbering so
// cluster <title>s match native (e.g. 2475_2: %3, %9, %17 …). Oracle values
// confirmed against `dot -Tsvg` in plans/anon-subgraph-naming/probes.
// @see lib/cgraph/id.c:idmap
const anonKeys = (g: { subgraphs: Map<string, unknown> }) =>
  [...g.subgraphs.keys()].filter((k) => k.startsWith('%'));

describe('anonymous %N numbering matches cgraph', () => {
  it('unnamed root consumes id 1 → first anon subgraph %3 (root,sg,edge)', () => {
    expect(anonKeys(parse('strict digraph { subgraph {a->b} }'))).toEqual(['%3']);
  });

  it('named root does not advance the counter → first anon subgraph %1', () => {
    expect(anonKeys(parse('strict digraph G { subgraph {a->b} }'))).toEqual(['%1']);
  });

  it('keyless edges advance the counter: sg1 %3, +1 edge → sg2 %7', () => {
    expect(anonKeys(parse('strict digraph { subgraph {a->b} subgraph {c->d e->f} }')))
      .toEqual(['%3', '%7']);
  });

  it('a multi-hop a->b->c counts as two edges → sg2 %9', () => {
    expect(anonKeys(parse('strict digraph { subgraph {a->b->c} subgraph {d->e} }')))
      .toEqual(['%3', '%9']);
  });

  it('nodes do not advance the counter → sg2 %5', () => {
    expect(anonKeys(parse('strict digraph { subgraph {a} subgraph {b} }')))
      .toEqual(['%3', '%5']);
  });

  it('a nested anon subgraph is numbered after preceding edges → %7', () => {
    const g = parse('strict digraph { subgraph {a->b subgraph {c->d}} }');
    expect(anonKeys(g)).toEqual(['%3']);
    expect(anonKeys([...g.subgraphs.values()][0])).toEqual(['%7']);
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

// A subgraph used as an EDGE ENDPOINT (`A -> {rank=same b c} -> D`) must be
// created as a first-class subgraph — registered in the parent's subgraph map
// with its attrs (rank=same/min/max/…) and node membership, and consuming an
// AGSEQ/%N like any subgraph — exactly as cgraph's grammar does (endpoint:
// subgraph creates the Agraph_t, then the edge connects to its nodes). The pre-
// fix builder only collected the endpoint's node NAMES, silently dropping the
// subgraph object, its rank-set attr, and its anon-id/AGSEQ.
// @see lib/cgraph/grammar.y (endpoint: subgraph), lib/dotgen/rank.c:collapse_sets
describe('subgraph as edge endpoint is registered (rank-set + AGSEQ)', () => {
  it('TOP -> {rank=same a b c} -> BOTTOM registers the rank=same subgraph', () => {
    const g = parse('digraph G { TOP -> {rank=same a b c} -> BOTTOM; a->b }');
    expect(g.subgraphs.size).toBe(1);
    const sg = [...g.subgraphs.values()][0]!;
    expect(sg.attrs.get('rank')).toBe('same');
    expect([...sg.nodes.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('interior endpoint subgraph is created exactly once (one %N)', () => {
    // `A -> {b c} -> D`: the `{b c}` is head of pair 1 and tail of pair 2 — it
    // must not be created twice (which would double-advance the anon counter).
    const g = parse('strict digraph G { A -> {b c} -> D }');
    expect(anonKeys(g)).toEqual(['%1']);
  });

  it('endpoint subgraph consumes AGSEQ → following cluster shifts to clust2', () => {
    // C: `a->{b c}; subgraph cluster1{x}` emits clust2 because the endpoint
    // subgraph took AGSEQ 1. Pre-fix the port emitted clust1 (undercount).
    const g = parse('digraph G { a -> {b c}; subgraph cluster1 { x } }');
    expect(findSubg(g, 'cluster1')!.seq).toBe(2);
  });

  it('node-set edges are created in AGSEQ order, not written order', () => {
    // b,c,d are created first (ascending ids); the set lists them out of order.
    // C walks the endpoint subgraph's node dict (sequence-ordered), so edges
    // are a->b, a->c, a->d — fixing graphs-world's edge SVG id numbering.
    const g = parse('digraph { b; c; d; a -> { d; c; b } }');
    expect(g.edges.map((e) => e.head.name)).toEqual(['b', 'c', 'd']);
    expect(g.edges.map((e) => e.graphSeq)).toEqual([1, 2, 3]);
  });
});
