// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for T7: multi-edge (parallel edge) predicate and offset routing.
 *
 * Acceptance criteria:
 * AC1. interclexpMergeable with different labels returns false.
 * AC2. interclexpMergeable with different ports returns false.
 * AC3. interclexpMergeable with same tail/head/label/ports returns true.
 * AC4. routeParallelEdgeGroup routes 3 parallel edges to 3 distinct splines
 *      whose control-point x positions are separated by ~Multisep each.
 * AC5. Single-edge group installs a spline with no offset.
 *
 * @see lib/dotgen/class2.c:mergeable
 * @see lib/dotgen/dotsplines.c:make_regular_edge (cnt > 1 offset section)
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
import type { RankEntry } from '../../model/rankEntry.js';
import { EDGETYPE_SPLINE } from './splines.js';
import { interclexpMergeable } from './cluster.js';
import { routeParallelEdgeGroup, shiftInteriorPts } from './splines-route.js';

// ---------------------------------------------------------------------------
// Shared builders
// ---------------------------------------------------------------------------

function makeRankEntry(nodes: Node[]): RankEntry {
  return {
    n: nodes.length, v: [...nodes], an: 0, av: [],
    ht1: 18, ht2: 18, pht1: 0, pht2: 0,
    candidate: false, valid: false, cache_nc: 0,
  };
}

function makeGraph(name = 'g'): Graph {
  const g = new Graph(name, 'directed');
  g.info.nodesep = 18;
  g.info.ranksep = 36;
  g.info.flags = EDGETYPE_SPLINE;
  return g;
}

interface NodeSpec {
  id: number; name: string;
  rank: number; order: number;
  cx: number; cy: number;
}

function makeNode(spec: NodeSpec, g: Graph): Node {
  const n = new Node(spec.id, spec.name, g);
  n.info = makeNodeInfo();
  n.info.rank = spec.rank;
  n.info.order = spec.order;
  n.info.coord = { x: spec.cx, y: spec.cy };
  n.info.lw = 27;
  n.info.rw = 27;
  n.info.ht = 36;
  n.info.node_type = 0; // NORMAL
  g.nodes.set(spec.name, n);
  return n;
}

function makeEdge(tail: Node, head: Node, g: Graph): Edge {
  const e = new Edge(tail, head, '');
  e.info = makeEdgeInfo(makePort(), makePort());
  g.edges.push(e);
  return e;
}

/** Build a two-rank graph with A at rank 1 (cy=90) and B at rank 0 (cy=18). */
function makeTwoNodeGraph(): { g: Graph; a: Node; b: Node } {
  const g = makeGraph();
  const a = makeNode({ id: 1, name: 'A', rank: 1, order: 0, cx: 27, cy: 90 }, g);
  const b = makeNode({ id: 2, name: 'B', rank: 0, order: 0, cx: 27, cy: 18 }, g);
  g.info.minrank = 0;
  g.info.maxrank = 1;
  g.info.rank = [makeRankEntry([b]), makeRankEntry([a])];
  return { g, a, b };
}

// ---------------------------------------------------------------------------
// AC1–AC3: interclexpMergeable predicate
// ---------------------------------------------------------------------------

describe('interclexpMergeable — AC1 different labels', () => {
  it('returns false', () => {
    const g = makeGraph();
    const a = makeNode({ id: 1, name: 'A', rank: 1, order: 0, cx: 0, cy: 90 }, g);
    const b = makeNode({ id: 2, name: 'B', rank: 0, order: 0, cx: 0, cy: 18 }, g);
    const e1 = makeEdge(a, b, g);
    const e2 = makeEdge(a, b, g);
    e1.info.label = { text: 'x' };
    e2.info.label = { text: 'y' };
    expect(interclexpMergeable(e1, e2)).toBe(false);
  });
});

describe('interclexpMergeable — AC2 different head ports', () => {
  it('returns false', () => {
    const g = makeGraph();
    const a = makeNode({ id: 1, name: 'A', rank: 1, order: 0, cx: 0, cy: 90 }, g);
    const b = makeNode({ id: 2, name: 'B', rank: 0, order: 0, cx: 0, cy: 18 }, g);
    const e1 = makeEdge(a, b, g);
    const e2 = makeEdge(a, b, g);
    e1.info.head_port = { ...makePort(), defined: true, p: { x: 5, y: 0 } };
    e2.info.head_port = { ...makePort(), defined: true, p: { x: 10, y: 0 } };
    expect(interclexpMergeable(e1, e2)).toBe(false);
  });
});

describe('interclexpMergeable — AC3 same endpoints', () => {
  it('returns true', () => {
    const g = makeGraph();
    const a = makeNode({ id: 1, name: 'A', rank: 1, order: 0, cx: 0, cy: 90 }, g);
    const b = makeNode({ id: 2, name: 'B', rank: 0, order: 0, cx: 0, cy: 18 }, g);
    const e1 = makeEdge(a, b, g);
    const e2 = makeEdge(a, b, g);
    expect(interclexpMergeable(e1, e2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shiftInteriorPts unit test
// ---------------------------------------------------------------------------

describe('shiftInteriorPts', () => {
  it('shifts only indices 1..length-2, leaves endpoints fixed', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 1, y: 1 },
      { x: 2, y: 2 }, { x: 3, y: 3 },
    ];
    const result = shiftInteriorPts(pts, 5);
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[1]).toEqual({ x: 6, y: 1 });
    expect(result[2]).toEqual({ x: 7, y: 2 });
    expect(result[3]).toEqual({ x: 3, y: 3 });
  });
});

// ---------------------------------------------------------------------------
// AC4–AC5: routeParallelEdgeGroup
// ---------------------------------------------------------------------------

/** Extract x of first interior control point from installed spline. */
function cp1x(e: Edge): number {
  return e.info.spl!.list[0]!.list[1]!.x;
}

describe('routeParallelEdgeGroup', () => {
  it('AC4 — 3 parallel edges get splines with ascending x, spacing ~multisep', () => {
    const { g, a, b } = makeTwoNodeGraph();
    const multisep = g.info.nodesep ?? 18;
    const edges = [makeEdge(a, b, g), makeEdge(a, b, g), makeEdge(a, b, g)];
    routeParallelEdgeGroup(g, edges, multisep);
    assertAllSplinesInstalled(edges);
    assertAscendingX(edges);
    assertSpacing(edges, multisep);
  });

  it('AC5 — single-edge group installs a spline with >= 4 control points', () => {
    const { g, a, b } = makeTwoNodeGraph();
    const e = makeEdge(a, b, g);
    routeParallelEdgeGroup(g, [e], g.info.nodesep ?? 18);
    expect(e.info.spl).toBeDefined();
    expect(e.info.spl!.list[0]!.list.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// AC4 assertion helpers — extracted to keep each callback below CCN 3
// ---------------------------------------------------------------------------

function assertAllSplinesInstalled(edges: Edge[]): void {
  for (const e of edges) {
    expect(e.info.spl).toBeDefined();
    expect(e.info.spl!.list.length).toBeGreaterThan(0);
  }
}

function assertAscendingX(edges: Edge[]): void {
  expect(cp1x(edges[0]!)).toBeLessThan(cp1x(edges[1]!));
  expect(cp1x(edges[1]!)).toBeLessThan(cp1x(edges[2]!));
}

// Post-clip spacing between cp1x values (~13.37 for multisep=18) is smaller
// than multisep because bezier_clip (de Casteljau binary search) shortens the
// interior control points when clipping to node boundaries.
// @see lib/common/splines.c:bezier_clip
// C reference values from dot-multi-edge.svg: cp1x = [13.63, 27.00, 40.37]
// → spacing = 13.37 (not 18).  Allow ±1 for floating-point variation.
function assertSpacing(edges: Edge[], _multisep: number): void {
  const spacing1 = cp1x(edges[1]!) - cp1x(edges[0]!);
  const spacing2 = cp1x(edges[2]!) - cp1x(edges[1]!);
  // C-derived spacing is ~13.37; we allow ±1 for floating-point variation
  expect(spacing1).toBeGreaterThan(12);
  expect(spacing1).toBeLessThan(15);
  expect(spacing2).toBeGreaterThan(12);
  expect(spacing2).toBeLessThan(15);
}
