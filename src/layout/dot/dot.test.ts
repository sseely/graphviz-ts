// SPDX-License-Identifier: EPL-2.0

/**
 * Integration tests for the dot layout pipeline entry point (T39).
 *
 * AC1: dotLayoutEntry on an empty graph does not throw.
 * AC2: Attribute parsing — GraphInfo / EdgeInfo fields are set correctly.
 * AC3: DOT_LAYOUT_ENGINE.type === 'dot'.
 * AC4: A→B→C chain with maxphase=3 (TB): y(A) > y(B) > y(C).
 * AC5: virtualNode geometry: lw=rw=ht=UF_size=1.
 * AC6: minlen=2 edge produces correct node positions and compound spline.
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
import { NORMAL, VIRTUAL, virtualNode } from './fastgr.js';
import {
  DOT_LAYOUT_ENGINE,
  dotLayoutEntry,
  dotLayoutPipeline,
  dotInitNode,
  dotInitEdge,
  dotInitSubg,
  dotGraphInit,
} from './index.js';
import { parse } from '../../parser/index.js';

// ---------------------------------------------------------------------------
// Graph builder helpers
// ---------------------------------------------------------------------------

export function makeGraph(name: string): Graph {
  return new Graph(name, 'directed');
}

export function addNode(g: Graph, id: number, nm: string): Node {
  const n = new Node(id, nm, g);
  n.info = makeNodeInfo();
  g.nodes.set(nm, n);
  return n;
}

/**
 * Adds an edge to the graph. The fast graph (in/out lists) is built by
 * class1 during the rank phase — pre-installing raw edges there would
 * make class1's findFastEdge return the edge itself and self-merge.
 */
export function addEdge(g: Graph, tail: Node, head: Node): Edge {
  const e = new Edge(tail, head, '');
  e.info = makeEdgeInfo(makePort(), makePort());
  g.edges.push(e);
  return e;
}

/** Build a three-node A→B→C chain graph stopping at maxphase=3. */
export function makeChainGraph(): [Graph, Node, Node, Node] {
  const g = makeGraph('chain');
  g.attrs.set('maxphase', '3');
  const nodeA = addNode(g, 0, 'A');
  const nodeB = addNode(g, 1, 'B');
  const nodeC = addNode(g, 2, 'C');
  addEdge(g, nodeA, nodeB);
  addEdge(g, nodeB, nodeC);
  return [g, nodeA, nodeB, nodeC];
}

// ---------------------------------------------------------------------------
// AC1: empty graph
// ---------------------------------------------------------------------------

describe('dotLayoutEntry: empty graph', () => {
  it('does not throw on a graph with no nodes', () => {
    const g = makeGraph('empty');
    expect(() => dotLayoutEntry(g)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC2: attribute parsing
// ---------------------------------------------------------------------------

describe('dotInitSubg: graph attribute defaults', () => {
  it('sets nodesep to 18 pts and ranksep to 36 pts when unset', () => {
    const g = makeGraph('attrs');
    dotInitSubg(g);
    expect(g.info.nodesep).toBe(18);
    expect(g.info.ranksep).toBe(36);
  });

  it('preserves caller-set nodesep and ranksep', () => {
    const g = makeGraph('preset');
    g.info.nodesep = 36;
    g.info.ranksep = 72;
    dotInitSubg(g);
    expect(g.info.nodesep).toBe(36);
    expect(g.info.ranksep).toBe(72);
  });
});

// ---------------------------------------------------------------------------
// AC2b: dotGraphInit parses nodesep/ranksep attrs (input.c:665-681)
// ---------------------------------------------------------------------------

describe('dotGraphInit: nodesep/ranksep attribute parsing', () => {
  it('absent attrs → POINTS(defaults) = nodesep 18, ranksep 36', () => {
    const g = makeGraph('sep-default');
    dotGraphInit(g);
    expect(g.info.nodesep).toBe(18);
    expect(g.info.ranksep).toBe(36);
    expect(g.info.exact_ranksep).toBeFalsy();
  });

  it('ranksep=1.0 → POINTS(1.0) = 72', () => {
    const g = makeGraph('rs1');
    g.attrs.set('ranksep', '1.0');
    dotGraphInit(g);
    expect(g.info.ranksep).toBe(72);
    expect(g.info.exact_ranksep).toBeFalsy();
  });

  it('nodesep=0.5 → POINTS(0.5) = 36', () => {
    const g = makeGraph('ns');
    g.attrs.set('nodesep', '0.5');
    dotGraphInit(g);
    expect(g.info.nodesep).toBe(36);
  });

  it('ranksep="0.75 equally" → 54 pts and exact_ranksep flag', () => {
    const g = makeGraph('rs-eq');
    g.attrs.set('ranksep', '0.75 equally');
    dotGraphInit(g);
    expect(g.info.ranksep).toBe(54);
    expect(g.info.exact_ranksep).toBe(true);
  });

  it('ranksep="equally" (no number) → DEFAULT 36 + exact_ranksep', () => {
    const g = makeGraph('rs-eq-only');
    g.attrs.set('ranksep', 'equally');
    dotGraphInit(g);
    expect(g.info.ranksep).toBe(36);
    expect(g.info.exact_ranksep).toBe(true);
  });

  it('ranksep below MIN_RANKSEP (0.02) is clamped: 0.001 → POINTS(0.02) = 1', () => {
    const g = makeGraph('rs-min');
    g.attrs.set('ranksep', '0.001');
    dotGraphInit(g);
    expect(g.info.ranksep).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AC2c: dotGraphInit populates drawing for ratio=compress only (input.c:576,694)
// ---------------------------------------------------------------------------

describe('dotGraphInit: ratio=compress → g.info.drawing', () => {
  it('ratio=compress + size="16,10" → drawing with size in points', () => {
    const g = makeGraph('rc');
    g.attrs.set('ratio', 'compress');
    g.attrs.set('size', '16,10');
    dotGraphInit(g);
    expect(g.info.drawing?.ratioKind).toBe('compress');
    expect(g.info.drawing?.size).toEqual({ x: 1152, y: 720 }); // POINTS(16),POINTS(10)
  });

  it('ratio=compress, square size="5" → square points', () => {
    const g = makeGraph('rcsq');
    g.attrs.set('ratio', 'compress');
    g.attrs.set('size', '5');
    dotGraphInit(g);
    expect(g.info.drawing?.size).toEqual({ x: 360, y: 360 });
  });

  it('ratio=fill → drawing stays undefined (deferred, ADR-1)', () => {
    const g = makeGraph('rf');
    g.attrs.set('ratio', 'fill');
    g.attrs.set('size', '16,10');
    dotGraphInit(g);
    expect(g.info.drawing).toBeUndefined();
  });

  it('ratio=auto → drawing stays undefined (no-op by omission)', () => {
    const g = makeGraph('ra');
    g.attrs.set('ratio', 'auto');
    dotGraphInit(g);
    expect(g.info.drawing).toBeUndefined();
  });

  it('no ratio attr → drawing stays undefined', () => {
    const g = makeGraph('nr');
    dotGraphInit(g);
    expect(g.info.drawing).toBeUndefined();
  });

  it('ratio=compress with no size → drawing.size is {0,0} (compress no-ops)', () => {
    const g = makeGraph('rcns');
    g.attrs.set('ratio', 'compress');
    dotGraphInit(g);
    expect(g.info.drawing?.ratioKind).toBe('compress');
    expect(g.info.drawing?.size).toEqual({ x: 0, y: 0 });
  });
});

describe('dotInitNode: node geometry and edge list defaults', () => {
  it('initialises UF_size, edge lists, geometry, and node_type', () => {
    const g = makeGraph('ninfo');
    const n = addNode(g, 0, 'a');
    dotInitNode(n);
    expect(n.info.UF_size).toBe(1);
    expect(n.info.in).toEqual({ list: [], size: 0 });
    expect(n.info.out).toEqual({ list: [], size: 0 });
    expect(n.info.lw).toBe(27);
    expect(n.info.rw).toBe(27);
    expect(n.info.ht).toBe(36);
    expect(n.info.node_type).toBe(NORMAL);
  });
});

describe('dotInitEdge: edge field defaults and pre-set values', () => {
  it('sets weight, count, xpenalty, minlen to 1 by default', () => {
    const g = makeGraph('einfo');
    const a = addNode(g, 0, 'a');
    const b = addNode(g, 1, 'b');
    const e = addEdge(g, a, b);
    dotInitEdge(e);
    expect(e.info.weight).toBe(1);
    expect(e.info.count).toBe(1);
    expect(e.info.xpenalty).toBe(1);
    expect(e.info.minlen).toBe(1);
  });

  it('respects pre-set weight=2; minlen is driven by attrs not pre-set info', () => {
    // C: ED_weight uses e.info.weight ?? 1 (pre-set preserved for weight)
    // C: ED_minlen = late_int(e, E_minlen, 1, 0) — always reads attr, not info
    // So a pre-set e.info.minlen without a matching attr is overwritten to default 1.
    const g = makeGraph('presetedge');
    const a = addNode(g, 0, 'a');
    const b = addNode(g, 1, 'b');
    const e = addEdge(g, a, b);
    e.info.weight = 2;
    e.info.minlen = 2;
    dotInitEdge(e);
    expect(e.info.weight).toBe(2);
    expect(e.info.minlen).toBe(1); // no attr → late_int default = 1
  });
});

// ---------------------------------------------------------------------------
// AC3: engine registration
// ---------------------------------------------------------------------------

describe('DOT_LAYOUT_ENGINE', () => {
  it('has type === "dot"', () => {
    expect(DOT_LAYOUT_ENGINE.type).toBe('dot');
  });

  it('exposes layout and cleanup functions', () => {
    expect(typeof DOT_LAYOUT_ENGINE.layout).toBe('function');
    expect(typeof DOT_LAYOUT_ENGINE.cleanup).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// AC4: A→B→C chain — after dotPosition, y(A) > y(B) > y(C)
// ---------------------------------------------------------------------------

describe('dotLayoutPipeline: A→B→C chain coordinate ordering', () => {
  it('assigns y(A) > y(B) > y(C) for a three-node TB chain', () => {
    const [g, nodeA, nodeB, nodeC] = makeChainGraph();
    dotLayoutPipeline(g);
    // In dot TB layout rank-0 nodes sit highest (largest y in point coords).
    // A→B→C means A is rank 0, B rank 1, C rank 2 → y(A) > y(B) > y(C).
    expect(nodeA.info.coord.y).toBeGreaterThan(nodeB.info.coord.y);
    expect(nodeB.info.coord.y).toBeGreaterThan(nodeC.info.coord.y);
  });
});

// ---------------------------------------------------------------------------
// AC5: virtualNode geometry initialisation
// @see lib/dotgen/fastgr.c:virtual_node
// ---------------------------------------------------------------------------

describe('virtualNode: geometry initialisation', () => {
  it('sets lw=rw=ht=UF_size=1 and node_type=VIRTUAL', () => {
    const g = makeGraph('vn');
    const vn = virtualNode(g);
    // C: ND_lw(n) = ND_rw(n) = 1; ND_ht(n) = 1; ND_UF_size(n) = 1
    expect(vn.info.lw).toBe(1);
    expect(vn.info.rw).toBe(1);
    expect(vn.info.ht).toBe(1);
    expect(vn.info.UF_size).toBe(1);
    expect(vn.info.node_type).toBe(VIRTUAL);
  });
});

// ---------------------------------------------------------------------------
// AC6: minlen=2 produces correct positions and compound spline
// Ground truth from C oracle (.probes/dot-minlen-oracle.c).
// @see lib/dotgen/dotsplines.c:make_regular_edge (hackflag forward path)
// ---------------------------------------------------------------------------

const MINLEN_DOT = 'digraph G { A -> B [minlen=2]; B -> C; A -> C; }';

/** Find the first out-edge from `fromName` to `toName` after layout. */
function findEdgeSpline(fromName: string, toName: string, dot: string) {
  const g = parse(dot);
  dotLayoutEntry(g);
  const src = g.nodes.get(fromName)!;
  for (const e of src.outEdges(g)) {
    if (e.head.name === toName) return { g, bz: e.info.spl?.list[0] };
  }
  return { g, bz: undefined };
}

describe('dotLayoutEntry: minlen=2 node positions', () => {
  it('places A, B, C at C-oracle positions', () => {
    const g = parse(MINLEN_DOT);
    dotLayoutEntry(g);
    const A = g.nodes.get('A')!;
    const B = g.nodes.get('B')!;
    const C = g.nodes.get('C')!;
    expect(A.info.coord).toMatchObject({ x: expect.closeTo(62, 0), y: expect.closeTo(199, 0) });
    expect(B.info.coord).toMatchObject({ x: expect.closeTo(27, 0), y: expect.closeTo(90, 0) });
    expect(C.info.coord).toMatchObject({ x: expect.closeTo(54, 0), y: expect.closeTo(18, 0) });
  });
});

describe('dotLayoutEntry: minlen=2 compound-spline routing', () => {
  it('routes A→C via 7 bezier pts (compound, 2-rank span)', () => {
    const { bz } = findEdgeSpline('A', 'C', MINLEN_DOT);
    // A→C spans ranks 0→3 via 2 virtual nodes → 7 control points.
    // A 4-point result signals the compound path was not triggered.
    expect(bz).toBeDefined();
    expect(bz!.size).toBe(7);
  });

  it('intermediate rank[1] has ht1=ht2=0.5 (virtual-node row)', () => {
    const g = parse(MINLEN_DOT);
    dotLayoutEntry(g);
    const rk1 = g.info.rank?.[1];
    expect(rk1?.ht1).toBeCloseTo(0.5, 5);
    expect(rk1?.ht2).toBeCloseTo(0.5, 5);
  });
});
