// SPDX-License-Identifier: EPL-2.0

/**
 * T1 — dot engine splines=ortho dispatch.
 *
 * Verifies dotSplines_ dispatches the orthoEdges pipeline for EDGETYPE_ORTHO
 * (mirroring lib/dotgen/dotsplines.c:251-259): orthogonal splines installed on
 * the edge, edgeLabelsDone set, regular routing skipped; and that non-ortho
 * graphs are unaffected. Also covers the resetRW rw↔mval swap.
 *
 * @see lib/dotgen/dotsplines.c:dot_splines_ (EDGETYPE_ORTHO branch), resetRW
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
import {
  dotSplines_, resetRW, EDGETYPE_ORTHO, EDGETYPE_SPLINE,
} from './splines.js';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function makeGraph(flags: number): Graph {
  const g = new Graph('g', 'directed');
  g.info.nodesep = 36;
  g.info.ranksep = 36;
  g.info.flags = flags;
  return g;
}

function makeNode(id: number, name: string, g: Graph, x: number, y: number): Node {
  const n = new Node(id, name, g);
  n.info = makeNodeInfo();
  n.info.coord = { x, y };
  n.info.lw = 18;
  n.info.rw = 18;
  n.info.ht = 36;
  g.nodes.set(name, n);
  return n;
}

function makeEdge(tail: Node, head: Node, g: Graph): Edge {
  const e = new Edge(tail, head, '');
  e.info = makeEdgeInfo(makePort(), makePort());
  g.edges.push(e);
  return e;
}

/** Two vertically separated nodes with one edge (clear vertical gap). */
function twoNodeOrtho(flags: number): { g: Graph; e: Edge; a: Node; b: Node } {
  const g = makeGraph(flags);
  const a = makeNode(0, 'a', g, 0, 90);
  const b = makeNode(1, 'b', g, 0, 0);
  const e = makeEdge(a, b, g);
  return { g, e, a, b };
}

function distinctXYCount(pts: { x: number; y: number }[]): {
  xs: number; ys: number;
} {
  return {
    xs: new Set(pts.map((p) => p.x)).size,
    ys: new Set(pts.map((p) => p.y)).size,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('dot splines=ortho dispatch (T1)', () => {
  it('installs an orthogonal spline on the edge (not a straight diagonal)', () => {
    const { g, e } = twoNodeOrtho(EDGETYPE_ORTHO);
    const rc = dotSplines_(g, true);
    expect(rc).toBe(0);

    expect(e.info.spl).toBeDefined();
    const spl = e.info.spl!;
    expect(spl.list.length).toBeGreaterThan(0);
    const bz = spl.list[0]!;
    expect(bz.list.length).toBeGreaterThan(0);

    // Orthogonal route between two vertically-stacked nodes: every point
    // shares one x (a single vertical run), spanning multiple y values — not a
    // diagonal (which would vary both x and y together across distinct values).
    const { xs, ys } = distinctXYCount(bz.list);
    expect(xs).toBe(1);
    expect(ys).toBeGreaterThan(1);
  });

  it('sets edgeLabelsDone and returns 0 for ortho', () => {
    const { g } = twoNodeOrtho(EDGETYPE_ORTHO);
    const rc = dotSplines_(g, true);
    expect(rc).toBe(0);
    expect(g.info.edgeLabelsDone).toBe(true);
  });

  it('does NOT run the ortho branch for non-ortho graphs (regular routing path)', () => {
    // EDGETYPE_NONE returns 0 immediately with no spline installed.
    const none = twoNodeOrtho(0);
    expect(dotSplines_(none.g, true)).toBe(0);
    expect(none.e.info.spl).toBeUndefined();

    // EDGETYPE_SPLINE takes the regular path (no throw); ortho adapter untouched.
    const spline = twoNodeOrtho(EDGETYPE_SPLINE);
    expect(() => dotSplines_(spline.g, true)).not.toThrow();
  });

  it('is deterministic: two ortho runs install identical points', () => {
    const r1 = twoNodeOrtho(EDGETYPE_ORTHO);
    const r2 = twoNodeOrtho(EDGETYPE_ORTHO);
    dotSplines_(r1.g, true);
    dotSplines_(r2.g, true);
    const k = (e: Edge) =>
      e.info.spl!.list[0]!.list.map((p) => `${p.x},${p.y}`).join(' ');
    expect(k(r1.e)).toBe(k(r2.e));
  });

  // resetRW (dotsplines.c:187-193): swap rw↔mval when node has other edges.
  it('resetRW swaps rw and mval only for nodes with other-edge list', () => {
    const g = makeGraph(EDGETYPE_ORTHO);
    const withOther = makeNode(0, 'a', g, 0, 90);
    withOther.info.rw = 72;
    withOther.info.mval = 18;
    withOther.info.other = { list: [makeEdge(withOther, withOther, g)], size: 1 };

    const noOther = makeNode(1, 'b', g, 0, 0);
    noOther.info.rw = 18;
    noOther.info.mval = 99;

    resetRW(g);

    expect(withOther.info.rw).toBe(18); // swapped from mval
    expect(withOther.info.mval).toBe(72); // old rw
    expect(noOther.info.rw).toBe(18); // untouched
    expect(noOther.info.mval).toBe(99);
  });
});
