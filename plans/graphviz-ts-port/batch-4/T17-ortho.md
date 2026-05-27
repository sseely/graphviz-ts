# T17 — lib/ortho Port (Orthogonal Edge Routing)

## Context

The project is a faithful TypeScript 5.x port of Graphviz `lib/`, targeting
SVG output. TypeScript strict mode, Vitest, esbuild, EPL-2.0, no Node.js in
core.

`lib/ortho` implements the complete orthogonal edge routing pipeline used by
both `dot` (via `lib/dotgen/dotsplines.c`) and `neato` (via
`lib/neatogen/neatosplines.c`) when `splines=ortho`. The single exported
entry point is `orthoEdges(g: Graph, useLbls: boolean): void` (analogous to C
`void orthoEdges(Agraph_t *g, bool useLbls)`).

The full pipeline in `orthoEdges`:

1. Collect edges; sort shortest-first (`qsort` with `edgecmp`).
2. Build maze (`mkMaze`) — partition free space into cells via Seidel's
   randomized trapezoidation (see below).
3. Route each edge via Dijkstra on the search graph (`shortPath` in sgraph).
4. Extract horizontal and vertical channels.
5. Assign segments to channels.
6. Assign tracks (build per-channel dependency graphs, topological sort).
7. Install splines — convert track numbers to coordinates, call
   `clipAndInstall`.

### SEED=173 — critical, non-negotiable

`lib/ortho/partition.c` calls `srand48(173)` once at the start of
`partition()` before calling `generateRandomOrdering`. This seed is
**hard-coded** and **not a parameter**. It exists to make the trapezoidation
order deterministic and reproducible across platforms and runs.

In TypeScript, implement a seeded PRNG (use the MT19937 from `src/util/`
seeded with 173). The seed constant must be named `SEED` and must equal `173`.
It must not be exposed as a function parameter or configuration option.

```typescript
const SEED = 173; // non-negotiable: matches lib/ortho/partition.c srand48(173)
```

### Partition algorithm

`partition.c` runs Seidel's randomized incremental trapezoidation **twice**:
once in the normal coordinate frame and once with x and y swapped (via
`perp()`). The intersection of the two rectangle sets yields cells bounded on
all four sides.

The trapezoidation in `trapezoid.c` uses:
- Q-structure (query DAG) initialized from the first segment
- `addSegment` for each subsequent segment in random order (from
  `generateRandomOrdering`)
- `mergeTrapeziods` on both sides after each segment insertion
- `findNewRoots` at `log*(n)` intervals for O(n log* n) expected complexity
- `locateEndpoint` for recursive DAG traversal

Implement `mathLogstarN` and `mathN` exactly as in the C source:
- `mathLogstarN(n)` = number of times log₂ must be applied before result < 1
- `mathN(n, h)` = `ceil(n / log^(h)(n))`

Geometric constants: `C_EPS = 1e-7` for floating-point comparisons in
`fpEqual`, `dfpCmp`, `equalTo`, `greaterThan`.

### Dijkstra in sgraph

Distance values are stored **negated** in `nVal`. The max-heap PQ returns the
node with the largest stored value (= smallest actual distance). Finalized
nodes are flipped positive (`nVal *= -1`), preventing re-relaxation.

`UNSEEN = Number.MIN_SAFE_INTEGER` — used to initialize unvisited nodes.

### Weight constants

```typescript
const delta = 1;      // weight per unit length
const mu = 500;       // bend penalty per bend edge
const BIG = 16384;    // near-infinite weight for overfull/degenerate channels
const MARGIN = 36;    // points added to bounding box in each direction
```

`CHANSZ(w) = Math.floor((w - 3) / 2)` — effective capacity of a channel of
width w. If `CHANSZ(w) < 2`, channel gets weight BIG unless `MZ_SMALLV` or
`MZ_SMALLH`.

### Track polarity (preserve this asymmetry)

Horizontal segments: track 1 is **closest to the top** of the channel
(`1.0 - f` in `htrack`). Vertical segments: track 1 is at the **leftmost**
position. This asymmetry is in the C source; do not "fix" it.

### `useLbls` parameter

Inside `orthoEdges`, `useLbls` is immediately set to `false` (with a console
warning that edge labels are unsupported; `xlabel` attributes are recommended
instead). Preserve this behavior exactly.

### Self-loops

`addLoop` connects `sp` to top-facing snodes and `dp` to bottom-facing snodes
of the common cell. The comment in the C source notes this is best-effort.
Preserve the same behavior.

### Concentration

When `Concentrate=true` in `GraphInfo`, edges between the same node pair are
routed only once (first occurrence). The `PointSet` is keyed on
`(min(tailIdx, headIdx), max(tailIdx, headIdx))`.

## Task

Port the complete `lib/ortho` pipeline to TypeScript as a single module
`src/ortho/index.ts`. The entry point is:

```typescript
export function orthoEdges(g: Graph, useLbls: boolean): void;
```

Port all supporting types and algorithms: `structures.h` types (segment,
route, channel, bend), the maze builder, the sgraph + Dijkstra, the priority
queue (fPQ), the rawgraph + topological sort, and the partition / trapezoid
algorithms.

All internal types may be unexported. Only `orthoEdges` and the types it
directly accepts/returns need to be exported.

## Write-Set

- `src/ortho/index.ts`
- `src/ortho/ortho.test.ts`

## Read-Set

- `~/git/graphviz/lib/ortho/ortho.h` — public API
- `~/git/graphviz/lib/ortho/ortho.c` — pipeline orchestration
- `~/git/graphviz/lib/ortho/maze.h` / `maze.c` — maze construction
- `~/git/graphviz/lib/ortho/sgraph.h` / `sgraph.c` — search graph + Dijkstra
- `~/git/graphviz/lib/ortho/fPQ.h` / `fPQ.c` — priority queue
- `~/git/graphviz/lib/ortho/rawgraph.h` / `rawgraph.c` — topological sort
- `~/git/graphviz/lib/ortho/partition.h` / `partition.c` — rectangle partition
- `~/git/graphviz/lib/ortho/trap.h` — trapezoid types
- `~/git/graphviz/lib/ortho/trapezoid.c` — Seidel trapezoidation
- `~/git/graphviz/lib/ortho/structures.h` — shared data types
- `~/git/graphviz/docs/architecture/lib/ortho.md` — full analysis and notes

## Architecture Decisions

- **SEED = 173** is hard-coded and non-negotiable. Matches
  `lib/ortho/partition.c` `srand48(173)`. Not a parameter.
- Uses MT19937 from `src/util/` seeded with 173 for `generateRandomOrdering`.

## Interface Contracts

```typescript
import { Graph } from '../common/types.js';

/**
 * Routes all edges in the laid-out graph `g` using orthogonal routing.
 *
 * `useLbls` is accepted for API compatibility but is immediately set to false
 * internally; edge labels are not supported (use xlabel instead).
 *
 * Precondition: all ND_coord, ND_xsize, ND_ysize fields must be populated
 * (node positions and sizes from a completed layout pass).
 *
 * Side effect: populates ED_spl on every edge with the computed orthogonal
 * spline, via clipAndInstall.
 */
export function orthoEdges(g: Graph, useLbls: boolean): void;
```

## Acceptance Criteria

1. `SEED` constant equals `173` and is not a parameter to `orthoEdges` or any
   internal function. Test: read the exported constant (or inspect the module)
   and assert `SEED === 173`.
2. Routing is deterministic: calling `orthoEdges(g, false)` twice on
   identical graph objects produces identical spline data on each edge (same
   control points, same order).
3. Maze Dijkstra produces the shortest orthogonal path: on a simple two-node
   graph with a 3×3 node grid of obstacles, the routed edge path avoids all
   node bounding boxes and has the expected bend count (at most 2 bends for
   adjacent nodes).
4. `useLbls = true` produces a console warning and proceeds with
   `useLbls = false` — no error thrown, routing still completes.

## Observability

N/A — pure algorithm module.

## Rollback

Reversible. No other module imports from `src/ortho/` until the dot splines
module in Batch 8.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/ortho/ortho.test.ts` exits 0
- All four acceptance criteria pass as explicit test cases
- 90% line coverage, 90% branch coverage on `src/ortho/index.ts`
  (vitest `--coverage`)
