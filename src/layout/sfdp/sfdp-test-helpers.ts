// SPDX-License-Identifier: EPL-2.0
/**
 * Test helpers for sfdp tests.
 */

import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import {
  SparseMatrix,
  FORMAT_COORD,
  MATRIX_TYPE_REAL,
} from '../../sparse/SparseMatrix.js';

export function addRingNodes(g: Graph, n: number): Node[] {
  const nodes: Node[] = [];
  for (let i = 0; i < n; i++) {
    const nd = new Node(i, `n${i}`, g);
    g.nodes.set(nd.name, nd);
    nodes.push(nd);
  }
  return nodes;
}

export function addRingEdges(g: Graph, nodes: Node[]): void {
  for (let i = 0; i < nodes.length; i++) {
    g.edges.push(new Edge(nodes[i]!, nodes[(i + 1) % nodes.length]!, ''));
  }
}

export function makeRingGraph(n: number): Graph {
  const g = new Graph('ring', 'undirected');
  addRingEdges(g, addRingNodes(g, n));
  return g;
}

export function makeRingMatrix(n: number): SparseMatrix {
  const A = SparseMatrix.new(n, n, n * 2, MATRIX_TYPE_REAL, FORMAT_COORD);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    A.addEntry(i, j, 1.0);
    A.addEntry(j, i, 1.0);
  }
  return A.fromCoordinateFormat();
}
