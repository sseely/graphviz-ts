// SPDX-License-Identifier: EPL-2.0

/**
 * Shared test fixtures for twopi layout tests.
 * Kept in a separate file so lizard does not conflate helper function spans
 * with the describe() callbacks that follow them in the test file.
 */

import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';

let _id = 0;

export function h_node(g: Graph, name: string): Node {
  const n = new Node(_id++, name, g);
  n.info = makeNodeInfo();
  n.info.lw = 18; n.info.rw = 18; n.info.ht = 18;
  g.nodes.set(name, n);
  return n;
}

export function h_edge(g: Graph, t: Node, h: Node): void {
  g.edges.push(new Edge(t, h, `${t.name}-${h.name}`));
}

export function makeStar(leaves: number): Graph {
  _id = 0;
  const g = new Graph('star', 'undirected');
  const hub = h_node(g, 'hub');
  for (let i = 0; i < leaves; i++) h_edge(g, hub, h_node(g, `l${i}`));
  return g;
}

export function makeTwoTriangles(): Graph {
  _id = 0;
  const g = new Graph('two-tri', 'undirected');
  const a = h_node(g, 'a'); const b = h_node(g, 'b'); const c = h_node(g, 'c');
  h_edge(g, a, b); h_edge(g, b, c); h_edge(g, c, a);
  const d = h_node(g, 'd'); const e = h_node(g, 'e'); const f = h_node(g, 'f');
  h_edge(g, d, e); h_edge(g, e, f); h_edge(g, f, d);
  return g;
}
