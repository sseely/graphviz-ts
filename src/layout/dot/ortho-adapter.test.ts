// SPDX-License-Identifier: EPL-2.0
/**
 * T13 fix 2 (corpus 1856) — buildOrthoGraph must plumb compass-port offsets
 * (ED_tail_port.p / ED_head_port.p) into OrthoEdge.tailPoint/headPoint so
 * ortho's buildSpline (src/ortho/index.ts) anchors attach points at
 * ND_coord ± port.p instead of always the node bb centre.
 *
 * @see lib/ortho/ortho.c:1075-1076 (attachOrthoEdges)
 * @see src/layout/dot/ortho-adapter.ts:buildEdges
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
import { buildOrthoGraph } from './ortho-adapter.js';

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

describe('ortho-adapter — buildOrthoGraph tailPoint/headPoint (1856 fix)', () => {
  it('offsets tailPoint/headPoint by the edge\'s compass port when set', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(0, 'a', g, 0, 90);
    const b = makeNode(1, 'b', g, 0, 0);
    const e = new Edge(a, b, '');
    e.info = makeEdgeInfo(makePort(), makePort());
    // tailport=s (below centre): p = {0, -18}; headport=n (above centre): p = {0, 18}
    e.info.tail_port.p = { x: 0, y: -18 };
    e.info.tail_port.defined = true;
    e.info.head_port.p = { x: 0, y: 18 };
    e.info.head_port.defined = true;
    g.edges.push(e);

    const og = buildOrthoGraph(g);
    expect(og.edges.length).toBe(1);
    expect(og.edges[0].tailPoint).toEqual({ x: 0, y: 90 - 18 });
    expect(og.edges[0].headPoint).toEqual({ x: 0, y: 0 + 18 });
  });

  it('reproduces the port-less case bit-for-bit: offset {0,0} equals ND_coord', () => {
    const g = new Graph('g', 'directed');
    const a = makeNode(0, 'a', g, 5, 90);
    const b = makeNode(1, 'b', g, 5, 0);
    const e = new Edge(a, b, '');
    e.info = makeEdgeInfo(makePort(), makePort()); // default port.p = {0, 0}
    g.edges.push(e);

    const og = buildOrthoGraph(g);
    expect(og.edges[0].tailPoint).toEqual({ x: 5, y: 90 });
    expect(og.edges[0].headPoint).toEqual({ x: 5, y: 0 });
  });
});
