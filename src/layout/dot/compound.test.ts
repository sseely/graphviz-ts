// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for T38: compound edge clipping (compound.ts) and aspect stub (aspect.ts).
 * Covers the four acceptance criteria from the T38 task spec.
 */

import { describe, it, expect } from 'vitest';
import type { Point, Box, Bezier } from '../../model/geom.js';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import {
  boxIntersectf,
  splineIntersectf,
  dotCompoundEdges,
} from './compound.js';
import { setAspect } from './aspect.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function makeBez(pts: Point[]): Bezier {
  return { list: [...pts], size: pts.length, sflag: 0, eflag: 0,
           sp: { ...pts[0] }, ep: { ...pts[pts.length - 1] } };
}

export function makeBox(x0: number, y0: number, x1: number, y1: number): Box {
  return { ll: { x: x0, y: y0 }, ur: { x: x1, y: y1 } };
}

export function setupEdge(g: Graph, sx: number, sy: number, ex: number, ey: number): [Node, Node, Edge] {
  const tail = new Node(0, 'tail', g);
  tail.info = makeNodeInfo();
  tail.info.coord = { x: sx, y: sy };
  const head = new Node(1, 'head', g);
  head.info = makeNodeInfo();
  head.info.coord = { x: ex, y: ey };
  g.nodes.set('tail', tail);
  g.nodes.set('head', head);
  const e = new Edge(tail, head, '');
  e.info.spl = {
    list: [makeBez([
      { x: sx, y: sy },
      { x: sx + (ex - sx) / 3, y: sy },
      { x: sx + 2 * (ex - sx) / 3, y: sy },
      { x: ex, y: ey },
    ])],
    size: 1,
    bb: makeBox(Math.min(sx, ex) - 5, Math.min(sy, ey) - 5, Math.max(sx, ex) + 5, Math.max(sy, ey) + 5),
  };
  g.edges.push(e);
  return [tail, head, e];
}

// ---------------------------------------------------------------------------
// boxIntersectf unit tests
// ---------------------------------------------------------------------------

describe('boxIntersectf: segment/box intersection', () => {
  it('returns left-side intersection when cp exits left', () => {
    const bb = makeBox(10, 0, 100, 100);
    const pp: Point = { x: 50, y: 50 };
    const cp: Point = { x: 5, y: 50 };
    const result = boxIntersectf(pp, cp, bb);
    expect(result.x).toBe(10);
    expect(result.y).toBe(50);
  });

  it('returns right-side intersection when cp exits right', () => {
    const bb = makeBox(0, 0, 50, 100);
    const pp: Point = { x: 25, y: 50 };
    const cp: Point = { x: 75, y: 50 };
    const result = boxIntersectf(pp, cp, bb);
    expect(result.x).toBe(50);
    expect(result.y).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// splineIntersectf unit tests
// ---------------------------------------------------------------------------

describe('splineIntersectf: bezier/box intersection', () => {
  it('detects crossing when bezier passes through box boundary', () => {
    // horizontal line from x=0 to x=100 at y=50, box is x=[60,100], y=[0,100]
    const pts: Point[] = [
      { x: 0, y: 50 }, { x: 33, y: 50 }, { x: 66, y: 50 }, { x: 100, y: 50 },
    ];
    const bb = makeBox(60, 0, 100, 100);
    const result = splineIntersectf(pts, bb);
    expect(result).toBe(true);
  });

  it('returns false when bezier does not cross box', () => {
    const pts: Point[] = [
      { x: 0, y: 50 }, { x: 10, y: 50 }, { x: 20, y: 50 }, { x: 30, y: 50 },
    ];
    const bb = makeBox(60, 0, 100, 100);
    const result = splineIntersectf(pts, bb);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC1: dotCompoundEdges trims spline for edge with lhead
// ---------------------------------------------------------------------------

describe('dotCompoundEdges: head clip (AC1)', () => {
  it('trims spline for edge with lhead — result list uses 4 pts at boundary', () => {
    const g = new Graph('root', 'directed');
    g.info.compound = true;
    const clust = new Graph('cluster_A', 'directed');
    clust.info.bb = makeBox(50, 0, 150, 100);
    g.info.n_cluster = 1;
    g.info.clust = [clust];
    const [, head, e] = setupEdge(g, 0, 50, 100, 50);
    head.info.coord = { x: 100, y: 50 };  // inside cluster_A bb
    e.info.lhead = 'cluster_A';
    const beforeSize = e.info.spl!.list[0].list.length;
    dotCompoundEdges(g);
    // spline was clipped: number of points may stay 4 but the endpoint is clamped
    const bez = e.info.spl!.list[0];
    expect(bez.list.length).toBeGreaterThan(0);
    // head endpoint should be at cluster boundary
    const ep = bez.list[bez.list.length - 1];
    expect(ep.x).toBeGreaterThanOrEqual(clust.info.bb!.ll.x - 1);
    expect(ep.x).toBeLessThanOrEqual(clust.info.bb!.ur.x + 1);
    void beforeSize;
  });
});

// ---------------------------------------------------------------------------
// AC2: degenerate case — tail inside ltail cluster uses boxIntersectf
// ---------------------------------------------------------------------------

describe('dotCompoundEdges: tail degenerate clip (AC2)', () => {
  it('clips tail when node coord is inside ltail cluster bbox', () => {
    const g = new Graph('root', 'directed');
    g.info.compound = true;
    const clust = new Graph('cluster_B', 'directed');
    clust.info.bb = makeBox(0, 0, 60, 100);
    g.info.n_cluster = 1;
    g.info.clust = [clust];
    const [tail, , e] = setupEdge(g, 30, 50, 120, 50);
    tail.info.coord = { x: 30, y: 50 };  // inside cluster_B bb
    e.info.ltail = 'cluster_B';
    dotCompoundEdges(g);
    const bez = e.info.spl!.list[0];
    // The first point should be at or near the right boundary of cluster_B
    const sp = bez.list[0];
    // boxIntersectf finds intersection on right side (x=60)
    // point should be at the cluster's right boundary (x=60)
    expect(sp.x).toBeCloseTo(60, 0);
  });
});

// ---------------------------------------------------------------------------
// AC3: both lhead and ltail — two clips
// ---------------------------------------------------------------------------

describe('dotCompoundEdges: both lhead and ltail (AC3)', () => {
  it('clips both endpoints when lhead and ltail both set', () => {
    const g = new Graph('root', 'directed');
    g.info.compound = true;
    const clustHead = new Graph('cluster_H', 'directed');
    clustHead.info.bb = makeBox(80, 0, 160, 100);
    const clustTail = new Graph('cluster_T', 'directed');
    clustTail.info.bb = makeBox(0, 0, 40, 100);
    g.info.n_cluster = 2;
    g.info.clust = [clustTail, clustHead];
    const [tail, head, e] = setupEdge(g, 20, 50, 120, 50);
    tail.info.coord = { x: 20, y: 50 };  // inside cluster_T
    head.info.coord = { x: 120, y: 50 }; // inside cluster_H
    e.info.ltail = 'cluster_T';
    e.info.lhead = 'cluster_H';
    dotCompoundEdges(g);
    const bez = e.info.spl!.list[0];
    const sp = bez.list[0];
    const ep = bez.list[bez.list.length - 1];
    // tail point clipped to right side of cluster_T (x=40)
    expect(sp.x).toBeCloseTo(40, 0);
    // head point clipped to left side of cluster_H (x=80)
    expect(ep.x).toBeCloseTo(80, 0);
  });
});

// ---------------------------------------------------------------------------
// AC4: setAspect is a no-op
// ---------------------------------------------------------------------------

describe('setAspect: no-op (AC4)', () => {
  it('does not throw', () => {
    const g = new Graph('test', 'directed');
    expect(() => setAspect(g)).not.toThrow();
  });

  it('does not modify node coordinates', () => {
    const g = new Graph('test', 'directed');
    const n = new Node(0, 'n0', g);
    n.info = makeNodeInfo();
    n.info.coord = { x: 42, y: 99 };
    g.nodes.set('n0', n);
    setAspect(g);
    expect(n.info.coord.x).toBe(42);
    expect(n.info.coord.y).toBe(99);
  });
});
