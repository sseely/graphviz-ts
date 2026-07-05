// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for T37: conc.ts, sameport.ts, splines.ts acceptance criteria.
 *
 * Acceptance criteria:
 * 1. Recursive flat-adj pipeline: cloned graph has NodeInfo.coord set.
 * 2. dotSameports merges ports: two sametail edges get same tailPort.p.
 * 3. dotConcentrate merges virtual nodes: rank array shrinks.
 * 4. edge_normalize reverses splines: backward edge spline is reversed.
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
import type { RankEntry } from '../../model/rankEntry.js';
import { VIRTUAL, NORMAL } from './fastgr.js';
import { dotConcentrate, portcmp, mergeVirtual, downcandidate } from './conc.js';
import { dotSameports, buildSharedPort, averageDirection } from './sameport.js';
import {
  swapEndsP, edgeNormalize, swapSpline, swapBezier,
  edgecmp, getMainEdge, setflags,
  REGULAREDGE, FWDEDGE, FLATEDGE, MAINGRAPH, EDGETYPE_SPLINE,
} from './splines.js';
import { makeFlatAdjEdges, cloneGraph, runAuxPipeline } from './splines-flat.js';

// ---------------------------------------------------------------------------
// Shared low-level builders
// ---------------------------------------------------------------------------

export function makeRankEntry(nodes: Node[]): RankEntry {
  return { n: nodes.length, v: [...nodes], an: 0, av: [], ht1: 0, ht2: 0, pht1: 0, pht2: 0, candidate: false, valid: false, cache_nc: 0 };
}

export function makeGraph(name = 'g'): Graph {
  const g = new Graph(name, 'directed');
  g.info.nodesep = 36;
  g.info.ranksep = 36;
  g.info.flags = EDGETYPE_SPLINE;
  return g;
}

export function makeNode(id: number, name: string, g: Graph, rank: number, order: number): Node {
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

export function makeEdge(tail: Node, head: Node, g: Graph): Edge {
  const e = new Edge(tail, head, '');
  e.info = makeEdgeInfo(makePort(), makePort());
  g.edges.push(e);
  return e;
}

export function linkEdge(e: Edge): void {
  if (!e.tail.info.out) e.tail.info.out = { list: [], size: 0 };
  if (!e.head.info.in) e.head.info.in = { list: [], size: 0 };
  e.tail.info.out.list[e.tail.info.out.size++] = e;
  e.head.info.in.list[e.head.info.in.size++] = e;
}

export function makeBezier(pts: [number, number][]): import('../../model/geom.js').Bezier {
  return { list: pts.map(([x, y]) => ({ x, y })), size: pts.length, sflag: 0, eflag: 0, sp: { x: 0, y: 0 }, ep: { x: 3, y: 3 } };
}

export function makeSplEdge(g: Graph, tail: Node, head: Node): Edge {
  const e = makeEdge(tail, head, g);
  linkEdge(e);
  tail.info.out = { list: [e], size: 1 };
  e.info.spl = { list: [makeBezier([[0, 0], [1, 1], [2, 2], [3, 3]])], size: 1, bb: { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } } };
  return e;
}

// ---------------------------------------------------------------------------
// AC-1 builders
// ---------------------------------------------------------------------------

export function buildFlatAdjGraph(): [Graph, Edge] {
  const g = makeGraph('flatAdj');
  const tn = makeNode(0, 'tn', g, 0, 0);
  const hn = makeNode(1, 'hn', g, 0, 1);
  tn.info.node_type = NORMAL;
  hn.info.node_type = NORMAL;
  const e = makeEdge(tn, hn, g);
  e.info.adjacent = 1;
  linkEdge(e);
  return [g, e];
}

// ---------------------------------------------------------------------------
// AC-2 builders
// ---------------------------------------------------------------------------

export function buildSametailGraph(): [Graph, Edge, Edge] {
  const g = makeGraph('sp');
  const a = makeNode(0, 'a', g, 0, 0);
  const b = makeNode(1, 'b', g, 1, 0);
  const c = makeNode(2, 'c', g, 1, 1);
  const e1 = makeEdge(a, b, g);
  const e2 = makeEdge(a, c, g);
  e1.info.sametail = 'grp';
  e2.info.sametail = 'grp';
  linkEdge(e1); linkEdge(e2);
  return [g, e1, e2];
}

export function buildSharedPortGraph(): [Node, Edge] {
  const g = makeGraph();
  const u = makeNode(0, 'u', g, 0, 0);
  const v = makeNode(1, 'v', g, 1, 1);
  const e = makeEdge(u, v, g);
  linkEdge(e);
  return [u, e];
}

export function buildAvgDirGraph(): [Node, Edge] {
  const g = makeGraph();
  const u = makeNode(0, 'u', g, 0, 0);
  u.info.coord = { x: 0, y: 0 };
  const v = makeNode(1, 'v', g, 0, 1);
  v.info.coord = { x: 3, y: 4 };
  const e = makeEdge(u, v, g);
  linkEdge(e);
  return [u, e];
}

// ---------------------------------------------------------------------------
// AC-3 builders
// ---------------------------------------------------------------------------

export function buildDowncandidateNode(): Node {
  const g = makeGraph();
  const v = makeNode(0, 'v', g, 1, 0);
  v.info.node_type = VIRTUAL;
  v.info.in  = { list: [new Edge(v, v, '')], size: 1 };
  v.info.out = { list: [new Edge(v, v, '')], size: 1 };
  return v;
}

export function buildConcentrateGraph(): Graph {
  const g = makeGraph();
  const tail = makeNode(0, 'tail', g, 0, 0);
  const head = makeNode(1, 'head', g, 2, 0);
  const v1 = makeNode(2, 'v1', g, 1, 0);
  const v2 = makeNode(3, 'v2', g, 1, 1);
  v1.info.node_type = VIRTUAL; v2.info.node_type = VIRTUAL;
  const e1 = makeEdge(tail, v1, g); const f1 = makeEdge(v1, head, g);
  const e2 = makeEdge(tail, v2, g); const f2 = makeEdge(v2, head, g);
  linkEdge(e1); linkEdge(f1); linkEdge(e2); linkEdge(f2);
  v1.info.next = v2; v2.info.prev = v1;
  tail.info.next = v1; v1.info.prev = tail;
  g.info.nlist = tail;
  g.info.rank = [makeRankEntry([tail]), makeRankEntry([v1, v2]), makeRankEntry([head])];
  g.info.rank[1].n = 2;
  g.info.minrank = 0; g.info.maxrank = 2; g.info.dotroot = g;
  return g;
}

// ---------------------------------------------------------------------------
// AC-4 builders
// ---------------------------------------------------------------------------

export function buildBackEdgeGraph(): [Graph, Edge] {
  const g = makeGraph();
  const hi = makeNode(0, 'hi', g, 2, 0);
  const lo = makeNode(1, 'lo', g, 0, 0);
  return [g, makeSplEdge(g, hi, lo)];
}

export function buildFwdEdgeGraph(): [Graph, Edge] {
  const g = makeGraph();
  const lo = makeNode(0, 'lo', g, 0, 0);
  const hi = makeNode(1, 'hi', g, 2, 0);
  return [g, makeSplEdge(g, lo, hi)];
}

export function buildEdgeCmpGraph(): [Graph, Edge, Edge] {
  const g = makeGraph();
  const a = makeNode(0, 'a', g, 0, 0);
  const b = makeNode(1, 'b', g, 0, 1);
  const c = makeNode(2, 'c', g, 1, 0);
  const flat = makeEdge(a, b, g);
  const reg  = makeEdge(a, c, g);
  setflags(flat, FLATEDGE, FWDEDGE, MAINGRAPH);
  setflags(reg, REGULAREDGE, FWDEDGE, MAINGRAPH);
  return [g, flat, reg];
}

// ---------------------------------------------------------------------------
// Named assertion helpers (keep it() bodies ≤ 30 lines)
// ---------------------------------------------------------------------------

export function assertSametailPortsMerged(e1: Edge, e2: Edge): void {
  expect(e1.info.tail_port.defined).toBe(true);
  expect(e2.info.tail_port.defined).toBe(true);
  expect(e1.info.tail_port.p.x).toBe(e2.info.tail_port.p.x);
  expect(e1.info.tail_port.p.y).toBe(e2.info.tail_port.p.y);
}

// ---------------------------------------------------------------------------
// 1. Recursive flat-adj pipeline
// ---------------------------------------------------------------------------

describe('makeFlatAdjEdges — recursive pipeline', () => {
  it('cloneGraph carries geometry and sets flip=true', () => {
    const [g] = buildFlatAdjGraph();
    const auxg = cloneGraph(g);
    expect(auxg.info.flip).toBe(true);
    expect(auxg.info.nodesep).toBe(g.info.nodesep);
  });

  it('runAuxPipeline returns 0 for empty cloned graph', () => {
    const [g] = buildFlatAdjGraph();
    expect(runAuxPipeline(cloneGraph(g))).toBe(0);
  });

  it('makeFlatAdjEdges returns 0 for adjacent edge group', () => {
    const [g, e] = buildFlatAdjGraph();
    g.info.rank = [makeRankEntry([g.nodes.get('tn')!, g.nodes.get('hn')!])];
    g.info.minrank = 0; g.info.maxrank = 0;
    expect(makeFlatAdjEdges(g, [e], 1, EDGETYPE_SPLINE)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. dotSameports merges ports
// ---------------------------------------------------------------------------

describe('dotSameports — same-tail port merging', () => {
  it('assigns identical tail port to two edges sharing sametail value', () => {
    const [g, e1, e2] = buildSametailGraph();
    dotSameports(g);
    assertSametailPortsMerged(e1, e2);
  });

  it('buildSharedPort returns a defined port', () => {
    const [u, e] = buildSharedPortGraph();
    expect(buildSharedPort(u, [e], 36).defined).toBe(true);
  });

  it('averageDirection returns unit vector for single edge', () => {
    const [u, e] = buildAvgDirGraph();
    const dir = averageDirection(u, [e]);
    expect(Math.hypot(dir.x, dir.y)).toBeCloseTo(1, 5);
    expect(dir.x).toBeCloseTo(0.6, 5);
  });
});

// ---------------------------------------------------------------------------
// 3. dotConcentrate merges virtual nodes
// ---------------------------------------------------------------------------

describe('dotConcentrate — virtual node merging', () => {
  it('portcmp returns 0 for two equal undefined ports', () => {
    const p = makePort();
    expect(portcmp(p, p)).toBe(0);
  });

  it('portcmp: defined > undefined', () => {
    const p0 = { ...makePort(), defined: true, p: { x: 1, y: 1 } };
    expect(portcmp(p0, makePort())).toBeGreaterThan(0);
    expect(portcmp(makePort(), p0)).toBeLessThan(0);
  });

  it('downcandidate returns true for a virtual 1-in/1-out unlabeled node', () => {
    expect(downcandidate(buildDowncandidateNode())).toBe(true);
  });

  it('dotConcentrate returns 0 when maxrank - minrank <= 1', () => {
    const g = makeGraph();
    g.info.rank = [makeRankEntry([makeNode(0, 'n0', g, 0, 0)]), makeRankEntry([makeNode(1, 'n1', g, 1, 0)])];
    g.info.minrank = 0; g.info.maxrank = 1;
    expect(dotConcentrate(g)).toBe(0);
  });

  it('mergeVirtual reduces rank[1].n from 2 to 1', () => {
    const g = buildConcentrateGraph();
    mergeVirtual(g, 1, 0, 1, 0 /* DOWN */);
    expect(g.info.rank![1].n).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 4. edge_normalize reverses splines for back-edges
// ---------------------------------------------------------------------------

describe('swapBezier and swapSpline primitives', () => {
  it('swapBezier reverses control points and swaps flags/endpoints', () => {
    const bz = { list: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], size: 4, sflag: 1, eflag: 2, sp: { x: 10, y: 10 }, ep: { x: 20, y: 20 } };
    swapBezier(bz);
    expect(bz.list[0]).toEqual({ x: 3, y: 3 });
    expect(bz.sflag).toBe(2);
    expect(bz.sp).toEqual({ x: 20, y: 20 });
  });

  it('swapSpline reverses bezier list order', () => {
    const b0 = makeBezier([[0, 0], [3, 3]]);
    const b1 = makeBezier([[10, 0], [13, 3]]);
    const spl = { list: [b0, b1], size: 2, bb: { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } } };
    swapSpline(spl);
    expect(spl.list[0]).toBe(b1);
    expect(spl.list[1]).toBe(b0);
  });

  // Regression: clip can shrink a bezier's real point count (b.size) below
  // its over-allocated list.length, leaving zeroed spare slots calloc'd at
  // the tail (faithful to C's newSpline pre-allocation). C's swap_bezier
  // (dotsplines.c:144-148) reverses only the bounded window list[0..size),
  // via an index-swap loop `for (i = 0; i < sz / 2; ++i) SWAP(list[i],
  // list[sz-1-i])` — it never touches indices >= size. A naive
  // `list.reverse()` over the WHOLE array instead rotates the zeroed spare
  // slots to the front, producing junk (0,0) points in the emitted window
  // and truncating the real curve. See analysis/hub-fanin.md,
  // analysis/2413-vspace.md (Mechanism B).
  it('swapBezier bounds the reverse to [0, size) and leaves spare zeroed tail slots in place', () => {
    const real = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
    const spare = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    const bz = {
      list: [...real, ...spare],
      size: real.length,
      sflag: 1,
      eflag: 2,
      sp: { x: 10, y: 10 },
      ep: { x: 20, y: 20 },
    };

    swapBezier(bz);

    // Emitted window [0, size) must be the reversed REAL points only.
    expect(bz.list.slice(0, bz.size)).toEqual([...real].reverse());
    // Spare zeroed slots must stay at the tail, untouched — not rotated
    // to the front.
    expect(bz.list.slice(bz.size)).toEqual(spare);
    expect(bz.list).toHaveLength(6);
    expect(bz.sflag).toBe(2);
    expect(bz.eflag).toBe(1);
    expect(bz.sp).toEqual({ x: 20, y: 20 });
    expect(bz.ep).toEqual({ x: 10, y: 10 });
  });
});

describe('edgeNormalize — spline reversal for back-edges', () => {
  it('swaps spline for a back-edge (AC-4)', () => {
    const [g, e] = buildBackEdgeGraph();
    expect(swapEndsP(e)).toBe(true);
    edgeNormalize(g);
    expect(e.info.spl!.list[0].list[0].x).toBe(3);
  });

  it('does not swap forward-edge splines', () => {
    const [g, e] = buildFwdEdgeGraph();
    expect(swapEndsP(e)).toBe(false);
    edgeNormalize(g);
    expect(e.info.spl!.list[0].list[0].x).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// edgecmp / setflags / getMainEdge utilities
// ---------------------------------------------------------------------------

describe('edgecmp and setflags', () => {
  it('setflags sets correct tree_index for forward regular edge', () => {
    const g = makeGraph();
    const e = makeEdge(makeNode(0, 'a', g, 0, 0), makeNode(1, 'b', g, 2, 0), g);
    setflags(e, REGULAREDGE, FWDEDGE, MAINGRAPH);
    expect(e.info.tree_index).toBe(REGULAREDGE | FWDEDGE | MAINGRAPH);
  });

  it('edgecmp returns 0 for same edge', () => {
    const g = makeGraph();
    const e = makeEdge(makeNode(0, 'a', g, 0, 0), makeNode(1, 'b', g, 1, 0), g);
    setflags(e, REGULAREDGE, FWDEDGE, MAINGRAPH);
    expect(edgecmp(e, e)).toBe(0);
  });

  it('FLATEDGE sorts before REGULAREDGE', () => {
    const [, flat, reg] = buildEdgeCmpGraph();
    expect(edgecmp(reg, flat)).toBeGreaterThan(0);
  });

  it('getMainEdge follows to_virt then to_orig', () => {
    const g = makeGraph();
    const a = makeNode(0, 'a', g, 0, 0);
    const b = makeNode(1, 'b', g, 2, 0);
    const orig = makeEdge(a, b, g);
    const virt = makeEdge(a, b, g);
    virt.info.to_orig = orig;
    expect(getMainEdge(virt)).toBe(orig);
  });
});
