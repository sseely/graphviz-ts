// SPDX-License-Identifier: EPL-2.0
/**
 * Directed graph with DFS-based topological sort.
 *
 * Faithful port of lib/ortho/rawgraph.c.
 * @see lib/ortho/rawgraph.c
 * @see lib/ortho/rawgraph.h
 */

import type { RawGraph, RawVertex } from "./types.js";

const UNSCANNED = 0;
const SCANNING = 1;
const SCANNED = 2;

/**
 * Allocate a graph with n vertices and no edges.
 * @see lib/ortho/rawgraph.c:make_graph
 */
export function makeGraph(n: number): RawGraph {
  const vertices: RawVertex[] = [];
  for (let i = 0; i < n; i++) {
    vertices.push({ color: UNSCANNED, topsortOrder: 0, adjList: [] });
  }
  return { nvs: n, vertices };
}

/**
 * Release all memory associated with the graph.
 * (No-op in TS — GC handles it; retained for API symmetry.)
 * @see lib/ortho/rawgraph.c:free_graph
 */
export function freeGraph(_g: RawGraph): void {
  // GC handled
}

/**
 * Insert a directed edge from v1 to v2 (if it doesn't exist yet).
 * @see lib/ortho/rawgraph.c:insert_edge
 */
export function insertEdge(g: RawGraph, v1: number, v2: number): void {
  if (!edgeExists(g, v1, v2)) {
    g.vertices[v1].adjList.push(v2);
  }
}

/**
 * Remove any edge between v1 and v2 (either direction).
 * @see lib/ortho/rawgraph.c:remove_redge
 */
export function removeRedge(g: RawGraph, v1: number, v2: number): void {
  g.vertices[v1].adjList = g.vertices[v1].adjList.filter((x) => x !== v2);
  g.vertices[v2].adjList = g.vertices[v2].adjList.filter((x) => x !== v1);
}

/**
 * Test if there is a directed edge FROM v1 TO v2.
 * @see lib/ortho/rawgraph.c:edge_exists
 */
export function edgeExists(g: RawGraph, v1: number, v2: number): boolean {
  return g.vertices[v1].adjList.includes(v2);
}

/**
 * Recursive DFS visit used by topological sort.
 * @see lib/ortho/rawgraph.c:DFS_visit
 */
function dfsVisit(
  g: RawGraph,
  v: number,
  time: number,
  sp: number[],
): number {
  const vp = g.vertices[v];
  vp.color = SCANNING;
  const adj = vp.adjList;
  time = time + 1;

  for (let i = 0; i < adj.length; i++) {
    const id = adj[i];
    if (g.vertices[id].color === UNSCANNED) {
      time = dfsVisit(g, id, time, sp);
    }
  }
  vp.color = SCANNED;
  sp.push(v);
  return time + 1;
}

/**
 * Topologically sort the directed graph.
 * After this call, each vertex has topsortOrder set.
 * @see lib/ortho/rawgraph.c:top_sort
 */
export function topSort(g: RawGraph): void {
  let time = 0;
  let count = 0;

  if (g.nvs === 0) return;
  if (g.nvs === 1) {
    g.vertices[0].topsortOrder = count;
    return;
  }

  const sp: number[] = [];
  sp.length = 0;

  for (let i = 0; i < g.nvs; i++) {
    if (g.vertices[i].color === UNSCANNED) {
      time = dfsVisit(g, i, time, sp);
    }
  }

  while (sp.length > 0) {
    const v = sp.pop() as number;
    g.vertices[v].topsortOrder = count;
    count++;
  }
}
