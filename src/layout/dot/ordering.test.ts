// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for `ordering=out`/`in` enforcement in mincross.
 *
 * The bug: C's `new_virtual_edge` copies `AGSEQ(orig)` onto the virtual edge
 * (fastgr.c:new_virtual_edge), so `do_ordering_node`'s qsort-by-AGSEQ orders the
 * constraint edges by DOT-declaration order. The port originally left virtual
 * edges with a fresh `_nextSeq++`, so the sort ordered by virtual-creation order
 * instead — producing the wrong (or a suppressed) FLATORDER constraint.
 *
 * These tests pin the faithful behavior: a virtual edge inherits `orig.seq`, and
 * `doOrderingNode` installs the FLATORDER edge in DOT-declaration order even when
 * the node's out/in list is in the opposite (virtual-creation) order.
 *
 * @see lib/dotgen/mincross.c:do_ordering_node, lib/dotgen/fastgr.c:new_virtual_edge
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { newVirtualEdge, findFlatEdge, FLATORDER } from './fastgr.js';
import { doOrderingNode } from './mincross-build.js';
import type { MincrossContext } from './mincross-utils.js';

function mkNode(g: Graph, id: number, name: string): Node {
  const n = new Node(id, name, g);
  n.info = makeNodeInfo();
  g.nodes.set(name, n);
  return n;
}

function mkCtx(root: Graph): MincrossContext {
  return {
    root,
    globalMinRank: 0,
    globalMaxRank: 1,
    teList: [],
    tiList: [],
    reMincross: false,
    minQuit: 8,
    maxIter: 24,
  };
}

describe('newVirtualEdge — AGSEQ inheritance (C new_virtual_edge)', () => {
  it('a virtual edge inherits orig.seq, not a fresh sequence number', () => {
    const g = new Graph('g', 'directed');
    const t = mkNode(g, 1, 't');
    const h = mkNode(g, 2, 'h');
    const orig = new Edge(t, h, '');
    const ve = newVirtualEdge(t, h, orig);
    // C: AGSEQ(e) = AGSEQ(orig). The fresh _nextSeq++ assigned at construction
    // is overwritten by copyVirtualEdgeInfo.
    expect(ve.seq).toBe(orig.seq);
  });

  it('a FLATORDER virtual edge (orig=null) keeps its fresh seq (C leaves AGSEQ)', () => {
    const g = new Graph('g', 'directed');
    const u = mkNode(g, 1, 'u');
    const v = mkNode(g, 2, 'v');
    const before = new Edge(u, v, '').seq; // advance the counter for reference
    const ve = newVirtualEdge(u, v, null);
    expect(ve.seq).toBeGreaterThan(before);
  });
});

describe('doOrderingNode — FLATORDER follows DOT-declaration order', () => {
  it('ordering=out: installs head(first)->head(second) when out-list is reversed', () => {
    const g = new Graph('g', 'directed');
    const t = mkNode(g, 1, 't');
    const a = mkNode(g, 2, 'a');
    const b = mkNode(g, 3, 'b');

    // DOT declaration order: t->b first (lower seq), t->a second (higher seq).
    const origB = new Edge(t, b, '');
    const origA = new Edge(t, a, '');
    expect(origB.seq).toBeLessThan(origA.seq);

    // Virtual edges created in the OPPOSITE order (a before b), mirroring how
    // class2 may build the fast graph. Without the seq-copy fix these would sort
    // by creation order (a first) and produce FLATORDER a->b.
    const veToA = newVirtualEdge(t, a, origA);
    const veToB = newVirtualEdge(t, b, origB);
    t.info.out = { list: [veToA, veToB], size: 2 };

    doOrderingNode(mkCtx(g), g, t, true);

    // Faithful result: sort by seq -> [t->b, t->a] -> heads [b, a] -> FLATORDER b->a.
    const ba = findFlatEdge(b, a);
    expect(ba).toBeDefined();
    expect(ba!.info.edge_type).toBe(FLATORDER);
    expect(findFlatEdge(a, b)).toBeUndefined();
  });

  it('ordering=in: installs tail(first)->tail(second) when in-list is reversed', () => {
    const g = new Graph('g', 'directed');
    const z = mkNode(g, 1, 'z');
    const a = mkNode(g, 2, 'a');
    const b = mkNode(g, 3, 'b');

    // DOT declaration order: a->z first (lower seq), b->z second (higher seq).
    const origA = new Edge(a, z, '');
    const origB = new Edge(b, z, '');
    expect(origA.seq).toBeLessThan(origB.seq);

    // Virtual edges created in the OPPOSITE order (b before a).
    const veFromB = newVirtualEdge(b, z, origB);
    const veFromA = newVirtualEdge(a, z, origA);
    z.info.in = { list: [veFromB, veFromA], size: 2 };

    doOrderingNode(mkCtx(g), g, z, false);

    // Faithful result: sort by seq -> [a->z, b->z] -> tails [a, b] -> FLATORDER a->b.
    const ab = findFlatEdge(a, b);
    expect(ab).toBeDefined();
    expect(ab!.info.edge_type).toBe(FLATORDER);
    expect(findFlatEdge(b, a)).toBeUndefined();
  });
});
