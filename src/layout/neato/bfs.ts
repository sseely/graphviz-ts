// SPDX-License-Identifier: EPL-2.0
/** @see lib/neatogen/bfs.c */

import type { VtxData } from './dijkstra.js';
import { dijkstra } from './dijkstra.js';

/** Sentinel for unreachable nodes (INT_MAX). @internal */
export const BFS_UNREACHABLE = 2147483647;

// ---------------------------------------------------------------------------
// BFS helpers
// ---------------------------------------------------------------------------

/** Initialise dist array; returns a queue seeded with `src`. @internal */
export function bfsInit(src: number, n: number, dist: Int32Array): number[] {
  for (let i = 0; i < n; i++) dist[i] = -1;
  dist[src] = 0;
  return [src];
}

/**
 * Replace unreachable nodes (-1) with `closestDist + 10`.
 * Matches the disconnected-graph handling in bfs.c.
 * @internal
 */
export function bfsFixDisconnected(
  n: number,
  dist: Int32Array,
  closestDist: number,
): void {
  for (let i = 0; i < n; i++) {
    if (dist[i] < 0) dist[i] = closestDist + 10;
  }
}

/** Process one BFS vertex: enqueue unvisited neighbours. @internal */
export function bfsVisitNeighbors(
  vertex: number,
  graph: VtxData[],
  dist: Int32Array,
  queue: number[],
): number {
  const vd = graph[vertex];
  const d = dist[vertex];
  for (let i = 1; i < vd.nedges; i++) {
    const nb = vd.edges[i];
    if (dist[nb] < 0) {
      dist[nb] = d + 1;
      queue.push(nb);
    }
  }
  return d;
}

// ---------------------------------------------------------------------------
// Public: bfs
// ---------------------------------------------------------------------------

/**
 * Single-source BFS (unweighted) from `src`.
 * Populates `dist` with hop-distances; unreachable nodes get `BFS_UNREACHABLE`.
 *
 * @see lib/neatogen/bfs.c:bfs
 */
export function bfs(
  src: number,
  graph: VtxData[],
  n: number,
  dist: Int32Array,
): void {
  const queue = bfsInit(src, n, dist);
  let closestDist = 0;
  let head = 0;
  while (head < queue.length) {
    const vertex = queue[head++];
    closestDist = bfsVisitNeighbors(vertex, graph, dist, queue);
  }
  bfsFixDisconnected(n, dist, closestDist);
}

// ---------------------------------------------------------------------------
// Packed upper-triangular APSP
// ---------------------------------------------------------------------------

/**
 * Index into a packed upper-triangular array of length n*(n+1)/2.
 * Requires i <= j.
 *
 * @see lib/neatogen/stress.c:compute_apsp_packed
 */
export function packedIndex(i: number, j: number, n: number): number {
  return (i * (2 * n - i - 1)) / 2 + j;
}

/**
 * All-pairs shortest paths (unweighted BFS) in packed upper-triangular form.
 * Returns Float32Array of length n*(n+1)/2.
 *
 * @see lib/neatogen/stress.c:compute_apsp_packed
 */
export function computeApspPacked(
  graph: VtxData[],
  n: number,
): Float32Array {
  const result = new Float32Array((n * (n + 1)) / 2);
  const di = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    bfs(i, graph, n, di);
    for (let j = i; j < n; j++) result[packedIndex(i, j, n)] = di[j];
  }
  return result;
}

/**
 * All-pairs shortest paths (weighted Dijkstra) in packed upper-triangular form.
 * Returns Float32Array of length n*(n+1)/2.
 *
 * @see lib/neatogen/stress.c:compute_weighted_apsp_packed
 */
export function computeWeightedApspPacked(
  graph: VtxData[],
  n: number,
): Float32Array {
  const result = new Float32Array((n * (n + 1)) / 2);
  const di = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    dijkstra(i, graph, n, di);
    for (let j = i; j < n; j++) result[packedIndex(i, j, n)] = di[j];
  }
  return result;
}
