# T32 — Cycle Breaking and Decomposition

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source is THE SPEC. T32 ports two files that
execute before rank assignment: `lib/dotgen/acyclic.c` (DFS-based cycle
reversal) and `lib/dotgen/decomp.c` (connected-component discovery via an
iterative DFS with a global counter mark).

`acyclic.c` uses a back-edge reversal strategy during DFS. The `i--` idiom in
`dfs()` after a back edge is reversed is load-bearing: the edge list shrinks by
one after `reverse_edge` deletes the fast edge, so decrementing the index
causes the loop to re-examine the same position, which now holds the next
unvisited edge. Omitting the `i--` would silently skip one edge per reversal.

`decomp.c` uses a global counter `Cmark` instead of a boolean visited flag.
Incrementing `Cmark` at the start of each `decompose()` call implicitly clears
all marks in O(1) — no reset loop. Edges are pushed onto the DFS stack in
reverse order so that when popped they are processed in forward order,
replicating the behavior of the original recursive DFS.

Both files are called from `dot_rank()` in `rank.c`. `decompose(g, 0)` runs
before `acyclic(g)` in `dot1_rank`; `decompose(g, 1)` runs again (with cluster
skeleton leaders) in `dot_mincross`. This task implements both passes.

## Task

Port `lib/dotgen/acyclic.c` and `lib/dotgen/decomp.c` to TypeScript modules
`src/layout/dot/acyclic.ts` and `src/layout/dot/decomp.ts`. Write tests in
`src/layout/dot/acyclic.test.ts` covering the acceptance criteria. Both modules
operate on the fast-graph data structures (`NodeInfo.in`, `NodeInfo.out`,
`GraphInfo.nlist`) defined in earlier batches. No new data structures are
introduced.

The DFS in `acyclic.c` iterates `ND_out(n)` — the fast-graph out-edge list —
using a numeric index. The list may shrink mid-iteration when `reverse_edge`
calls `delete_fast_edge`. The TypeScript implementation must replicate this
index-based iteration with `i--` on reversal, not a for-of or iterator pattern.

## Write-Set

```
src/layout/dot/acyclic.ts
src/layout/dot/decomp.ts
src/layout/dot/acyclic.test.ts
```

## Read-Set

- `~/git/graphviz/lib/dotgen/acyclic.c` — full source (114 lines)
- `~/git/graphviz/lib/dotgen/decomp.c` — full source
- `~/git/graphviz/lib/dotgen/fastgr.c` — `reverse_edge`, `delete_fast_edge`,
  `merge_oneway`, `virtual_edge` — the helpers `acyclic.c` calls
- `~/git/graphviz/docs/architecture/lib/dotgen.md` — acyclic.c and decomp.c
  sections

## Architecture Decisions

- AD-1: All `ND_*`/`GD_*`/`ED_*` macro accesses become direct TypeScript field
  reads on `NodeInfo`, `GraphInfo`, `EdgeInfo`.
- AD-7: The `ND_alg` void pointer is modeled via `NodeInfo.alg` discriminated
  union; `acyclic.c` does not use `ND_alg` directly, but `virtual_node` calls
  made inside `fastgr.c` helpers do — use `alg: { kind: 'virtual' }`.

## Interface Contracts

```typescript
/**
 * Break cycles in the fast graph of g by reversing back edges found during
 * DFS. Iterates GD_comp(g).list (populated by decompose). Reversed edges are
 * tracked via ED_reversed = true on EdgeInfo so dot_splines can restore them.
 *
 * IMPORTANT: The inner DFS uses index-based iteration with i-- after each
 * reversal, matching the C implementation in lib/dotgen/acyclic.c. Do NOT
 * replace with for-of — the out-edge list shrinks during iteration.
 */
export function acyclic(g: Graph): void;

/**
 * Find connected components of the fast graph. Stores result in
 * GraphInfo.comp.list (array of Node arrays, one per component).
 *
 * pass=0: processes real nodes only.
 * pass=1: uses cluster skeleton leader nodes (called from dot_mincross).
 *
 * Uses a global Cmark counter to avoid O(n) reset. Each call to decompose
 * increments the counter; a node is visited if NodeInfo.mark === currentCmark.
 *
 * Edges pushed onto the DFS stack in REVERSE order so they are popped (and
 * thus processed) in FORWARD order — matching the recursive DFS behavior in
 * the C source (lib/dotgen/decomp.c).
 */
export function decompose(g: Graph, pass: 0 | 1): void;
```

## Acceptance Criteria

- Given a cycle A→B→C→A in the fast graph, when `acyclic(g)` runs, then
  exactly one edge has `EdgeInfo.reversed === true` and all remaining edges
  point in the direction of increasing rank potential (the DFS back-edge).
- Given a cycle where `reverse_edge` shrinks the out-edge list mid-iteration,
  when `acyclic(g)` completes, then no edge in the original cycle remains as a
  back edge (the `i--` idiom correctly re-examines the shifted slot).
- Given a disconnected graph with two separate components, when
  `decompose(g, 0)` runs, then `GraphInfo.comp.list.length === 2` and every
  node appears in exactly one component.
- Given reversed edges tracked by `acyclic`, when the pipeline later calls
  `dot_splines`, then reversed edges can be identified by `EdgeInfo.reversed`
  for coordinate-space restoration.

## Observability

N/A — pure library with no I/O.

## Rollback

Reversible — source-only addition to a new subdirectory.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for `src/layout/dot/acyclic.test.ts`
- One commit: `feat(dot): add acyclic cycle-breaking and decomp components`
