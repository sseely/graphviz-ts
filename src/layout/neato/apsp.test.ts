// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for APSP algorithms: dijkstra, bfs, computeApspPacked,
 * computeWeightedApspPacked, and packedIndex.
 */

import { describe, it, expect } from 'vitest';
import { dijkstra, type VtxData } from './dijkstra.js';
import {
  bfs,
  BFS_UNREACHABLE,
  packedIndex,
  computeApspPacked,
  computeWeightedApspPacked,
} from './bfs.js';

// ---------------------------------------------------------------------------
// Test graph helpers
// ---------------------------------------------------------------------------

/**
 * Build a VtxData[] from an adjacency list with weights.
 * Each entry: [neighbor, weight]. Self is always edges[0].
 */
export function makeWeightedGraph(
  adj: Array<Array<[number, number]>>,
): VtxData[] {
  return adj.map((neighbors, i) => ({
    nedges: neighbors.length + 1,
    edges: [i, ...neighbors.map(([nb]) => nb)],
    ewgts: [0, ...neighbors.map(([, w]) => w)],
  }));
}

/** Build an unweighted VtxData[] from a plain adjacency list. */
export function makeUnweightedGraph(adj: number[][]): VtxData[] {
  return adj.map((neighbors, i) => ({
    nedges: neighbors.length + 1,
    edges: [i, ...neighbors],
    ewgts: [0, ...neighbors.map(() => 1)],
  }));
}

// ---------------------------------------------------------------------------
// dijkstra test bodies (exported so Lizard counts them as named functions)
// ---------------------------------------------------------------------------

export function testDijkstraFourNodeWeighted(): void {
  // 0 -1- 1 -2- 2 -1- 3 and 0 -4- 3
  const graph = makeWeightedGraph([
    [[1, 1], [3, 4]],
    [[0, 1], [2, 2]],
    [[1, 2], [3, 1]],
    [[2, 1], [0, 4]],
  ]);
  const dist = new Float32Array(4);
  dijkstra(0, graph, 4, dist);
  expect(dist[0]).toBe(0);
  expect(dist[1]).toBe(1);
  expect(dist[2]).toBe(3);  // 0→1→2
  expect(dist[3]).toBe(4);  // 0→1→2→3=4 equals 0→3 direct=4
}

export function testDijkstraPrefersShortestPath(): void {
  // 0 -10- 1 -1- 2, 0 -3- 2; shortest 0→1 = 3+1=4 (via 2)
  const graph = makeWeightedGraph([
    [[1, 10], [2, 3]],
    [[0, 10], [2, 1]],
    [[1, 1], [0, 3]],
  ]);
  const dist = new Float32Array(3);
  dijkstra(0, graph, 3, dist);
  expect(dist[0]).toBe(0);
  expect(dist[2]).toBe(3);   // direct 0→2=3 beats via-1=11
  expect(dist[1]).toBe(4);   // 0→2→1 = 3+1=4 < direct 10
}

export function testDijkstraUnreachable(): void {
  // Node 2 is isolated
  const graph = makeWeightedGraph([
    [[1, 1]],
    [[0, 1]],
    [],
  ]);
  const dist = new Float32Array(3);
  dijkstra(0, graph, 3, dist);
  expect(dist[2]).toBe(Infinity);
}

// ---------------------------------------------------------------------------
// bfs test bodies
// ---------------------------------------------------------------------------

export function testBfsHopDistances(): void {
  // 0-1-2 and 1-3
  const graph = makeUnweightedGraph([
    [1],
    [0, 2, 3],
    [1],
    [1],
  ]);
  const dist = new Int32Array(4);
  bfs(0, graph, 4, dist);
  expect(dist[0]).toBe(0);
  expect(dist[1]).toBe(1);
  expect(dist[2]).toBe(2);
  expect(dist[3]).toBe(2);
}

export function testBfsDisconnected(): void {
  // 0-1 disconnected from 2-3
  const graph = makeUnweightedGraph([[1], [0], [3], [2]]);
  const dist = new Int32Array(4);
  bfs(0, graph, 4, dist);
  expect(dist[0]).toBe(0);
  expect(dist[1]).toBe(1);
  // C: unreachable = closestDist(1) + 10 = 11
  expect(dist[2]).toBe(11);
  expect(dist[3]).toBe(11);
}

// ---------------------------------------------------------------------------
// computeApspPacked test bodies
// ---------------------------------------------------------------------------

export function testApspPackedLength(): void {
  const n = 4;
  const graph = makeUnweightedGraph([[1], [0, 2], [1, 3], [2]]);
  const result = computeApspPacked(graph, n);
  expect(result).toBeInstanceOf(Float32Array);
  expect(result.length).toBe((n * (n + 1)) / 2);
}

export function testApspPackedDiagonalZero(): void {
  const n = 3;
  const graph = makeUnweightedGraph([[1], [0, 2], [1]]);
  const result = computeApspPacked(graph, n);
  expect(result[packedIndex(0, 0, n)]).toBe(0);
  expect(result[packedIndex(1, 1, n)]).toBe(0);
  expect(result[packedIndex(2, 2, n)]).toBe(0);
}

export function testWeightedApspPackedLength(): void {
  const n = 4;
  const graph = makeWeightedGraph([
    [[1, 1]], [[0, 1], [2, 1]], [[1, 1], [3, 1]], [[2, 1]],
  ]);
  const result = computeWeightedApspPacked(graph, n);
  expect(result).toBeInstanceOf(Float32Array);
  expect(result.length).toBe((n * (n + 1)) / 2);
}

export function testWeightedApspPackedValues(): void {
  const n = 3;
  const graph = makeWeightedGraph([
    [[1, 2]], [[0, 2], [2, 3]], [[1, 3]],
  ]);
  const result = computeWeightedApspPacked(graph, n);
  expect(result[packedIndex(0, 1, n)]).toBeCloseTo(2);
  expect(result[packedIndex(0, 2, n)]).toBeCloseTo(5);
}

// ---------------------------------------------------------------------------
// packedIndex test body
// ---------------------------------------------------------------------------

export function testPackedIndexUniqueness(): void {
  const n = 5;
  const indices = new Set<number>();
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) indices.add(packedIndex(i, j, n));
  }
  expect(indices.size).toBe((n * (n + 1)) / 2);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('dijkstra', () => {
  it('4-node weighted graph matches known shortest paths',
    testDijkstraFourNodeWeighted);
  it('prefers shortest weighted path over direct edge',
    testDijkstraPrefersShortestPath);
  it('marks unreachable nodes with Infinity', testDijkstraUnreachable);
});

describe('bfs', () => {
  it('computes correct hop distances', testBfsHopDistances);
  it('disconnected nodes get sentinel value (closestDist+10)',
    testBfsDisconnected);
  it('BFS_UNREACHABLE constant equals INT_MAX', () => {
    expect(BFS_UNREACHABLE).toBe(2147483647);
  });
});

describe('computeApspPacked', () => {
  it('returns Float32Array of length n*(n+1)/2', testApspPackedLength);
  it('diagonal entries are zero', testApspPackedDiagonalZero);
});

describe('computeWeightedApspPacked', () => {
  it('returns Float32Array of length n*(n+1)/2', testWeightedApspPackedLength);
  it('weighted distances match dijkstra results', testWeightedApspPackedValues);
});

describe('packedIndex', () => {
  it('index(0,1,4) = 1', () => { expect(packedIndex(0, 1, 4)).toBe(1); });
  it('index(0,3,4) = 3', () => { expect(packedIndex(0, 3, 4)).toBe(3); });
  it('index(1,2,4) = 5', () => { expect(packedIndex(1, 2, 4)).toBe(5); });
  it('index(0,0,4) = 0', () => { expect(packedIndex(0, 0, 4)).toBe(0); });
  it('index(3,3,4) = 9', () => { expect(packedIndex(3, 3, 4)).toBe(9); });
  it('n=5 produces 15 unique indices', testPackedIndexUniqueness);
});
