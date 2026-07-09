// SPDX-License-Identifier: EPL-2.0

/**
 * Biconnected-component decomposition and block-cutpoint tree construction.
 *
 * Ports lib/circogen/blocktree.c.
 *
 * @see lib/circogen/blocktree.c
 */

import type { DerivedNode, DerivedEdge, DerivedGraph, SubGraph } from './blocks.js';
import { spanIncident } from './blockpath.js';
import {
  type Block,
  type CircState,
  mkBlock,
  blockSize,
  appendBlock,
  insertBlock,
} from './blocks.js';
import { FLAGS_ISPARENT } from './blocks.js';

// All interfaces at top-level so lizard doesn't count them inside functions.

/** DFS context object — avoids passing many params through recursive calls. */
export interface DfsCtx {
  g: SubGraph;
  state: CircState;
  allEdges: DerivedEdge[];
  stk: DerivedEdge[];
  /** Derived-node creation order — agfstedge sort key. */
  ord: Map<DerivedNode, number>;
  /** Derived-edge creation order — agfstedge tie key. */
  seq: Map<DerivedEdge, number>;
}

// ---------------------------------------------------------------------------
// Subgraph / block factories
// ---------------------------------------------------------------------------

export function makeBlockSubgraph(dg: DerivedGraph, state: CircState): SubGraph {
  const name = `_block_${state.blockCount++}`;
  const sg: SubGraph = { name, nodes: [], edges: [], parent: dg };
  dg.subgraphs.push(sg);
  return sg;
}

export function makeBlock(dg: DerivedGraph, state: CircState): Block {
  return mkBlock(makeBlockSubgraph(dg, state));
}

export function addNodeToBlock(bp: Block, n: DerivedNode): void {
  bp.subGraph.nodes.push(n);
  n.cdata.block = bp;
}

// ---------------------------------------------------------------------------
// DFS edge-stack helpers
// ---------------------------------------------------------------------------

export function popEdgesUntil(stk: DerivedEdge[], e: DerivedEdge): DerivedEdge[] {
  const popped: DerivedEdge[] = [];
  let ep: DerivedEdge;
  do {
    ep = stk[stk.length - 1]!;
    stk.pop();
    popped.push(ep);
  } while (ep !== e);
  return popped;
}

export function buildBlockFromEdges(
  dg: DerivedGraph,
  state: CircState,
  popped: DerivedEdge[],
  u: DerivedNode,
): Block | null {
  let block: Block | null = null;
  for (const ep of popped) {
    const np = ep.order === 1 ? ep.head : ep.tail;
    if (np.cdata.block === null) {
      if (block === null) block = makeBlock(dg, state);
      addNodeToBlock(block, np);
    }
  }
  if (block !== null && u.cdata.block === null && blockSize(block) > 1) {
    addNodeToBlock(block, u);
  }
  return block;
}

export function placeBlock(
  state: CircState,
  block: Block,
  u: DerivedNode,
  isRoot: boolean,
): void {
  if (isRoot && u.cdata.block === block) {
    insertBlock(state.bl, block);
  } else {
    appendBlock(state.bl, block);
  }
}

// ---------------------------------------------------------------------------
// DFS — Tarjan biconnected components
// @see lib/circogen/blocktree.c:dfs
// ---------------------------------------------------------------------------

export function processArticulation(
  ctx: DfsCtx,
  u: DerivedNode,
  v: DerivedNode,
  e: DerivedEdge,
  isRoot: boolean,
): void {
  if (v.cdata.bc.lowVal < u.cdata.bc.val) return;
  const popped = popEdgesUntil(ctx.stk, e);
  const block = buildBlockFromEdges(ctx.g.parent, ctx.state, popped, u);
  if (block !== null) placeBlock(ctx.state, block, u, isRoot);
}

export function dfsVisitEdge(
  ctx: DfsCtx,
  u: DerivedNode,
  e: DerivedEdge,
  isRoot: boolean,
): void {
  const v = e.head === u ? e.tail : e.head;
  if (e.order === 0) e.order = e.head === u ? -1 : 1;
  if (v.cdata.bc.val === 0) {
    v.cdata.parent = u;
    ctx.stk.push(e);
    dfsVisit(ctx, v, false);
    u.cdata.bc.lowVal = Math.min(u.cdata.bc.lowVal, v.cdata.bc.lowVal);
    processArticulation(ctx, u, v, e, isRoot);
  } else if (v !== u.cdata.parent) {
    u.cdata.bc.lowVal = Math.min(u.cdata.bc.lowVal, v.cdata.bc.val);
  }
}

export function dfsVisit(ctx: DfsCtx, u: DerivedNode, isRoot: boolean): void {
  u.cdata.bc.val = ctx.state.orderCount;
  u.cdata.bc.lowVal = ctx.state.orderCount;
  ctx.state.orderCount++;
  // C dfs iterates agfstedge(g, u) — u's incident edges in (other-endpoint,
  // seq) order, not the flat edge list. The DISCOVERY order decides the
  // block-tree child order, which assigns each satellite block its angular
  // slot around the cut vertex. @see lib/circogen/blocktree.c:62
  const uEdges = spanIncident(u, ctx.allEdges, ctx.ord, ctx.seq);
  for (const e of uEdges) dfsVisitEdge(ctx, u, e, isRoot);
  if (isRoot && u.cdata.block === null) {
    const block = makeBlock(ctx.g.parent, ctx.state);
    addNodeToBlock(block, u);
    insertBlock(ctx.state.bl, block);
  }
}

export function findBlocks(
  g: SubGraph,
  state: CircState,
  allEdges: DerivedEdge[],
): void {
  let root: DerivedNode | null = null;
  if (state.rootname) root = g.parent.nodes.get(state.rootname) ?? null;
  if (!root && g.nodes.length > 0) root = g.nodes[0]!;
  if (!root) return;
  const ord = new Map<DerivedNode, number>();
  g.nodes.forEach((dn, i) => ord.set(dn, i));
  const seq = new Map<DerivedEdge, number>();
  allEdges.forEach((e, i) => seq.set(e, i));
  dfsVisit({ g, state, allEdges, stk: [], ord, seq }, root, true);
}

// ---------------------------------------------------------------------------
// Block-cutpoint tree wiring
// @see lib/circogen/blocktree.c:createBlocktree
// ---------------------------------------------------------------------------

export function minValNode(bp: Block): { child: DerivedNode; parentNode: DerivedNode | null } {
  let child = bp.subGraph.nodes[0]!;
  let minVal = child.cdata.bc.val;
  let parentNode = child.cdata.parent;
  for (let j = 1; j < bp.subGraph.nodes.length; j++) {
    const n = bp.subGraph.nodes[j]!;
    if (n.cdata.bc.val < minVal) {
      child = n;
      minVal = n.cdata.bc.val;
      parentNode = n.cdata.parent;
    }
  }
  return { child, parentNode };
}

export function wireBlock(bp: Block): void {
  if (bp.subGraph.nodes.length === 0) return;
  const { child, parentNode } = minValNode(bp);
  bp.child = child.orig;
  if (parentNode === null) return;
  parentNode.cdata.flags |= FLAGS_ISPARENT;
  const parentBlock = parentNode.cdata.block as Block | null;
  if (parentBlock !== null) parentBlock.children.push(bp);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build block-cutpoint tree from biconnected components.
 * @see lib/circogen/blocktree.c:createBlocktree
 */
export function createBlocktree(
  g: SubGraph,
  state: CircState,
  allEdges: DerivedEdge[],
): Block {
  findBlocks(g, state, allEdges);
  const root = state.bl[0]!;
  for (let i = 1; i < state.bl.length; i++) wireBlock(state.bl[i]!);
  state.bl = [];
  return root;
}

/**
 * Create a single block containing all nodes (oneblock=true).
 * @see lib/circogen/circular.c:createOneBlock
 */
export function createOneBlock(g: SubGraph, state: CircState): Block {
  const name = `_block_${state.blockCount++}`;
  const sg: SubGraph = { name, nodes: [...g.nodes], edges: [], parent: g.parent };
  g.parent.subgraphs.push(sg);
  const bp = mkBlock(sg);
  for (const n of sg.nodes) n.cdata.block = bp;
  return bp;
}

/**
 * Recursively free a block tree (post-order).
 * @see lib/circogen/blocktree.c:freeBlocktree
 */
export function freeBlocktree(bp: Block): void {
  for (const child of bp.children) freeBlocktree(child);
  bp.circleList = [];
  bp.children = [];
}
