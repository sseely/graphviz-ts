// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the straight-run chain helpers used by smode segmentation:
 * `straightLen` (run length of a collinear virtual-node chain) and
 * `straightPath` (advance N head-out hops + emit the straight middle as two
 * duplicate control points).
 *
 * @see lib/dotgen/dotsplines.c:straight_len
 * @see lib/dotgen/dotsplines.c:straight_path
 */

import { it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
import type { Point } from '../../model/geom.js';
import { VIRTUAL, NORMAL } from './fastgr.js';
import { straightLen, straightPath } from './splines-route.js';

// ---------------------------------------------------------------------------
// Fixture: a linear chain of nodes with single-in/single-out wiring.
// ---------------------------------------------------------------------------

interface NodeSpec {
  name: string;
  type: number; // NORMAL | VIRTUAL
  cx: number;
}

function makeNode(id: number, spec: NodeSpec, g: Graph): Node {
  const n = new Node(id, spec.name, g);
  n.info = makeNodeInfo();
  n.info.node_type = spec.type;
  n.info.coord = { x: spec.cx, y: 0 };
  return n;
}

/**
 * Wire a→b as a single edge, appending to a.out and b.in so `straightNext`
 * and the size==1 continuation checks see exactly one in/out edge per node.
 */
function link(tail: Node, head: Node, g: Graph): Edge {
  const e = new Edge(tail, head, '');
  e.info = makeEdgeInfo(makePort(), makePort());
  if (!tail.info.out) tail.info.out = { list: [], size: 0 };
  if (!head.info.in) head.info.in = { list: [], size: 0 };
  tail.info.out.list.push(e);
  tail.info.out.size++;
  head.info.in.list.push(e);
  head.info.in.size++;
  g.edges.push(e);
  return e;
}

/**
 * Build chain n0→n1→…→n_{k} from specs and return the nodes plus the
 * tail→head edges in order. specs[0] is the anchor.
 */
function buildChain(specs: NodeSpec[]): { nodes: Node[]; edges: Edge[] } {
  const g = new Graph('g', 'directed');
  const nodes = specs.map((s, i) => makeNode(i + 1, s, g));
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length - 1; i++) edges.push(link(nodes[i], nodes[i + 1], g));
  return { nodes, edges };
}

const V = (name: string, cx: number): NodeSpec => ({ name, type: VIRTUAL, cx });
const N = (name: string, cx: number): NodeSpec => ({ name, type: NORMAL, cx });

// ---------------------------------------------------------------------------
// straightLen — pin the existing behavior
// ---------------------------------------------------------------------------

it('straightLen counts a collinear virtual run terminated by a normal node', () => {
  // anchor v0 (x=82) → v1,v2,v3 virtual collinear (x=82) → head normal
  const { nodes } = buildChain([
    V('v0', 82), V('v1', 82), V('v2', 82), V('v3', 82), N('head', 82),
  ]);
  expect(straightLen(nodes[0])).toBe(3);
});

it('straightLen stops at the first node whose x differs from the anchor', () => {
  const { nodes } = buildChain([
    V('v0', 82), V('v1', 82), V('v2', 99), V('v3', 82), N('head', 82),
  ]);
  expect(straightLen(nodes[0])).toBe(1);
});

it('straightLen stops at a node that is not single-in/single-out', () => {
  const { nodes } = buildChain([V('v0', 82), V('v1', 82), V('v2', 82), N('head', 82)]);
  // give v2 a second out edge → out.size becomes 2 → run stops before v2
  nodes[2].info.out!.list.push(new Edge(nodes[2], nodes[1], ''));
  nodes[2].info.out!.size++;
  expect(straightLen(nodes[0])).toBe(1);
});

it('straightLen returns 0 when the immediate successor is a normal node', () => {
  const { nodes } = buildChain([V('v0', 82), N('head', 82)]);
  expect(straightLen(nodes[0])).toBe(0);
});

// ---------------------------------------------------------------------------
// straightPath — advance cnt hops, append two duplicate points
// ---------------------------------------------------------------------------

it('straightPath appends two copies of the last point and grows length by 2', () => {
  const { edges } = buildChain([V('a', 0), V('v1', 0), V('v2', 0), N('h', 0)]);
  const last: Point = { x: 82, y: 360 };
  const pts: Point[] = [{ x: 10, y: 20 }, last];
  straightPath(edges[0], 1, pts);
  expect(pts.length).toBe(4);
  expect(pts[2]).toEqual(last);
  expect(pts[3]).toEqual(last);
});

it('straightPath appends value-copies (not aliases) of the prior last point', () => {
  const { edges } = buildChain([V('a', 0), V('v1', 0), N('h', 0)]);
  const pts: Point[] = [{ x: 5, y: 6 }];
  straightPath(edges[0], 1, pts);
  pts[1].x = 999; // mutating the appended copy must not corrupt the original
  expect(pts[0]).toEqual({ x: 5, y: 6 });
  expect(pts[2]).toEqual({ x: 5, y: 6 });
});

it('straightPath returns the edge cnt head-out hops downstream (cnt=2 → tail v2)', () => {
  // chain a→v1→v2→v3→h; straightPath(a→v1, 2) returns v2→v3
  const { nodes, edges } = buildChain([
    V('a', 0), V('v1', 0), V('v2', 0), V('v3', 0), N('h', 0),
  ]);
  const f = straightPath(edges[0], 2, [{ x: 0, y: 0 }]);
  expect(f.tail).toBe(nodes[2]); // v2
  expect(f.head).toBe(nodes[3]); // v3
});

it('straightPath returns the same edge when cnt=0 and still appends two points', () => {
  const { edges } = buildChain([V('a', 0), N('h', 0)]);
  const pts: Point[] = [{ x: 7, y: 8 }];
  const f = straightPath(edges[0], 0, pts);
  expect(f).toBe(edges[0]);
  expect(pts.length).toBe(3);
});
