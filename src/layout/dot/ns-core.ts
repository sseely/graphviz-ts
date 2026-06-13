// SPDX-License-Identifier: EPL-2.0
/** @see lib/common/ns.c — types, constants, tree-list helpers */
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Graph } from '../../model/graph.js';
import type { EdgeList } from '../../model/nodeInfo.js';

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c:network_simplex_ctx_t */
export interface NsCtx {
  g: Graph;
  treeEdges: Edge[];
  sI: number;
  nEdges: number;
  nNodes: number;
  searchSize: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c:SEARCHSIZE */
export const SEARCHSIZE = 30;

/** Normal node type. @see lib/common/types.h */
export const NORMAL = 0;

// ---------------------------------------------------------------------------
// Inline helpers
// ---------------------------------------------------------------------------

/** LENGTH(e) = rank(head) - rank(tail). @see lib/common/ns.c */
export function nsLength(e: Edge): number {
  return (e.head.info.rank ?? 0) - (e.tail.info.rank ?? 0);
}

/** SLACK(e) = LENGTH(e) - minlen(e). @see lib/common/ns.c */
export function nsSlack(e: Edge): number { return nsLength(e) - (e.info.minlen ?? 1); }

/** TREE_EDGE(e): tree_index >= 0. @see lib/common/ns.c */
export function isTreeEdge(e: Edge): boolean { return (e.info.tree_index ?? -1) >= 0; }

/** SEQ(a,b,c): a<=b && b<=c. @see lib/common/ns.c */
export function seq(a: number, b: number, c: number): boolean { return a <= b && b <= c; }

// ---------------------------------------------------------------------------
// Tree edge list helpers
// ---------------------------------------------------------------------------

/** Append e to an EdgeList. @see lib/dotgen/fastgr.c:elistAppend */
export function treeAppend(el: EdgeList, e: Edge): void { el.list[el.size++] = e; }

/** Swap-last-remove of e from an EdgeList. @see lib/dotgen/fastgr.c:zapinlist */
export function treeRemoveEdge(el: EdgeList, e: Edge): void {
  let j = 0;
  const i = --el.size;
  while (j <= i && el.list[j] !== e) j++;
  if (j <= i) el.list[j] = el.list[i];
}

// ---------------------------------------------------------------------------
// addTreeEdge
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c:add_tree_edge */
export function addTreeEdge(ctx: NsCtx, e: Edge): number {
  if (isTreeEdge(e)) return -1;
  e.info.tree_index = ctx.treeEdges.length;
  ctx.treeEdges.push(e);
  const tail = e.tail;
  tail.info.mark = 1;
  if (!tail.info.tree_out) tail.info.tree_out = { list: [], size: 0 };
  treeAppend(tail.info.tree_out, e);
  const head = e.head;
  head.info.mark = 1;
  if (!head.info.tree_in) head.info.tree_in = { list: [], size: 0 };
  treeAppend(head.info.tree_in, e);
  return 0;
}

// ---------------------------------------------------------------------------
// invalidatePath
// ---------------------------------------------------------------------------

function pathParent(e: Edge): Node {
  return (e.tail.info.lim ?? 0) > (e.head.info.lim ?? 0) ? e.tail : e.head;
}

/** @see lib/common/ns.c:invalidate_path */
export function invalidatePath(lca: Node, toNode: Node): void {
  const lcaLim = lca.info.lim ?? 0;
  let n = toNode;
  while (true) {
    if (n.info.low === -1) break;
    n.info.low = -1;
    const e = n.info.par;
    if (!e || (n.info.lim ?? 0) >= lcaLim) break;
    n = pathParent(e);
  }
}

// ---------------------------------------------------------------------------
// exchangeTreeEdges
// ---------------------------------------------------------------------------

/** @see lib/common/ns.c:exchange_tree_edges */
export function exchangeTreeEdges(ctx: NsCtx, e: Edge, f: Edge): void {
  const idx = e.info.tree_index!;
  f.info.tree_index = idx;
  ctx.treeEdges[idx] = f;
  e.info.tree_index = -1;
  treeRemoveEdge(e.tail.info.tree_out!, e);
  treeRemoveEdge(e.head.info.tree_in!, e);
  if (!f.tail.info.tree_out) f.tail.info.tree_out = { list: [], size: 0 };
  treeAppend(f.tail.info.tree_out, f);
  if (!f.head.info.tree_in) f.head.info.tree_in = { list: [], size: 0 };
  treeAppend(f.head.info.tree_in, f);
}
