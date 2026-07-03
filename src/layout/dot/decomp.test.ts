// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for `nodesInSeq` (F7): subgraph node iteration must mirror C's
 * `agfstnode`/`agnxtnode` — AGSEQ (global, root-graph-wide creation order) —
 * not the subgraph-local first-insertion order a JS `Map` iterates by
 * default.
 *
 * @see .agent-notes/path-structure-xns-residuals.md ("## F7 outcome")
 * @see lib/cgraph/node.c:43 (agfstnode), :283-290 (agsubnodeseqcmpf)
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { nodesInSeq } from './decomp.js';
import { parse } from '../../parser/index.js';

describe('nodesInSeq — AGSEQ order vs Map insertion order', () => {
  it('sorts by node.id (global creation order), not subgraph-local insertion order', () => {
    const g = new Graph('root', 'directed');
    // Global creation order: a(id=0), b(id=1), c(id=2).
    const a = new Node(0, 'a', g);
    const b = new Node(1, 'b', g);
    const c = new Node(2, 'c', g);
    for (const n of [a, b, c]) g.nodes.set(n.name, n);

    const sub = new Graph('sub', 'directed');
    sub.parent = g;
    sub.root = g;
    // Subgraph-local insertion order: c, then a (b never joins). A raw Map
    // iteration would yield [c, a]; AGSEQ order must yield [a, c].
    sub.nodes.set(c.name, c);
    sub.nodes.set(a.name, a);

    expect([...sub.nodes.values()].map((n) => n.name)).toEqual(['c', 'a']);
    expect(nodesInSeq(sub).map((n) => n.name)).toEqual(['a', 'c']);
  });

  it('reproduces b51.gv\'s late-join shape: a node globally first-mentioned in '
    + 'one cluster but only later added to a different cluster sorts by its '
    + 'ORIGINAL creation order, not the joining cluster\'s local insertion order', () => {
    // Mirrors b51.gv: blok_10 is globally first mentioned inside
    // cluster_if_28's scope (line 25, `blok_10 -> blok_7`) before
    // cluster_if_40 opens; blok_10 only becomes a MEMBER of cluster_if_40
    // later (line 34). C's agfstnode(cluster_if_40) yields blok_10 in its
    // true (early) AGSEQ position; the port's cluster_if_40.nodes Map
    // inserts it last (4th), since membership post-dates blok_9/blok_11/
    // blok_13's first mentions inside cluster_if_40's own scope.
    const src = `digraph {
      subgraph cluster_if_28 { late -> other; }
      subgraph cluster_if_40 { first -> mid; mid -> second; second -> late; }
    }`;
    const g = parse(src);
    const cluster40 = g.subgraphs.get('cluster_if_40')!;
    expect(cluster40).toBeDefined();

    // Raw Map order: cluster_if_40's OWN first-mentions (first, mid, second)
    // come before `late`, which only joins via the `second -> late` edge.
    const mapOrder = [...cluster40.nodes.values()].map((n) => n.name);
    expect(mapOrder.indexOf('late')).toBe(mapOrder.length - 1);

    // AGSEQ order: `late` was globally created FIRST (inside cluster_if_28,
    // parsed before cluster_if_40 opens), so it must sort first.
    const seqOrder = nodesInSeq(cluster40).map((n) => n.name);
    expect(seqOrder[0]).toBe('late');
    expect(seqOrder).not.toEqual(mapOrder);
  });

  it('returns a snapshot array safe to iterate while the graph mutates', () => {
    const g = new Graph('root', 'directed');
    const a = new Node(0, 'a', g);
    const b = new Node(1, 'b', g);
    g.nodes.set(a.name, a);
    g.nodes.set(b.name, b);
    const seq = nodesInSeq(g);
    g.nodes.delete('a');
    expect(seq.map((n) => n.name)).toEqual(['a', 'b']);
  });
});
