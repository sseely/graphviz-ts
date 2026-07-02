// SPDX-License-Identifier: EPL-2.0

/**
 * Shared utilities for the mincross family: context type, AdjMatrix helpers,
 * graph helpers, and node cluster helpers.
 * Imported by mincross.ts, mincross-build.ts, mincross-cross.ts, and
 * mincross-order.ts to avoid circular dependencies.
 *
 * @see lib/dotgen/mincross.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { AdjMatrix, RankEntry } from '../../model/rankEntry.js';
import { VIRTUAL, NORMAL } from './fastgr.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:Convergence */
export const CONVERGENCE = 0.995;

// ---------------------------------------------------------------------------
// MincrossContext
// ---------------------------------------------------------------------------

/**
 * Replaces C module-level statics (Root, GlobalMinRank/MaxRank, TE_list,
 * TI_list, ReMincross, MinQuit, MaxIter) for reentrancy.
 * @see lib/dotgen/mincross.c (module statics)
 */
export interface MincrossContext {
  root: Graph;
  globalMinRank: number;
  globalMaxRank: number;
  teList: Edge[];
  tiList: number[];
  reMincross: boolean;
  minQuit: number;
  maxIter: number;
}

// ---------------------------------------------------------------------------
// AdjMatrix helpers  @see lib/dotgen/mincross.c:matrix_get/set/new_matrix
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:matrix_get */
export function matrixGet(m: AdjMatrix, row: number, col: number): boolean {
  if (row >= m.nrows || col >= m.ncols) return false;
  const idx = row * m.ncols + col;
  return ((m.data[idx >> 3] >> (idx & 7)) & 1) === 1;
}

/** @see lib/dotgen/mincross.c:matrix_set */
export function matrixSet(m: AdjMatrix, row: number, col: number): void {
  if (row >= m.nrows || col >= m.ncols) matrixExpand(m, row, col);
  const idx = row * m.ncols + col;
  m.data[idx >> 3] |= (1 << (idx & 7));
}

/** Copy all set bits into new buffer with updated column count. */
export function matrixCopyBits(m: AdjMatrix, data: Uint8Array, ncols: number): void {
  for (let r = 0; r < m.nrows; r++) {
    for (let c = 0; c < m.ncols; c++) {
      if (!matrixGet(m, r, c)) continue;
      const idx = r * ncols + c;
      data[idx >> 3] |= (1 << (idx & 7));
    }
  }
}

function matrixExpand(m: AdjMatrix, row: number, col: number): void {
  const nrows = Math.max(m.nrows, row + 1);
  const ncols = Math.max(m.ncols, col + 1);
  const bits = nrows * ncols;
  const bytes = (bits >> 3) + (bits & 7 ? 1 : 0);
  const data = new Uint8Array(bytes);
  matrixCopyBits(m, data, ncols);
  m.nrows = nrows;
  m.ncols = ncols;
  m.data = data;
}

/** @see lib/dotgen/mincross.c:new_matrix */
export function newMatrix(rows: number, cols: number): AdjMatrix {
  const bits = rows * cols;
  const bytes = (bits >> 3) + (bits & 7 ? 1 : 0);
  return { nrows: rows, ncols: cols, data: new Uint8Array(bytes) };
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

/** @see lib/dotgen/dot.h:dot_root */
export function dotRoot(g: Graph): Graph {
  return g.info.dotroot ?? g.root;
}

/** @see lib/cgraph/cgraph.h:agcontains (node) */
export function agContainsNode(g: Graph, n: Node): boolean {
  return g.nodes.get(n.name) === n;
}

/** @see lib/cgraph/cgraph.h:agcontains (edge) */
export function agContainsEdge(g: Graph, e: Edge): boolean {
  return g.edges.includes(e);
}

// ---------------------------------------------------------------------------
// Rank accessors with vStart offset
// ---------------------------------------------------------------------------

/** Get rank.v[i] respecting vStart pointer-arithmetic offset. */
export function rankGet(rank: RankEntry, i: number): Node {
  return rank.v[(rank.vStart ?? 0) + i];
}

/** Set rank.v[i] respecting vStart pointer-arithmetic offset. */
export function rankSet(rank: RankEntry, i: number, n: Node): void {
  rank.v[(rank.vStart ?? 0) + i] = n;
}

// ---------------------------------------------------------------------------
// Node cluster / containment helpers
// ---------------------------------------------------------------------------

/** @see lib/dotgen/mincross.c:is_a_normal_node_of */
export function isNormalNodeOf(g: Graph, v: Node): boolean {
  return v.info.node_type === NORMAL && agContainsNode(g, v);
}

/** @see lib/dotgen/mincross.c:is_a_vnode_of_an_edge_of */
export function isVnodeOfEdgeOf(g: Graph, v: Node): boolean {
  if (v.info.node_type !== VIRTUAL) return false;
  const inSz = v.info.in ? v.info.in.size : 0;
  const outSz = v.info.out ? v.info.out.size : 0;
  if (inSz !== 1 || outSz !== 1) return false;
  let e = v.info.out!.list[0];
  while (e.info.edge_type !== NORMAL && e.info.to_orig) e = e.info.to_orig;
  return agContainsEdge(g, e);
}

/** @see lib/dotgen/mincross.c:inside_cluster */
export function insideCluster(g: Graph, v: Node): boolean {
  return isNormalNodeOf(g, v) || isVnodeOfEdgeOf(g, v);
}

/** @see lib/dotgen/mincross.c:neighbor
 * Only the Root global is consulted, so callers outside the mincross pass
 * (flat_edges' vlist reset runs in dot_position) may pass a bare `{root}`. */
export function neighborNode(ctx: Pick<MincrossContext, 'root'>, v: Node, dir: number): Node | undefined {
  const rk = ctx.root.info.rank?.[v.info.rank ?? 0];
  if (!rk) return undefined;
  const order = v.info.order ?? 0;
  // rank.v may contain explicit null entries (make_slots); coerce null→undefined.
  return (dir < 0 ? (order > 0 ? rk.v[order - 1] : undefined) : rk.v[order + 1]) ?? undefined;
}

/** @see lib/dotgen/mincross.c:furthestnode */
export function furthestNode(ctx: Pick<MincrossContext, 'root'>, g: Graph, v: Node, dir: number): Node {
  let rv = v;
  let u: Node | undefined = v;
  while ((u = neighborNode(ctx, u, dir)) !== undefined) {
    if (isNormalNodeOf(g, u) || isVnodeOfEdgeOf(g, u)) rv = u;
  }
  return rv;
}
