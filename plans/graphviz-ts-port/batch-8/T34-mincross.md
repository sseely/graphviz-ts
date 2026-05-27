# T34 — Crossing Minimization

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source is THE SPEC. T34 ports
`lib/dotgen/mincross.c` (1809 lines) — the most complex single file in
dotgen. Read the full source before implementing.

**Algorithm overview:**

`dot_mincross(g)` minimizes edge crossings by permuting node order within
ranks. The main loop runs up to `MaxIter` (default 24) iterations with early
termination when `trying >= MinQuit` (default 8). Each iteration calls
`mincross_step(g, iter)`, which alternates down-passes (even iter) and
up-passes (odd iter) calling `medians → reorder → transpose` per rank.

After the main loop, a final `transpose` pass runs if crossings > 0.

**Global state — not thread-safe:**

The C implementation uses module-level globals: `Root`, `GlobalMinRank`,
`GlobalMaxRank`, `TE_list`/`TI_list` (scratch arrays for transpose),
`ReMincross` (bool), `MinQuit=8`, `MaxIter=24`, `Convergence=0.995`. In
TypeScript, capture these as fields on a `MincrossContext` struct passed
through the call chain, or as a class instance. Do not use module-level
variables — the dot pipeline must be reentrant for the recursive flat-edge
case (T37).

**adjmatrix_t:**

The flat-edge adjacency matrix is a bit-packed `uint8_t` array (nrows ×
ncols bits). Implement as a `Uint8Array` with the same packing. It is
allocated per-rank and freed in `cleanup2`. It is dynamically resized via
`adjmatrix_resize`.

**Cluster re-minimization:**

After the main pass, each cluster is individually re-minimized via
`mincross_clust(cluster)`, which calls `expand_cluster → ordered_edges →
flat_breakcycles → flat_reorder → mincross(g, 2) → recursion into
sub-clusters → save_vlist`. The `ReMincross=true` flag then triggers a second
global minimization pass `mincross(g, 2)` if any clusters exist and remincross
is not disabled.

**medians computation:**

`medians(g, r0, r1)` computes `NodeInfo.mval` for each node in rank `r0` based
on weighted median of neighbor positions in rank `r1`. The value is
`MC_SCALE × ND_order(node) + port.order`. For even numbers of neighbors the
weighted-median formula uses span-based weights. Zero neighbors: `mval = -1`.

**reorder:**

Bubble-sort-like by `mval`. Cluster nodes must stay grouped (the `sawclust`
flag). `left2right(g, v, w)` returns true if v must stay left of w —
enforced when the nodes belong to different clusters (unless `ReMincross`) or
when the flat adjacency matrix mandates order.

**transpose:**

Tries all adjacent pairs; swaps `(v, w)` if
`in_cross(v,w) + out_cross(v,w) > in_cross(w,v) + out_cross(w,v)`. When
`reverse=true`, swaps on equality too. `in_cross`/`out_cross` are O(|in| ×
|in|) using `ED_xpenalty` as weight.

## Task

Port `lib/dotgen/mincross.c` (full 1809 lines) to
`src/layout/dot/mincross.ts`. Write tests in
`src/layout/dot/mincross.test.ts`. Capture all module-level globals in a
`MincrossContext` object so the pipeline can be re-entered recursively from
T37 (`make_flat_adj_edges`). The context object must be created fresh for each
`dot_mincross` call and for each recursive invocation.

Also port the helper functions called by `init_mincross` that originate in
other files but are needed here: `class2` (T36 will implement the canonical
version; for now create a forward call into T36's module), `decompose(g, 1)`
(already in T32), `allocate_ranks`, `ordered_edges`, `build_ranks`,
`merge2`, `cleanup2`.

`allocate_ranks`, `ordered_edges`, `build_ranks`, `merge2`, `cleanup2`,
`fillRanks`, `checkLabelOrder`, `save_vlist`, `rec_save_vlists`,
`rec_reset_vlists` are all defined in `mincross.c` in C. They belong in
`mincross.ts` in TypeScript.

## Write-Set

```
src/layout/dot/mincross.ts
src/layout/dot/mincross.test.ts
```

## Read-Set

- `~/git/graphviz/lib/dotgen/mincross.c` — full 1809 lines
- `~/git/graphviz/docs/architecture/lib/dotgen.md` — mincross.c section
  (key data structures, `dot_mincross` flow, `mincross_step`, `medians`,
  `reorder`, `transpose`, `in_cross`/`out_cross`, `build_ranks`,
  `allocate_ranks`, `fillRanks`, `checkLabelOrder`)

## Architecture Decisions

- AD-1: `ND_order`, `ND_mval`, `GD_rank[r].v`, `GD_rank[r].n`,
  `GD_rank[r].cache_nc`, `GD_rank[r].valid`, `GD_rank[r].ht1`,
  `GD_rank[r].ht2`, `ED_xpenalty` become plain TypeScript fields.
- **No module-level globals:** Capture `Root`, `GlobalMinRank`,
  `GlobalMaxRank`, `TE_list`, `TI_list`, `ReMincross`, `MinQuit`, `MaxIter`,
  `Convergence` in a `MincrossContext` object. This is mandatory for the
  recursive call in T37.

## Interface Contracts

```typescript
/**
 * Minimize edge crossings in g using the barycenter heuristic with transpose
 * refinement. Handles clusters via recursive expansion and re-minimization.
 *
 * All module-level globals from mincross.c (MinQuit, MaxIter, Convergence,
 * ReMincross, TE_list, TI_list, Root, GlobalMinRank, GlobalMaxRank) are
 * captured in ctx. Pass a fresh MincrossContext for each top-level call and
 * for each recursive call from make_flat_adj_edges (T37).
 *
 * Returns 0 on success (matching the C int return type for WUR annotation).
 */
export function dotMincross(g: Graph, ctx?: MincrossContext): number;

export interface MincrossContext {
  Root: Graph;
  GlobalMinRank: number;
  GlobalMaxRank: number;
  TE_list: Edge[];   // scratch array, size = nedges+1
  TI_list: number[]; // scratch array, size = nedges+1
  ReMincross: boolean;
  MinQuit: number;   // default 8, overridden by mclimit attr
  MaxIter: number;   // default 24, overridden by mclimit attr
  Convergence: number; // default 0.995
}

/**
 * Bit-packed flat-edge adjacency matrix for one rank.
 * data: Uint8Array of ceil(nrows * ncols / 8) bytes.
 * Bit (r, c) = data[r * ncols + c >> 3] >> ((r * ncols + c) & 7) & 1.
 */
export interface AdjMatrix {
  nrows: number;
  ncols: number;
  data: Uint8Array;
}
```

## Acceptance Criteria

- Given a 2-rank graph with 2 nodes per rank and crossing edges
  (A→D, B→C), when `dotMincross(g)` runs, then the crossing count after
  completion is ≤ the crossing count before (mincross never makes things
  worse).
- Given `mclimit=1.0` attribute on the graph, when `dotMincross(g)` runs,
  then `ctx.MaxIter` is scaled accordingly (matching C `mincross_options`
  behavior: `MaxIter = max(1, round(MaxIter * mclimit))`).
- Given a graph with crossings remaining after barycenter iterations, when
  `dotMincross(g)` completes, then `transpose(g, false)` was called as a
  final pass (verify by observing that crossing count after transpose ≤
  crossing count before transpose).
- Given a graph with a cluster, when `dotMincross(g)` completes, then
  `mincross_clust` was invoked for the cluster (cluster's nodes are grouped
  in the final rank ordering).

## Observability

N/A — pure library.

## Rollback

Reversible — source-only addition.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for `src/layout/dot/mincross.test.ts`
- One commit: `feat(dot): add crossing minimization (mincross)`
