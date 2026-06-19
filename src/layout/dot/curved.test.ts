// SPDX-License-Identifier: EPL-2.0

/**
 * T1 — dot engine splines=curved routing.
 *
 * Verifies the curved dispatch (dotsplines.c:241-247, 381-387, 461-465) and the
 * makeStraightEdges generator (routespl.c:975-1042):
 *  - a single curved edge installs a bent 4-point bezier (control points pulled
 *    off the straight tail→head line, away from the cycle centroid);
 *  - parallel curved edges spread their control points symmetrically along the
 *    perpendicular (routespl.c:1000-1014);
 *  - curved + edge labels warns but still routes (ADR-3, no downgrade);
 *  - non-curved graphs are unaffected.
 *
 * @see lib/common/routespl.c:933-1042, lib/dotgen/dotsplines.c:241-387
 */

import { it, expect, vi } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
// Import splines.js first so it fully initializes before self-loop.js — the
// dot module graph has a load-order-sensitive top-level call in ortho-adapter
// (buildDotSinfo at module eval) that TDZ-faults if self-loop is entered first.
import { dotSplines_, EDGETYPE_CURVED, EDGETYPE_SPLINE, EDGETYPE_NONE } from './splines.js';
import { EDGE_LABEL } from './rank.js';
import { buildDotSinfo } from './self-loop.js';
import { makeStraightEdges } from './straight-edges.js';
import type { Point } from '../../model/geom.js';

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

/** Two vertically-stacked nodes a→b, with a's out-list populated for routing. */
function twoNodeCurved(flags: number): { g: Graph; e: Edge; a: Node; b: Node } {
  const g = makeGraph(flags);
  const a = makeNode(0, 'a', g, 0, 90);
  const b = makeNode(1, 'b', g, 0, 0);
  const e = makeEdge(a, b, g);
  a.info.out = { list: [e], size: 1 };
  return { g, e, a, b };
}

/** All control points of the first bezier installed on edge e. */
function ctrlPoints(e: Edge): Point[] {
  return e.info.spl!.list[0]!.list;
}

const minX = (pts: Point[]) => Math.min(...pts.map((p) => p.x));
const maxX = (pts: Point[]) => Math.max(...pts.map((p) => p.x));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// NOTE: top-level it() (no describe wrapper) — the complexity hook measures a
// describe callback as one function and a 6-test block exceeds the 30-line cap.

it('curved: bends a single edge off the straight line relative to the centroid', () => {
  const { g, e } = twoNodeCurved(EDGETYPE_CURVED);
  // Centroid off the x=0 axis (bbox center at x=150) so bend() moves the
  // interior control points to x<0 (away from the centroid, per routespl.c).
  g.info.bb = { ll: { x: 100, y: 0 }, ur: { x: 200, y: 90 } };

  const rc = dotSplines_(g, true);
  expect(rc).toBe(0);

  expect(e.info.spl).toBeDefined();
  const spl = e.info.spl!;
  expect(spl.list.length).toBe(1); // single bezier, not a multi-segment route
  const bz = spl.list[0]!;
  expect(bz.list.length).toBe(4); // cubic bezier
  // Bent: the curve bulges to negative x (a straight vertical route is x≈0).
  expect(minX(bz.list)).toBeLessThan(-1);
});

it('curved: routes straight when the centroid is on the tail→head axis', () => {
  const { g, e } = twoNodeCurved(EDGETYPE_CURVED);
  // Default bbox centroid (0,0) lies on the x=0 axis: bend leaves x unchanged.
  g.info.bb = { ll: { x: -10, y: 0 }, ur: { x: 10, y: 90 } };
  dotSplines_(g, true);
  const pts = ctrlPoints(e);
  // No horizontal bulge: every control point stays on x≈0.
  expect(Math.abs(minX(pts))).toBeLessThan(1);
  expect(Math.abs(maxX(pts))).toBeLessThan(1);
});

it('curved: spreads parallel edges symmetrically along the perpendicular', () => {
  // Drive makeStraightEdges directly with a 3-edge group (the dot pipeline
  // merges parallels into one main edge before this point; here we supply the
  // group explicitly to exercise the perp-spread at routespl.c:1000-1014).
  const g = makeGraph(EDGETYPE_CURVED);
  const a = makeNode(0, 'a', g, 0, 90);
  const b = makeNode(1, 'b', g, 0, 0);
  const e0 = makeEdge(a, b, g);
  const e1 = makeEdge(a, b, g);
  const e2 = makeEdge(a, b, g);

  makeStraightEdges(g, [e0, e1, e2], 3, EDGETYPE_CURVED, buildDotSinfo());

  for (const e of [e0, e1, e2]) expect(e.info.spl).toBeDefined();
  const p0 = ctrlPoints(e0);
  const p1 = ctrlPoints(e1);
  const p2 = ctrlPoints(e2);
  // Middle edge runs straight (x≈0); the outer two bulge to opposite sides.
  expect(Math.abs(maxX(p1))).toBeLessThan(1);
  expect(Math.abs(minX(p1))).toBeLessThan(1);
  expect(maxX(p0)).toBeGreaterThan(1); // bulges +x
  expect(minX(p2)).toBeLessThan(-1); // bulges -x
  // Symmetric spread: the two outer bulges mirror about x=0.
  expect(maxX(p0)).toBeCloseTo(-minX(p2), 5);
});

it('curved: warns but still routes with edge labels (ADR-3, no downgrade)', () => {
  const { g, e } = twoNodeCurved(EDGETYPE_CURVED);
  g.root.info.has_labels = EDGE_LABEL;
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  const rc = dotSplines_(g, true);

  expect(rc).toBe(0);
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('splines=curved not supported'),
  );
  expect(e.info.spl).toBeDefined(); // still routed (not downgraded/skipped)
  warn.mockRestore();
});

it('curved: leaves non-curved graphs on the regular path', () => {
  // EDGETYPE_NONE returns 0 immediately, no spline installed.
  const none = twoNodeCurved(EDGETYPE_NONE);
  expect(dotSplines_(none.g, true)).toBe(0);
  expect(none.e.info.spl).toBeUndefined();

  // EDGETYPE_SPLINE takes the regular router (no curved branch, no throw).
  const spline = twoNodeCurved(EDGETYPE_SPLINE);
  expect(() => dotSplines_(spline.g, true)).not.toThrow();
});

it('curved: is deterministic — two runs install identical control points', () => {
  const r1 = twoNodeCurved(EDGETYPE_CURVED);
  const r2 = twoNodeCurved(EDGETYPE_CURVED);
  r1.g.info.bb = { ll: { x: 100, y: 0 }, ur: { x: 200, y: 90 } };
  r2.g.info.bb = { ll: { x: 100, y: 0 }, ur: { x: 200, y: 90 } };
  dotSplines_(r1.g, true);
  dotSplines_(r2.g, true);
  const key = (e: Edge) => ctrlPoints(e).map((p) => `${p.x},${p.y}`).join(' ');
  expect(key(r1.e)).toBe(key(r2.e));
});
