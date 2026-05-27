# T37 — Edge Splines, Same-Port, and Concentrated Edges

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source is THE SPEC. T37 ports three files:
`lib/dotgen/dotsplines.c` (2309 lines), `lib/dotgen/sameport.c`, and
`lib/dotgen/conc.c`. Read the full source of `dotsplines.c` before
implementing — it is the largest file in dotgen and contains multiple
non-obvious routing paths.

**CRITICAL — `make_flat_adj_edges` recursive pipeline:**

`make_flat_adj_edges()` in `dotsplines.c` is NOT a leaf function. When flat
edges have adjacent endpoints (ND_order differs by exactly 1), it clones the
endpoint nodes and edges into a new temporary graph, then runs the FULL dot
pipeline on that subgraph:

```
dot_rank(tempG) → dot_mincross(tempG) → dot_position(tempG) → dot_splines_(tempG, /*normalize=*/false)
```

The results are then transformed back into parent coordinate space. The full
pipeline invocation uses `attr_state_t` to save and restore approximately 30
global attribute symbol pointers before and after the recursive call.

This recursion MUST be preserved. Do not flatten it, memoize it, or skip it.
The TypeScript port must call `dotRank`, `dotMincross`, `dotPosition`, and
`dotSplines` on the cloned subgraph. Since T34 captures mincross state in
`MincrossContext`, re-entrancy is safe.

The `cloneGraph`, `cloneNode`, and `cloneEdge` helpers in `dotsplines.c` copy
attributes. For record-shape nodes with `LR` rankdir, `cloneNode` wraps the
label in `{}` to preserve the record structure in the temporary graph.

**`dot_splines(g)` / `dot_splines_(g, normalize)` main flow:**

1. If `EDGETYPE_NONE`: return immediately.
2. If `EDGETYPE_CURVED`: `resetRW`; warn about edge labels.
3. If `EDGETYPE_ORTHO` (ORTHO built): `resetRW`; optional label placement;
   `orthoEdges(g, hasLabels)`; goto finish.
4. `mark_lowclusters`; `routesplinesinit()`; init `spline_info_t sd`.
5. Build sorted edge list per node in rank order; sort by `edgecmp()`
   (8-key lexicographic).
6. Group equivalence classes; for each group dispatch to:
   `makeStraightEdges` (CURVED), `makeSelfEdge` (self-loop),
   `make_flat_edge` (flat), `make_regular_edge` (regular).
7. Place regular edge labels from virtual nodes via `place_vnlabel`.
8. If normalize: `edge_normalize` (reverse splines for back-edges).
9. Place port labels (headlabel/taillabel).
10. `routesplinesterm()`.

**`make_flat_edge` 4 cases:**

| Case | Condition | Routing |
|------|-----------|---------|
| Adjacent | ND_order differs by 1 | `make_flat_adj_edges()` — recursive pipeline |
| Labeled non-adjacent | ED_label set | `make_flat_labeled_edge()` — box routing |
| Bottom routing | tail or head side=BOTTOM, other≠TOP | `make_flat_bottom_edges()` |
| Default top routing | unlabeled, non-adjacent | box array + routesplines/routepolylines |

**`edgecmp` 8-key sort:**

Type descending, |rank_diff| ascending, |x_diff| ascending, AGSEQ ascending,
port comparison, graph type (MAINGRAPH/AUXGRAPH), label ptr for flat, edge
AGSEQ. The sort order determines which edge's spline is routed first and
therefore which gets the tighter corridor. Must match C exactly.

**`sameport.c`:**

`dot_sameports(g)` runs before `dot_splines` in the pipeline. It merges edges
with `samehead`/`sametail` attributes onto the same port. The port position is
computed by averaging direction vectors (not angles, to avoid atan2 wrap-around
issues) and calling `shape_clip` to move the port to the node boundary.
The port's `order` field uses `MC_SCALE*(lw+x)/(lw+rw)` — used by spline
routing even though mincross has already completed.

**`conc.c`:**

`dot_concentrate(g)` runs if `concentrate=true`. Two passes (down and up) over
ranks; merges adjacent virtual nodes that share the same tail or head via
`mergevirtual`. Called from `dot_position` as an optional pre-step. In this
task, implement the full `conc.ts` module and update the stub in `position.ts`
(T35) with the real import.

**ORTHO integration:**

The TypeScript port treats `lib/ortho/` as a conditionally-imported module.
`dotsplines.ts` must check whether an ortho router is registered with
`GvcContext` before calling it. If no ortho router is registered, the ORTHO
path is skipped and spline routing continues normally.

**`spline_info_t` fields:**

```typescript
interface SplineInfo {
  LeftBound: number;
  RightBound: number;
  Splinesep: number;   // = nodesep/4
  Multisep: number;    // = nodesep
  RankBox: Box[];      // per-rank routing corridor, indexed by rank
}
```

## Task

Port `lib/dotgen/dotsplines.c` (full 2309 lines) to
`src/layout/dot/splines.ts`, `lib/dotgen/sameport.c` to
`src/layout/dot/sameport.ts`, and `lib/dotgen/conc.c` to
`src/layout/dot/conc.ts`. Write tests in `src/layout/dot/splines.test.ts`.
Update the `dot_concentrate` stub in `position.ts` with the real import.

Spline routing calls into `lib/common/` functions (`routesplines`,
`routepolylines`, `routesplinesinit`, `routesplinesterm`, `beginpath`,
`endpath`, `clip_and_install`, `makeStraightEdges`, `makeSelfEdge`) — these
are already implemented in Batch 5c. Import them from `src/common/splines.ts`.

## Write-Set

```
src/layout/dot/splines.ts
src/layout/dot/sameport.ts
src/layout/dot/conc.ts
src/layout/dot/splines.test.ts
src/layout/dot/position.ts   (replace dot_concentrate stub with real import)
```

## Read-Set

- `~/git/graphviz/lib/dotgen/dotsplines.c` — full 2309 lines
- `~/git/graphviz/lib/dotgen/sameport.c` — full source
- `~/git/graphviz/lib/dotgen/conc.c` — full source
- `~/git/graphviz/docs/architecture/lib/dotgen.md` — dotsplines.c section
  (ORTHO boundary, dot_splines flow, make_flat_edge 4 cases,
  make_flat_adj_edges recursive pipeline, make_regular_edge,
  edgecmp, helpers), sameport.c section, conc.c section
- `~/git/graphviz/docs/architecture/lib-analysis-wip/interconnections.md` —
  Section 6.10 (recursive dot pipeline for flat adjacent edges)

## Architecture Decisions

- AD-1: `ED_spl`, `ED_edge_type`, `ED_tree_index`, `ED_to_orig`,
  `ED_tail_port`, `ED_head_port` become direct TypeScript fields.
- AD-2: ORTHO router is conditionally invoked via `GvcContext`. No compiled
  conditional; check `ctx.orthoRouter !== null` at runtime.
- **Recursive pipeline (locked):** `make_flat_adj_edges` MUST call
  `dotRank + dotMincross + dotPosition + dotSplines` recursively on the cloned
  subgraph. Do NOT flatten, memoize, or skip this recursion.

## Interface Contracts

```typescript
/**
 * Route edges of g as Bézier splines, polylines, straight lines, or
 * orthogonal segments. The dominant path is spline routing via pathplan.
 *
 * CRITICAL: This function is re-entrant. make_flat_adj_edges calls the full
 * dot pipeline (dotRank → dotMincross → dotPosition → dotSplines) on a
 * cloned temporary subgraph. Pass ctx through all recursive calls.
 *
 * Returns 0 on success (WUR annotation).
 */
export function dotSplines(g: Graph, ctx: GvcContext): number;

/**
 * Internal variant — normalize=false skips edge_normalize. Used by
 * make_flat_adj_edges for the recursive call on the temporary subgraph.
 */
export function dotSplines_(g: Graph, normalize: boolean, ctx: GvcContext): number;

/**
 * Merge edges with samehead/sametail attributes onto shared ports.
 * Runs before dot_splines in the pipeline.
 */
export function dotSameports(g: Graph): void;

/**
 * Merge adjacent parallel virtual nodes when concentrate=true.
 * Runs inside dot_position before create_aux_edges.
 * Returns 0 on success (WUR annotation).
 */
export function dotConcentrate(g: Graph): number;
```

## Acceptance Criteria

- Given a flat edge between adjacent nodes (ND_order differs by 1), when
  `dotSplines(g, ctx)` runs, then `make_flat_adj_edges` is invoked, which
  calls `dotRank + dotMincross + dotPosition + dotSplines_` on a cloned
  subgraph (verify by inspecting the cloned graph in tests — it must have
  coordinates assigned).
- Given two edges sharing the same `sametail` port attribute, when
  `dotSameports(g)` runs, then both edges have `EdgeInfo.tailPort` pointing
  to the same computed port position (same `x` and `y` values).
- Given `concentrate=true` and two parallel virtual nodes with the same tail
  node, when `dotConcentrate(g)` runs, then the two virtual nodes are merged
  into one (rank array length decreases by 1 at that rank).
- Given a backward edge (reversed by `acyclic`), when `dotSplines(g, ctx)`
  runs with `normalize=true`, then `edge_normalize` reverses the spline
  control point order so it reads head-to-tail in coordinate space.

## Observability

N/A — pure library.

## Rollback

Reversible — source-only addition.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for `src/layout/dot/splines.test.ts`
- Recursion test confirms cloned subgraph has `NodeInfo.coord` set after
  `make_flat_adj_edges`
- One commit: `feat(dot): add spline routing, sameport, and edge concentration`
