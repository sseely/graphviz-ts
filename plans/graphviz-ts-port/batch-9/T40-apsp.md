# T40 — All-Pairs Shortest Path (APSP)

## Context

The neato, fdp, and sfdp layout engines all require all-pairs shortest-path
distances as input to their stress functions. `lib/neatogen` provides two
APSP implementations:

- **Dijkstra** (`dijkstra.c`): weighted shortest path using a binary min-heap
  priority queue (`fPQ.h`). Three variants in C: `ngdijkstra` (integer-output,
  float-weight), `dijkstra_f` (float-output, float-weight), and `dijkstra_sgd`
  (writes `term_sgd` structs directly for the SGD caller). The TypeScript port
  combines all into typed overloads or separate functions as appropriate.

- **BFS** (`bfs.c`): unweighted BFS from a source node, writing integral hop
  distances. Used for `MODEL_SHORTPATH` in `compute_apsp_packed`.

Both are called from `stress.c:compute_apsp_packed` and
`stress.c:compute_weighted_apsp_packed` to build the packed upper-triangular
distance matrix `Dij[n*(n+1)/2]` used by the stress majorization engine (T41).

**Priority queue note:** The C `fPQ.h` is a binary max-heap that stores
negated values to simulate a min-heap. The TypeScript port should implement a
proper min-heap directly — the negation trick is a C macro artifact, not an
algorithm requirement. The observable contract is min-priority extraction.

**Disconnected graphs:** Both algorithms must handle disconnected graphs.
Unreachable nodes receive distance `Infinity` (matching C's use of `INT_MAX` or
`FLT_MAX` for unreachable nodes). The stress engine clamps overflow distances
to 0 in its Laplacian computation.

**`vtx_data` adjacency structure:** Nodes are represented as `vtx_data` arrays
where `edges[0]` is always the self-loop index and neighbor edges start at
index 1. `ewgts[k]` is the float edge weight for `edges[k]`. This self-at-[0]
convention must be preserved in the TypeScript `VtxData` interface.

## Task

Port `lib/neatogen/dijkstra.c` and `lib/neatogen/bfs.c` to TypeScript.

1. **`dijkstra`** (`src/layout/neato/dijkstra.ts`): Weighted shortest path
   from a single source. Input: `VtxData[]` adjacency, source index, node
   count. Output: `Float32Array` of distances (float precision matches C
   `dijkstra_f`). Unreachable nodes get `Infinity`. Also implement
   `dijkstraSgd` which writes `TermSgd[]` entries directly (used by T42).

2. **`bfs`** (`src/layout/neato/bfs.ts`): Unweighted BFS from a single
   source. Input: `VtxData[]` adjacency, source index, node count. Output:
   `Int32Array` of hop distances. Unreachable nodes get `2147483647`
   (INT_MAX, matching C behavior, since the packed distance array uses this
   sentinel to detect disconnected pairs).

3. **`computeApspPacked`** and **`computeWeightedApspPacked`**: Convenience
   wrappers that run BFS or Dijkstra from every node and pack results into
   a single upper-triangular `Float32Array` of length `n*(n+1)/2`. Index
   mapping: `Dij[i*(2*n-i-1)/2 + j]` for `j > i` (standard packed
   upper-triangular layout). These are the entry points called by T41.

## Write-Set

- `src/layout/neato/dijkstra.ts`
- `src/layout/neato/bfs.ts`
- `src/layout/neato/apsp.test.ts`

## Read-Set

- `~/git/graphviz/lib/neatogen/dijkstra.c` — all three Dijkstra variants and
  the `fPQ.h` priority queue usage pattern
- `~/git/graphviz/lib/neatogen/bfs.c` — BFS implementation
- `~/git/graphviz/lib/neatogen/fPQ.h` — binary heap structure (understand the
  negation trick; do not replicate it)
- `~/git/graphviz/docs/architecture/lib/neatogen.md` — `dijkstra.c`,
  `bfs.c`, and `defs.h` sections

## Architecture Decisions

- **AD-1**: `VtxData` replaces `vtx_data`; neighbor list is a plain `number[]`
  with `edges[0]` being the self-index. No macro machinery.
- **AD-3**: The packed upper-triangular distance array is an owned `Float32Array`;
  the C equivalent is a heap-allocated `float*` that the caller frees.

## Interface Contracts

```typescript
// src/layout/neato/dijkstra.ts

export interface VtxData {
  nedges: number;    // total entries including self at [0]
  edges: number[];   // edges[0] = self-index; edges[1..] = neighbor indices
  ewgts: number[];   // ewgts[k] = weight for edges[k]
}

export interface TermSgd {
  i: number;   // source node
  j: number;   // destination node
  d: number;   // ideal distance
  w: number;   // weight = 1/d² (MODEL_SHORTPATH) or reweighted
}

/** Float-output Dijkstra for APSP (matches C dijkstra_f). */
export function dijkstra(
  src: number,
  graph: VtxData[],
  n: number,
  dist: Float32Array,
): void;

/** Dijkstra for SGD — writes TermSgd entries for all reachable j > src. */
export function dijkstraSgd(
  graph: import('./sgd').GraphSgd,
  src: number,
  terms: TermSgd[],
): number;  // returns count of terms written

/** Build packed upper-triangular APSP using BFS (unweighted). */
export function computeApspPacked(graph: VtxData[], n: number): Float32Array;

/** Build packed upper-triangular APSP using Dijkstra (weighted). */
export function computeWeightedApspPacked(
  graph: VtxData[],
  n: number,
): Float32Array;

// src/layout/neato/bfs.ts

/** BFS from vertex; writes INT_MAX for unreachable nodes. */
export function bfs(
  vertex: number,
  graph: VtxData[],
  n: number,
  dist: Int32Array,
): void;
```

## Acceptance Criteria

1. `dijkstra` on a weighted 4-node graph (with known edge weights) produces
   distances that match manual shortest-path computation to float precision.

2. `bfs` on an unweighted graph produces correct hop distances; nodes in
   disconnected components receive `2147483647` (`INT_MAX`).

3. Both `computeApspPacked` and `computeWeightedApspPacked` produce
   a `Float32Array` of length `n*(n+1)/2` with correct distances in
   upper-triangular packed order.

## Observability

N/A — pure algorithmic functions; no I/O.

## Rollback

Reversible. Writes only new files under `src/layout/neato/`. Revert by
removing the files.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/layout/neato/apsp.test.ts` exits 0
- One commit: `feat(neato): port dijkstra, bfs, and apsp utilities`
- Tests cover: Dijkstra on a weighted 4-node graph; BFS on an unweighted
  graph; disconnected graph (Infinity / INT_MAX for unreachable nodes);
  packed upper-triangular index correctness for n=4.
