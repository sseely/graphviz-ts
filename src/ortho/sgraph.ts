// SPDX-License-Identifier: EPL-2.0
/**
 * Search graph and Dijkstra shortest path for ortho edge routing.
 *
 * Faithful port of lib/ortho/sgraph.c.
 * Distance values stored NEGATED in nVal while in the priority queue.
 * When a node is finalized (popped), nVal is flipped positive.
 * UNSEEN = Number.MIN_SAFE_INTEGER (mirrors C INT_MIN).
 *
 * @see lib/ortho/sgraph.c
 * @see lib/ortho/sgraph.h
 */

import type { SGraph, SNode, SEdge, Cell } from "./types.js";
import { pqGen, pqFree, pqInit, pqInsert, pqRemove, pqUpdate } from "./fpq.js";
import type { Pq } from "./fpq.js";

/** Sentinel value for unseen nodes. @see lib/ortho/sgraph.c:UNSEEN */
export const UNSEEN = Number.MIN_SAFE_INTEGER;

// ─── Graph lifecycle ─────────────────────────────────────────────────────────

/**
 * Allocate a search graph with capacity for nnodes nodes (+2 dummy slots).
 * @see lib/ortho/sgraph.c:createSGraph
 */
export function createSGraph(nnodes: number): SGraph {
  const nodes: SNode[] = [];
  for (let i = 0; i < nnodes; i++) {
    nodes.push(makeSNode(i));
  }
  return {
    nnodes: 0,
    nedges: 0,
    saveNnodes: 0,
    saveNedges: 0,
    nodes,
    edges: [],
  };
}

/** Allocate a blank SNode at the given index. */
function makeSNode(index: number): SNode {
  return {
    nVal: UNSEEN,
    nIdx: 0,
    nDad: null,
    nEdge: null,
    nAdj: 0,
    saveNAdj: 0,
    cells: [null, null],
    adjEdgeList: [],
    index,
    isVert: false,
  };
}

/**
 * Free the graph. (No-op in TS — GC handles it.)
 * @see lib/ortho/sgraph.c:freeSGraph
 */
export function freeSGraph(_g: SGraph): void {
  // GC handled
}

/**
 * Initialize per-node adjacency list storage.
 * Regular nodes get 6 slots; the two dummy nodes get maxdeg slots each.
 * @see lib/ortho/sgraph.c:initSEdges
 */
export function initSEdges(g: SGraph, maxdeg: number): void {
  // adjacency lists are already dynamic arrays; just ensure capacity
  // The two extra dummy nodes at indices nnodes and nnodes+1 need maxdeg slots
  const total = g.nnodes + 2;
  while (g.nodes.length < total) {
    g.nodes.push(makeSNode(g.nodes.length));
  }
  // pre-allocate edge array capacity
  g.edges = new Array<SEdge>(3 * g.nnodes + maxdeg);
  g.nedges = 0;
}

// ─── Node / edge creation ────────────────────────────────────────────────────

/**
 * Append a new node to the graph and return it.
 * @see lib/ortho/sgraph.c:createSNode
 */
export function createSNode(g: SGraph): SNode {
  const np = g.nodes[g.nnodes];
  np.index = g.nnodes;
  g.nnodes++;
  return np;
}

/**
 * Create an edge between v1 and v2 with the given weight.
 * @see lib/ortho/sgraph.c:createSEdge
 */
export function createSEdge(
  g: SGraph,
  v1: SNode,
  v2: SNode,
  wt: number,
): SEdge {
  const idx = g.nedges++;
  const e: SEdge = { weight: wt, cnt: 0, v1: v1.index, v2: v2.index };
  g.edges[idx] = e;
  v1.adjEdgeList.push(idx);
  v2.adjEdgeList.push(idx);
  v1.nAdj++;
  v2.nAdj++;
  return e;
}

// ─── State save / restore ────────────────────────────────────────────────────

/**
 * Save the current graph state (node/edge counts + adjacency counts).
 * @see lib/ortho/sgraph.c:gsave
 */
export function gsave(g: SGraph): void {
  g.saveNnodes = g.nnodes;
  g.saveNedges = g.nedges;
  for (let i = 0; i < g.nnodes; i++) {
    g.nodes[i].saveNAdj = g.nodes[i].nAdj;
  }
}

/**
 * Restore the graph to the last saved state and clear the two dummy nodes.
 * @see lib/ortho/sgraph.c:reset
 */
export function reset(g: SGraph): void {
  g.nnodes = g.saveNnodes;
  g.nedges = g.saveNedges;
  for (let i = 0; i < g.nnodes; i++) {
    g.nodes[i].nAdj = g.nodes[i].saveNAdj;
  }
  // clear the two dummy nodes beyond nnodes.
  // Must also truncate adjEdgeList — unlike C's fixed arrays, push() appends,
  // so new edges from the next addNodeEdges call would land after stale entries.
  // Truncating to length 0 ensures the next iteration writes from position 0.
  for (let i = g.nnodes; i < g.nnodes + 2; i++) {
    if (g.nodes[i]) {
      g.nodes[i].nAdj = 0;
      g.nodes[i].adjEdgeList.length = 0;
    }
  }
}

// ─── Dijkstra ────────────────────────────────────────────────────────────────

/** Return the other endpoint of edge e from node n. */
function adjacentNode(g: SGraph, e: SEdge, n: SNode): SNode {
  return e.v1 === n.index ? g.nodes[e.v2] : g.nodes[e.v1];
}

/**
 * Compute the shortest path from `from` to `to` using Dijkstra.
 * Returns 0 on success, 1 on PQ overflow.
 *
 * Distance values are stored NEGATED while pending in the queue.
 * When popped, nVal is flipped positive (multiply by -1).
 *
 * @see lib/ortho/sgraph.c:shortPath
 */
export function shortPath(pq: Pq, g: SGraph, from: SNode, to: SNode): number {
  // mark all nodes unseen
  for (let x = 0; x < g.nnodes; x++) {
    g.nodes[x].nVal = UNSEEN;
  }

  pqInit(pq);
  if (pqInsert(pq, from) !== 0) return 1;
  from.nDad = null;
  from.nVal = 0;

  let n: SNode | null;
  while ((n = pqRemove(pq)) !== null) {
    n.nVal *= -1; // finalize: flip to positive
    if (n === to) break;
    for (let y = 0; y < n.nAdj; y++) {
      const e = g.edges[n.adjEdgeList[y]];
      const adjn = adjacentNode(g, e, n);
      if (adjn.nVal <= 0) {
        // still pending or unseen
        const d = -(n.nVal + e.weight);
        if (adjn.nVal === UNSEEN) {
          adjn.nVal = d;
          if (pqInsert(pq, adjn) !== 0) return 1;
          adjn.nDad = n;
          adjn.nEdge = e;
        } else if (adjn.nVal < d) {
          pqUpdate(pq, adjn, d);
          adjn.nDad = n;
          adjn.nEdge = e;
        }
      }
    }
  }
  return 0;
}

/**
 * Generate a fresh priority queue sized for the search graph.
 * @see lib/ortho/sgraph.c shortPath preamble
 */
export function pqGenForGraph(g: SGraph): Pq {
  return pqGen(g.nnodes + 2);
}

export { pqFree };

// ─── Node/edge helpers used by maze.ts / ortho/index.ts ──────────────────────

/**
 * Add temporary edges from a node cell to the search graph.
 * Used to attach source/dest nodes before each Dijkstra call.
 * @see lib/ortho/ortho.c:addNodeEdges
 */
export function addNodeEdges(
  sg: SGraph,
  cp: Cell,
  np: SNode,
): void {
  for (let i = 0; i < cp.nsides; i++) {
    const onp = cp.sides[i];
    if (onp !== null) {
      createSEdge(sg, np, onp, 0);
    }
  }
  sg.nnodes++;
  np.cells[0] = cp;
  np.cells[1] = cp;
}

/**
 * Add temporary loop edges (self-loop at a single cell).
 * @see lib/ortho/ortho.c:addLoop
 */
export function addLoop(
  sg: SGraph,
  cp: Cell,
  dp: SNode,
  sp: SNode,
): void {
  for (let i = 0; i < cp.nsides; i++) {
    const onp = cp.sides[i];
    if (onp === null) continue;
    if (onp.isVert) continue;
    const onTop = onp.cells[0] === cp;
    if (onTop) {
      createSEdge(sg, sp, onp, 0);
    } else {
      createSEdge(sg, dp, onp, 0);
    }
  }
  sg.nnodes += 2;
}
