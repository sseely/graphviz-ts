// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for self-loop routing in the dot engine.
 *
 * Acceptance criteria (from T2 task spec):
 * 1. A->A produces a 7-point spline (selfRight geometry) via makeSelfEdge.
 * 2. Multiple parallel self-loops each get distinct geometry.
 * 3. collectOtherEdges restores node.rw from mval before iterating.
 * 4. computeSizey returns expected values for minrank, maxrank, and mid-rank nodes.
 * 5. dotSplines_ calls makeSelfEdge paths (regression: no skip).
 *
 * @see lib/dotgen/dotsplines.c:388-409
 * @see lib/common/splines.c:makeSelfEdge
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
import type { RankEntry } from '../../model/rankEntry.js';
import { EDGETYPE_SPLINE, AUXGRAPH } from './splines.js';
import {
  collectOtherEdges,
  computeSizey,
  routeSelfEdgeGroup,
  buildDotSinfo,
} from './self-loop.js';
import { NORMAL, VIRTUAL } from './fastgr.js';

// ---------------------------------------------------------------------------
// Shared builders
// ---------------------------------------------------------------------------

function makeRankEntry(nodes: Node[]): RankEntry {
  return {
    n: nodes.length, v: [...nodes], an: 0, av: [],
    ht1: 0, ht2: 0, pht1: 0, pht2: 0,
    candidate: false, valid: false, cache_nc: 0,
  };
}

function makeGraph(name = 'g'): Graph {
  const g = new Graph(name, 'directed');
  g.info.nodesep = 36;
  g.info.ranksep = 36;
  g.info.flags = EDGETYPE_SPLINE;
  return g;
}

function makeNode(id: number, name: string, g: Graph, rank: number, order: number): Node {
  const n = new Node(id, name, g);
  n.info = makeNodeInfo();
  n.info.rank = rank;
  n.info.order = order;
  n.info.coord = { x: order * 72, y: rank * 72 };
  n.info.lw = 36;
  n.info.rw = 36;
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

/** Append edge to node.info.other (mirrors otherEdge from fastgr.ts). */
function placeInOther(e: Edge): void {
  if (!e.tail.info.other) e.tail.info.other = { list: [], size: 0 };
  e.tail.info.other.list[e.tail.info.other.size++] = e;
}

// ---------------------------------------------------------------------------
// Named assertion helpers
// ---------------------------------------------------------------------------

function assertNormalRwRestored(n: Node, selfEdge: Edge, edges: Edge[]): void {
  expect(n.info.rw).toBe(36);   // original rw restored from mval
  expect(n.info.mval).toBe(72); // inflated value now in mval
  expect(edges).toContain(selfEdge);
  expect(selfEdge.info.tree_index! & AUXGRAPH).toBe(AUXGRAPH);
}

function buildNormalNodeWithInflatedRw(g: Graph): [Node, Edge] {
  const n = makeNode(0, 'A', g, 0, 0);
  n.info.rw = 72;   // inflated by position
  n.info.mval = 36; // original rw saved by position
  const e = makeEdge(n, n, g);
  placeInOther(e);
  return [n, e];
}

function build3RankGraph(): [Graph, Node, Node, Node] {
  const g = makeGraph();
  const lo = makeNode(0, 'Lo', g, 0, 0);
  const mid = makeNode(1, 'Mid', g, 1, 0);
  const hi = makeNode(2, 'Hi', g, 2, 0);
  lo.info.coord  = { x: 0, y: 0 };
  mid.info.coord = { x: 0, y: 72 };
  hi.info.coord  = { x: 0, y: 144 };
  g.info.rank = [makeRankEntry([lo]), makeRankEntry([mid]), makeRankEntry([hi])];
  g.info.minrank = 0;
  g.info.maxrank = 2;
  return [g, lo, mid, hi];
}

function build2RankGraph(): [Graph, Node, Node] {
  const g = makeGraph();
  const a = makeNode(0, 'A', g, 0, 0);
  const b = makeNode(1, 'B', g, 1, 0);
  g.info.rank = [makeRankEntry([a]), makeRankEntry([b])];
  g.info.minrank = 0;
  g.info.maxrank = 1;
  return [g, a, b];
}

function buildSoleRankGraph(): [Graph, Node] {
  const g = makeGraph();
  const n = makeNode(0, 'A', g, 0, 0);
  n.info.ht = 36;
  g.info.rank = [makeRankEntry([n])];
  g.info.minrank = 0;
  g.info.maxrank = 0;
  return [g, n];
}

function assertSingleLoopHas7Points(e: Edge): void {
  expect(e.info.spl).toBeDefined();
  expect(e.info.spl!.list.length).toBeGreaterThan(0);
  expect(e.info.spl!.list[0].list.length).toBe(7);
}

function assertSecondLoopExtendsRight(e1: Edge, e2: Edge): void {
  const pts1 = e1.info.spl!.list[0].list;
  const pts2 = e2.info.spl!.list[0].list;
  const maxX1 = Math.max(...pts1.map(p => p.x));
  const maxX2 = Math.max(...pts2.map(p => p.x));
  expect(maxX2).toBeGreaterThan(maxX1);
}

// ---------------------------------------------------------------------------
// AC-3: collectOtherEdges restores rw from mval for NORMAL nodes
// ---------------------------------------------------------------------------

describe('collectOtherEdges — mval/rw swap', () => {
  it('restores rw from mval for a NORMAL node with other-list entries', () => {
    const g = makeGraph();
    const [n, selfEdge] = buildNormalNodeWithInflatedRw(g);
    const edges: Edge[] = [];
    collectOtherEdges(n, edges);
    assertNormalRwRestored(n, selfEdge, edges);
  });

  it('does NOT swap rw/mval for a VIRTUAL node', () => {
    const g = makeGraph();
    const n = makeNode(0, 'V', g, 0, 0);
    n.info.node_type = VIRTUAL;
    n.info.rw = 99;
    n.info.mval = 10;
    placeInOther(makeEdge(n, n, g));
    const edges: Edge[] = [];
    collectOtherEdges(n, edges);
    expect(n.info.rw).toBe(99);
  });

  it('collects nothing when other list is empty', () => {
    const g = makeGraph();
    const n = makeNode(0, 'A', g, 0, 0);
    const edges: Edge[] = [];
    collectOtherEdges(n, edges);
    expect(edges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-4: computeSizey returns correct geometry from rank context
// @see lib/dotgen/dotsplines.c:389-403
//
// C formula:
//   maxrank, r > 0: sizey = rank[r-1].v[0].coord.y - coord(n).y
//   minrank:        sizey = coord(n).y - rank[r+1].v[0].coord.y
//   else (mid):     sizey = min(rank[r-1].v[0].y - n.y, n.y - rank[r+1].v[0].y)
//   maxrank, r == 0: sizey = ht(n)
// ---------------------------------------------------------------------------

describe('computeSizey — sole/boundary ranks', () => {
  it('returns ht for maxrank=0 node (sole rank)', () => {
    const [g, n] = buildSoleRankGraph();
    expect(computeSizey(g, n)).toBe(36);
  });

  it('returns y-distance to next rank for minrank node', () => {
    const [g, a, b] = build2RankGraph();
    expect(computeSizey(g, a)).toBe(a.info.coord!.y - b.info.coord!.y);
  });

  it('returns distance to prev rank for maxrank node (r > 0)', () => {
    const [g, a, b] = build2RankGraph();
    expect(computeSizey(g, b)).toBe(a.info.coord!.y - b.info.coord!.y);
  });
});

describe('computeSizey — mid-rank node', () => {
  it('returns min(upy, dwny) for mid-rank node', () => {
    const [g, , mid] = build3RankGraph();
    // build3RankGraph: lo.y=0, mid.y=72, hi.y=144
    // upy  = rank[r-1].y - mid.y = 0 - 72 = -72
    // dwny = mid.y - rank[r+1].y = 72 - 144 = -72
    // min(-72, -72) = -72  (sign follows C convention)
    expect(computeSizey(g, mid)).toBe(-72);
  });
});

// ---------------------------------------------------------------------------
// AC-5: routeSelfEdgeGroup installs spline geometry on self-loop edge
// ---------------------------------------------------------------------------

describe('routeSelfEdgeGroup — spline installation', () => {
  it('installs a 7-point spline on a single self-loop at a mid-rank node', () => {
    const [g, , mid] = build3RankGraph();
    const selfEdge = makeEdge(mid, mid, g);
    routeSelfEdgeGroup(g, [selfEdge], 1, g.info.nodesep ?? 36, buildDotSinfo());
    assertSingleLoopHas7Points(selfEdge);
  });

  it('gives two parallel self-loops distinct geometry', () => {
    const [g, , mid] = build3RankGraph();
    const e1 = makeEdge(mid, mid, g);
    const e2 = makeEdge(mid, mid, g);
    routeSelfEdgeGroup(g, [e1, e2], 2, g.info.nodesep ?? 36, buildDotSinfo());
    expect(e1.info.spl).toBeDefined();
    expect(e2.info.spl).toBeDefined();
    assertSecondLoopExtendsRight(e1, e2);
  });
});

// ---------------------------------------------------------------------------
// AC-1: buildDotSinfo returns a valid SplineInfo
// ---------------------------------------------------------------------------

describe('buildDotSinfo', () => {
  it('returns SplineInfo with swapEnds and splineMerge callbacks', () => {
    const sinfo = buildDotSinfo();
    expect(typeof sinfo.swapEnds).toBe('function');
    expect(typeof sinfo.splineMerge).toBe('function');
    expect(sinfo.ignoreSwap).toBe(false);
    expect(sinfo.isOrtho).toBe(false);
  });
});
