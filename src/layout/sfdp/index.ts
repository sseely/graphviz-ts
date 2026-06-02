// SPDX-License-Identifier: EPL-2.0
/**
 * sfdp entry point.
 * @see lib/sfdpgen/sfdpinit.c:sfdp_layout
 */

import type { Graph } from '../../model/graph.js';
import type { LayoutEngine } from '../../gvc/context.js';
import {
  SparseMatrix,
  FORMAT_COORD,
  MATRIX_TYPE_REAL,
} from '../../sparse/SparseMatrix.js';
import {
  springElectricalControlNew,
  multilevelSpringElectricalEmbedding,
} from './spring.js';
import { sfdpInitGraph, sfdpCleanup } from './init.js';

const DIM = 2;
const POINTS_PER_INCH = 72;

/**
 * Build a symmetric CSR adjacency matrix from the graph's edge list.
 * Each undirected edge (u,v) contributes entries (u→v) and (v→u).
 * @see lib/sfdpgen/sfdpinit.c — adjacency construction
 */
export function buildAdjMatrix(g: Graph, n: number): SparseMatrix {
  const nodeIndex = buildNodeIndex(g);
  const A = SparseMatrix.new(n, n, g.edges.length * 2, MATRIX_TYPE_REAL, FORMAT_COORD);
  for (const e of g.edges) {
    const u = nodeIndex.get(e.tail.name);
    const v = nodeIndex.get(e.head.name);
    if (u === undefined || v === undefined || u === v) continue;
    A.addEntry(u, v, 1.0);
    A.addEntry(v, u, 1.0);
  }
  return A.fromCoordinateFormat();
}

function buildNodeIndex(g: Graph): Map<string, number> {
  const idx = new Map<string, number>();
  let i = 0;
  for (const name of g.nodes.keys()) {
    idx.set(name, i++);
  }
  return idx;
}

/**
 * Copy current node positions into a flat [x0,y0, x1,y1, ...] array.
 * @see lib/sfdpgen/sfdpinit.c — coordinate extraction
 */
export function nodesToX(g: Graph, n: number, dim: number): Float64Array {
  const x = new Float64Array(n * dim);
  let i = 0;
  for (const nd of g.nodes.values()) {
    const pos = nd.info.pos;
    if (pos !== undefined) {
      for (let k = 0; k < dim; k++) x[i * dim + k] = pos[k] ?? 0;
    }
    i++;
  }
  return x;
}

/**
 * Write the flat coordinate array back to per-node pos fields.
 * @see lib/sfdpgen/sfdpinit.c — coordinate write-back
 */
export function xToNodes(g: Graph, n: number, dim: number, x: Float64Array): void {
  let i = 0;
  for (const nd of g.nodes.values()) {
    if (i >= n) break;
    const pos: number[] = [];
    for (let k = 0; k < dim; k++) pos.push(x[i * dim + k] ?? 0);
    nd.info.pos = pos;
    i++;
  }
}

/**
 * Run the full sfdp force-directed layout on graph g.
 * @see lib/sfdpgen/sfdpinit.c:sfdp_layout
 */
export function sfdpLayout(g: Graph): void {
  const ctrl = springElectricalControlNew();
  sfdpInitGraph(g, ctrl);
  const n = g.nodes.size;
  if (n === 0) return;
  const x = nodesToX(g, n, DIM);
  const A = buildAdjMatrix(g, n);
  const flag = { value: 0 };
  multilevelSpringElectricalEmbedding(DIM, A, ctrl, null, x, 0, [], flag);
  xToNodes(g, n, DIM, x);
  for (const nd of g.nodes.values()) {
    nd.info.coord = {
      x: (nd.info.pos?.[0] ?? 0) * POINTS_PER_INCH,
      y: (nd.info.pos?.[1] ?? 0) * POINTS_PER_INCH,
    };
  }
}

/** @see lib/gvc/gvplugin.h:gvlayout_engine_s */
export const SFDP_LAYOUT_ENGINE: LayoutEngine = {
  type: 'sfdp',
  layout: sfdpLayout,
  cleanup: sfdpCleanup,
};
