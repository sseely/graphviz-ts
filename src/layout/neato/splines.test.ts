// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for src/layout/neato/splines.ts
 *
 * Acceptance criteria:
 * 1. EDGETYPE_ORTHO + non-overlapping obstacles → dispatches orthoEdges
 * 2. EDGETYPE_SPLINE → edge gets info.spl set (or straight-line fallback)
 * 3. Self-loop: makeSelfArcs called, produces geometry or does not throw
 * 4. Straight-line fallback: EDGETYPE_LINE → edge.info.spl set
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makePort } from '../../model/edgeInfo.js';
import {
  splineEdges,
  makeObstacle,
  makeSelfArcs,
  makeStraightEdge,
  SINFO,
  EDGETYPE_NONE,
  EDGETYPE_LINE,
  EDGETYPE_SPLINE,
  EDGETYPE_ORTHO,
  EDGETYPE_PLINE,
} from './splines.js';

// ---------------------------------------------------------------------------
// Fixture builder — class wrapper prevents lizard brace-counter confusion
// ---------------------------------------------------------------------------

class Fixture {
  static graph(): Graph {
    return new Graph('test', 'directed');
  }

  static node(g: Graph, name: string, x: number, y: number): Node {
    const n = new Node(g.nodes.size, name, g);
    n.info = makeNodeInfo();
    n.info.coord = { x, y };
    n.info.lw = 36;
    n.info.rw = 36;
    n.info.ht = 36;
    g.nodes.set(name, n);
    return n;
  }

  static edge(g: Graph, tail: Node, head: Node): Edge {
    const e = new Edge(tail, head, '');
    e.info.tail_port = makePort();
    e.info.head_port = makePort();
    g.edges.push(e);
    return e;
  }

  static setEdgetype(g: Graph, et: number): void {
    g.info.flags = (g.info.flags & ~0xf) | (et & 0xf);
  }
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

let g: Graph;
let n1: Node;
let n2: Node;
let e12: Edge;

beforeEach(() => {
  g = Fixture.graph();
  // Place nodes far apart so their obstacles don't overlap
  n1 = Fixture.node(g, 'n1', 0, 0);
  n2 = Fixture.node(g, 'n2', 200, 0);
  e12 = Fixture.edge(g, n1, n2);
});

// ---------------------------------------------------------------------------
// 1. makeObstacle — geometry
// ---------------------------------------------------------------------------

describe('makeObstacle', () => {
  it('produces a 4-vertex polygon around the node', () => {
    const sep = { x: 4, y: 4 };
    const poly = makeObstacle(n1, sep);
    expect(poly.ps).toHaveLength(4);
  });

  it('x extents match lw+sep and rw+sep', () => {
    const sep = { x: 4, y: 4 };
    const poly = makeObstacle(n1, sep);
    const xs = poly.ps.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(n1.info.coord.x - n1.info.lw - sep.x);
    expect(Math.max(...xs)).toBeCloseTo(n1.info.coord.x + n1.info.rw + sep.x);
  });

  it('y extents match ht/2+sep', () => {
    const sep = { x: 4, y: 4 };
    const poly = makeObstacle(n1, sep);
    const ys = poly.ps.map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(n1.info.coord.y - n1.info.ht / 2 - sep.y);
    expect(Math.max(...ys)).toBeCloseTo(n1.info.coord.y + n1.info.ht / 2 + sep.y);
  });
});

// ---------------------------------------------------------------------------
// 2. EDGETYPE_NONE — no routing runs
// ---------------------------------------------------------------------------

describe('splineEdges with EDGETYPE_NONE', () => {
  it('returns without touching edges', () => {
    Fixture.setEdgetype(g, EDGETYPE_NONE);
    splineEdges(g);
    expect(e12.info.spl).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. EDGETYPE_LINE — straight-line fallback
// ---------------------------------------------------------------------------

describe('splineEdges with EDGETYPE_LINE', () => {
  it('installs a spline on the edge', () => {
    Fixture.setEdgetype(g, EDGETYPE_LINE);
    splineEdges(g);
    expect(e12.info.spl).toBeDefined();
  });

  it('sets the spl list with at least one bezier', () => {
    Fixture.setEdgetype(g, EDGETYPE_LINE);
    splineEdges(g);
    expect(e12.info.spl!.list.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. makeStraightEdge — unit test
// ---------------------------------------------------------------------------

describe('makeStraightEdge', () => {
  it('installs an spl on the edge', () => {
    const e = Fixture.edge(g, n1, n2);
    makeStraightEdge(e, SINFO);
    expect(e.info.spl).toBeDefined();
  });

  it('spl has exactly one bezier segment', () => {
    const e = Fixture.edge(g, n1, n2);
    makeStraightEdge(e, SINFO);
    expect(e.info.spl!.list).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 5. EDGETYPE_SPLINE — pathplan routing or straight fallback
// ---------------------------------------------------------------------------

describe('splineEdges with EDGETYPE_SPLINE', () => {
  it('installs a spline on the edge (or straight fallback)', () => {
    Fixture.setEdgetype(g, EDGETYPE_SPLINE);
    splineEdges(g);
    expect(e12.info.spl).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. EDGETYPE_PLINE — polyline routing
// ---------------------------------------------------------------------------

describe('splineEdges with EDGETYPE_PLINE', () => {
  it('installs a spline on the edge', () => {
    Fixture.setEdgetype(g, EDGETYPE_PLINE);
    splineEdges(g);
    expect(e12.info.spl).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 7. EDGETYPE_ORTHO dispatch
// ---------------------------------------------------------------------------

describe('splineEdges with EDGETYPE_ORTHO', () => {
  it('does not throw with non-overlapping nodes', () => {
    Fixture.setEdgetype(g, EDGETYPE_ORTHO);
    expect(() => splineEdges(g)).not.toThrow();
  });

  it('falls back to straight when obstacles overlap', () => {
    // Place n2 on top of n1 → obstacles overlap → not legal → straight fallback
    n2.info.coord = { x: 0, y: 0 };
    Fixture.setEdgetype(g, EDGETYPE_ORTHO);
    splineEdges(g);
    expect(e12.info.spl).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 8. Self-loop: makeSelfArcs
// ---------------------------------------------------------------------------

describe('makeSelfArcs', () => {
  it('does not throw for a self-loop edge', () => {
    const eSelf = Fixture.edge(g, n1, n1);
    expect(() => makeSelfArcs(eSelf, 18)).not.toThrow();
  });

  it('installs a spline on the self-loop edge', () => {
    const eSelf = Fixture.edge(g, n1, n1);
    makeSelfArcs(eSelf, 18);
    expect(eSelf.info.spl).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 9. splineEdges routes a self-loop inside a full graph
// ---------------------------------------------------------------------------

describe('splineEdges self-loop', () => {
  it('installs a spline on a self-loop when edgetype is LINE', () => {
    const eSelf = Fixture.edge(g, n1, n1);
    Fixture.setEdgetype(g, EDGETYPE_LINE);
    splineEdges(g);
    expect(eSelf.info.spl).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 10. nodesep fallback — self-loop stepx defaults to 18 (POINTS(DEFAULT_NODESEP))
//
// C spec: lib/common/input.c line 667
//   GD_nodesep(g) = POINTS(late_double(g, "nodesep", DEFAULT_NODESEP, MIN_NODESEP))
//   DEFAULT_NODESEP = 0.25 inches → POINTS(0.25) = 18
//
// When g.info.nodesep is not set (undefined), RoutingHelper.straight and
// withVconfig must fall back to 18, producing a rightmost spline control
// point at coord.x + rw + 18.
// ---------------------------------------------------------------------------

describe('nodesep default fallback', () => {
  it('self-loop rightmost control point = rw + 18 when nodesep unset', () => {
    // n1 is at coord (0,0), rw=36; expected rightmost x = 0 + 36 + 18 = 54
    const eSelf = Fixture.edge(g, n1, n1);
    Fixture.setEdgetype(g, EDGETYPE_LINE);
    // Confirm nodesep is not set on the graph
    expect(g.info.nodesep).toBeUndefined();
    splineEdges(g);
    const spl = eSelf.info.spl;
    expect(spl).toBeDefined();
    const allX = spl!.list.flatMap((bz) => bz.list.map((p) => p.x));
    const maxX = Math.max(...allX);
    // Tolerance: 1 point; exact value is n1.info.coord.x + n1.info.rw + 18
    expect(maxX).toBeCloseTo(n1.info.coord.x + n1.info.rw + 18, 0);
  });

  it('explicit nodesep=16 produces rightmost x = rw + 16', () => {
    const eSelf = Fixture.edge(g, n1, n1);
    Fixture.setEdgetype(g, EDGETYPE_LINE);
    g.info.nodesep = 16;
    splineEdges(g);
    const spl = eSelf.info.spl;
    expect(spl).toBeDefined();
    const allX = spl!.list.flatMap((bz) => bz.list.map((p) => p.x));
    const maxX = Math.max(...allX);
    expect(maxX).toBeCloseTo(n1.info.coord.x + n1.info.rw + 16, 0);
  });
});
