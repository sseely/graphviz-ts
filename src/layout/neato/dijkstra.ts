// SPDX-License-Identifier: EPL-2.0
/** @see lib/neatogen/dijkstra.c */

import type { GraphSgd } from './sgd.js';

/**
 * Sparse-graph vertex descriptor used by neato layout algorithms.
 * Matches `vtx_data` in lib/neatogen/sparsegraph.h.
 *
 * - `nedges`: total entries including self at index 0
 * - `edges[0]` = self-index; `edges[1..]` = neighbor indices
 * - `ewgts[k]` = edge weight for `edges[k]`
 *
 * @see lib/neatogen/sparsegraph.h:vtx_data
 */
export interface VtxData {
  nedges: number;
  edges: number[];
  ewgts: number[];
}

/**
 * A term used by the SGD layout engine.
 * Matches `term_sgd` in lib/neatogen/sgd.h.
 * @see lib/neatogen/sgd.h:term_sgd
 */
export interface TermSgd {
  i: number;  // source node
  j: number;  // destination node
  d: number;  // ideal distance
  w: number;  // weight = 1/d²
}

/** Sentinel used for unvisited BFS nodes (matches C INT_MAX). */
const BFS_INF = 0x7fffffff;

// ---------------------------------------------------------------------------
// Min-heap (keyed by Float32Array distances)
// ---------------------------------------------------------------------------

/** Push vertex index `idx` into the heap. @internal */
export function heapPush(
  heap: number[],
  dist: Float32Array,
  idx: number,
): void {
  let pos = heap.length;
  heap.push(idx);
  while (pos > 0) {
    const parent = (pos - 1) >> 1;
    if (dist[heap[parent]] <= dist[heap[pos]]) break;
    const tmp = heap[parent];
    heap[parent] = heap[pos];
    heap[pos] = tmp;
    pos = parent;
  }
}

/** Sift the root down to restore heap order after replacing it. @internal */
export function heapSiftDown(heap: number[], dist: Float32Array): void {
  let pos = 0;
  for (;;) {
    const l = 2 * pos + 1;
    const r = 2 * pos + 2;
    let smallest = pos;
    if (l < heap.length && dist[heap[l]] < dist[heap[smallest]]) smallest = l;
    if (r < heap.length && dist[heap[r]] < dist[heap[smallest]]) smallest = r;
    if (smallest === pos) break;
    const tmp = heap[smallest];
    heap[smallest] = heap[pos];
    heap[pos] = tmp;
    pos = smallest;
  }
}

/** Pop and return the vertex with minimum distance. @internal */
export function heapPop(heap: number[], dist: Float32Array): number {
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length === 0) return top;
  heap[0] = last;
  heapSiftDown(heap, dist);
  return top;
}

/** Build a min-heap from all nodes except `src`. @internal */
export function heapBuildExcluding(
  src: number,
  n: number,
  dist: Float32Array,
): number[] {
  const heap: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i !== src) heapPush(heap, dist, i);
  }
  return heap;
}

// ---------------------------------------------------------------------------
// dijkstra helpers
// ---------------------------------------------------------------------------

/** Initialise dist array from source edges. @internal */
export function dijkstraInitDist(
  src: number,
  graph: VtxData[],
  n: number,
  dist: Float32Array,
): void {
  for (let i = 0; i < n; i++) dist[i] = Infinity;
  dist[src] = 0;
  const v = graph[src];
  for (let i = 1; i < v.nedges; i++) dist[v.edges[i]] = v.ewgts[i];
}

/** Relax all outgoing edges of `closest`. @internal */
export function dijkstraRelax(
  closest: number,
  closestDist: number,
  graph: VtxData[],
  dist: Float32Array,
  heap: number[],
): void {
  const cv = graph[closest];
  for (let i = 1; i < cv.nedges; i++) {
    const nb = cv.edges[i];
    const nd = closestDist + cv.ewgts[i];
    if (nd < dist[nb]) {
      dist[nb] = nd;
      heapPush(heap, dist, nb);
    }
  }
}

// ---------------------------------------------------------------------------
// Public: dijkstra (float-weight, float-output)
// ---------------------------------------------------------------------------

/**
 * Single-source shortest paths (weighted) from `src`.
 * Populates `dist` with Float32 distances; unreachable nodes get Infinity.
 * Equivalent to `dijkstra_f` in lib/neatogen/dijkstra.c.
 *
 * @see lib/neatogen/dijkstra.c:dijkstra_f
 */
export function dijkstra(
  src: number,
  graph: VtxData[],
  n: number,
  dist: Float32Array,
): void {
  dijkstraInitDist(src, graph, n, dist);
  const heap = heapBuildExcluding(src, n, dist);
  while (heap.length > 0) {
    const closest = heapPop(heap, dist);
    const closestDist = dist[closest];
    if (!isFinite(closestDist)) break;
    dijkstraRelax(closest, closestDist, graph, dist, heap);
  }
}

// ---------------------------------------------------------------------------
// Public: All-pairs shortest paths (packed upper-triangular)
// ---------------------------------------------------------------------------

/**
 * BFS single-source distances for unweighted graphs.
 * Fills `dist` with hop counts; unreachable nodes get BFS_INF (0x7fffffff).
 * edges[0] of each vertex is the self-loop and is skipped.
 * @see lib/neatogen/bfs.c:bfs
 */
export function bfsDistances(
  src: number,
  graph: VtxData[],
  n: number,
  dist: Float32Array,
): void {
  for (let i = 0; i < n; i++) dist[i] = BFS_INF;
  dist[src] = 0;
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  queue[tail++] = src;
  while (head < tail) {
    const u = queue[head++];
    const d = dist[u] + 1;
    const vtx = graph[u];
    for (let e = 1; e < vtx.nedges; e++) {
      const v = vtx.edges[e];
      if (dist[v] === BFS_INF) { dist[v] = d; queue[tail++] = v; }
    }
  }
}

/**
 * All-pairs shortest paths (unweighted), packed upper-triangular.
 * Length n*(n+1)/2; index for (i,j) j>=i: i*(2n-i-1)/2 + j.
 * @see lib/neatogen/stress.c:compute_apsp_packed
 */
export function computeApspPacked(graph: VtxData[], n: number): Float32Array {
  const result = new Float32Array(n * (n + 1) / 2);
  const di = new Float32Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    bfsDistances(i, graph, n, di);
    for (let j = i; j < n; j++) result[count++] = di[j];
  }
  return result;
}

/**
 * All-pairs shortest paths (weighted), packed upper-triangular.
 * Length n*(n+1)/2.
 * @see lib/neatogen/stress.c:compute_weighted_apsp_packed
 */
export function computeWeightedApspPacked(
  graph: VtxData[],
  n: number,
): Float32Array {
  const result = new Float32Array(n * (n + 1) / 2);
  const di = new Float32Array(n);
  let count = 0;
  for (let i = 0; i < n; i++) {
    dijkstra(i, graph, n, di);
    for (let j = i; j < n; j++) result[count++] = di[j];
  }
  return result;
}

// ---------------------------------------------------------------------------
// dijkstraSgd helpers
// ---------------------------------------------------------------------------

/** Initialise SGD dists from source's adjacency list. @internal */
export function sgdInitDist(
  graph: GraphSgd,
  src: number,
  dists: Float32Array,
): void {
  dists[src] = 0;
  const end = graph.sources[src + 1];
  for (let i = graph.sources[src]; i < end; i++) {
    dists[graph.targets[i]] = graph.weights[i];
  }
}

/** Relax SGD neighbours of `closest` and push updates onto `heap`. @internal */
export function sgdRelaxNeighbors(
  graph: GraphSgd,
  closest: number,
  d: number,
  dists: Float32Array,
  heap: number[],
): void {
  const end = graph.sources[closest + 1];
  for (let i = graph.sources[closest]; i < end; i++) {
    const target = graph.targets[i];
    const nd = d + graph.weights[i];
    if (nd < dists[target]) {
      dists[target] = nd;
      heapPush(heap, dists, target);
    }
  }
}

// ---------------------------------------------------------------------------
// Public: dijkstraSgd
// ---------------------------------------------------------------------------

/**
 * Single-source shortest paths for the SGD engine.
 * Writes terms for all reachable `j < src` and pinned nodes.
 * Returns the count of terms written.
 *
 * @see lib/neatogen/dijkstra.c:dijkstra_sgd
 */
export function dijkstraSgd(
  graph: GraphSgd,
  src: number,
  terms: TermSgd[],
): number {
  const n = graph.n;
  const dists = new Float32Array(n).fill(Infinity);
  sgdInitDist(graph, src, dists);
  const heap = heapBuildExcluding(src, n, dists);
  let offset = 0;
  while (heap.length > 0) {
    const closest = heapPop(heap, dists);
    const d = dists[closest];
    if (!isFinite(d)) break;
    if (graph.pinneds[closest] || closest < src) {
      terms[offset++] = { i: src, j: closest, d, w: 1 / (d * d) };
    }
    sgdRelaxNeighbors(graph, closest, d, dists, heap);
  }
  return offset;
}
