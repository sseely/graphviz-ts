# T47 — sfdp Layout Engine (Scalable Force-Directed)

## Context

sfdp is the multilevel force-directed layout engine for large graphs. It lives
in `lib/sfdpgen/`. The algorithm has three phases:

1. **Multilevel coarsening** (`Multilevel.c`): Builds a hierarchy of
   progressively smaller graphs via heavy-edge matching and supervariable
   detection. Uses `lib/sparse/` CSR matrices (T16, Batch 4).

2. **Force iteration per level** (`spring_electrical.c`): Spring-electrical
   force-directed layout at each level. Uses Barnes-Hut QuadTree approximation
   for large graphs (from T16's `QuadTree.ts`).

3. **Prolongation and post-processing** (`spring_electrical.c`): After solving
   at the coarsest level, coordinates are prolongated (interpolated) back up
   through the hierarchy, with optional smoothing.

**CRITICAL — save/restore of `spring_electrical_control` (section 6.11 of
interconnections.md):**

`multilevel_spring_electrical_embedding` saves `ctrl0 = *ctrl` on entry and
restores `*ctrl = ctrl0` before return. During execution, it mutates
`ctrl.K`, `ctrl.step`, `ctrl.random_start`, and `ctrl.adaptive_cooling`.
These mutations are intentional (they tune parameters for each coarsening
level) but the restoration makes repeated calls idempotent. This must be
preserved exactly. Omitting the restore causes stale state on the second
call.

**Coarsening (`Multilevel.c`):**

Two-step clustering:
1. Supervariable detection: nodes with identical adjacency patterns are
   clustered first, up to `MAX_CLUSTER_SIZE = 4` per cluster.
2. Heavy-edge matching: remaining unmatched nodes are paired with their
   heaviest-edge neighbor using a random permutation of node order.

The coarsening loop applies until the reduction ratio per step exceeds
`min_coarsen_factor = 0.75` (less than 25% reduction per step triggers
another internal step, composing P/R matrices). Stopping conditions:
`nc == n` (no reduction), `nc < 4` (too small), or level cap reached.

**Barnes-Hut QuadTree:**

`spring_electrical_embedding_fast` uses `QuadTree_get_repulsive_force` from
T16's `QuadTree.ts` for bulk repulsion. The opening angle `bh = 0.6`:
a quadtree cell is treated as a supernode if `cell_width / dist < 0.6`.
Quadtree is only used when `n >= 45`.

**Force normalization:**

Unlike standard gradient descent, the spring-electrical model normalizes
each node's force vector to unit length, then moves the node exactly `step`
units in that direction. This bounds displacement per iteration regardless of
force magnitude. The implementation must match this exactly — the normalized
force is not a scaling optimization, it is the algorithm.

**Adaptive cooling:**

`update_step` implements three-way adaptive cooling:
- Force grew (`Fnorm >= Fnorm0`): multiply step by `cool = 0.90`
- Marginal improvement (`Fnorm > 0.95 × Fnorm0`): keep step
- Force decreased: multiply step by `0.99 / cool` (slight speedup)

**Auto-selection of repulsion exponent `p`:**

If `p == AUTOP (-1.0001234)`: set `p = -1`. Then check for power-law
graph: if ≥80% of the mode-degree is degree-1 AND degree-1 nodes are
≥30% of total, set `p = -1.8` (stronger short-range repulsion). The
`power_law_graph` heuristic must be ported exactly.

**Coordinate storage:**

Row-major layout: `x[i * dim + k]` is the k-th coordinate of node i. All
coordinate arrays in sfdp follow this convention.

**Post-processing smoothers (`post_process.c`):**

The `spring_electrical_control.smoothing` field selects the post-layout
smoother. The TypeScript port implements all six variants (NONE, stress
majorization in 3 forms, spring, triangle/RNG). The sparse CG solver in
`sparse_solve.c` (`SparseMatrix_solve`) is ported as part of T16 or within
this task — coordinate with T16 if it isn't already there.

**Overlap removal:**

After layout and post-processing, `remove_overlap` from `lib/neatogen/
overlap.c` is called when `ctrl.overlap >= 0`. This routes to T43's
`removeOverlap`.

**`sfdpinit.c` entry point:**

`sfdp_layout` decomposes the graph into connected components, runs
`sfdpLayout` on each, packs results. `tuneControl` reads per-graph
attributes: `K`, `repulsiveforce`, `levels`, `smoothing`, `quadtree`,
`beautify`, `overlap_shrink`, `rotation`, `label_scheme`.

**`ctrl.random_seed = 123` default:**

The default random seed is 123 (not 0). Override via the `start` attribute.
This is distinct from neato's seed — sfdp reads it from `spring_electrical_control`.

## Task

Port `lib/sfdpgen/` to TypeScript. This task depends on T40 (Dijkstra for
distance computation) and T16 (lib/sparse: SparseMatrix, QuadTree).

1. **`hierarchy.ts`**: Port `Multilevel.c`. `MultilevelNew`, `MultilevelDelete`,
   `MultilevelGetCoarsest`. Heavy-edge matching with random permutation
   (`gvPermutation` from T16). Coarsening until adequate reduction per level.

2. **`spring.ts`**: Port `spring_electrical.c`. Force model, Barnes-Hut
   approximation, adaptive cooling, multilevel driver including save/restore
   of control struct.

3. **`smoother.ts`**: Port `post_process.c` and `sparse_solve.c`. All six
   smoother variants, the sparse diagonal-preconditioned CG solver.

4. **`init.ts`**: Port `sfdpinit.c`. `sfdpInitGraph`, `tuneControl`,
   `sfdpLayout`, `sfdpCleanup`.

5. **`index.ts`**: `sfdpLayout(g, ctx)` — public entry point registered as
   `"sfdp"`. Calls: init → per-component layout → pack → postprocess.

## Write-Set

- `src/layout/sfdp/init.ts`
- `src/layout/sfdp/hierarchy.ts`
- `src/layout/sfdp/spring.ts`
- `src/layout/sfdp/smoother.ts`
- `src/layout/sfdp/index.ts`
- `src/layout/sfdp/sfdp.test.ts`

## Read-Set

- `~/git/graphviz/lib/sfdpgen/sfdpinit.c` — graph-level init, attribute
  parsing, component decomposition, `tuneControl`
- `~/git/graphviz/lib/sfdpgen/compute_hierarchy.c` — note: in C, this file
  handles `compute_hierarchy` used by neato DiG-CoLa; the sfdp hierarchy is
  in `Multilevel.c`
- `~/git/graphviz/lib/sfdpgen/spring_electrical.c` — full 1206-line file:
  force model, Barnes-Hut, adaptive cooling, multilevel driver, save/restore
  of control struct, prolongation, beautify_leaves, pcp_rotate
- `~/git/graphviz/lib/sfdpgen/SpringSmoother.c` — post-process smoothers,
  sparse CG, ideal distance matrix computation
- `~/git/graphviz/docs/architecture/lib/sfdpgen.md` — all sections; the
  "Non-obvious behavior" items under `spring_electrical.c` and
  `multilevel_spring_electrical_embedding` are critical
- `~/git/graphviz/docs/architecture/lib-analysis-wip/interconnections.md` —
  section 6.11 (control struct save/restore) and the lib/sparse dependency
  table

## Architecture Decisions

- **AD-1**: `ND_pos` → `n.info.pos`; `GD_ndim` → `g.info.ndim`.
- Control struct is a plain TypeScript object (value type); save/restore is
  `const ctrl0 = { ...ctrl }` on entry and `Object.assign(ctrl, ctrl0)` on
  exit.
- `AUTOP = -1.0001234` is a named constant, not a magic number.

## Interface Contracts

```typescript
// src/layout/sfdp/spring.ts

export const AUTOP = -1.0001234;

export interface SpringElectricalControl {
  p: number;              // repulsion exponent; AUTOP triggers auto-select
  K: number;
  multilevels: number;
  maxQtreeLevel: number;
  maxiter: number;
  step: number;
  randomSeed: number;
  randomStart: boolean;
  adaptiveCooling: boolean;
  beautifyLeaves: boolean;
  smoothing: number;
  overlap: number;
  doShrinking: boolean;
  tscheme: number;
  initialScaling: number;
  rotation: number;
  edgeLabelingScheme: number;
}

export function springElectricalControlNew(): SpringElectricalControl;

export function multilevelSpringElectricalEmbedding(
  dim: number,
  A: import('../../sparse/SparseMatrix').SparseMatrix,
  ctrl: SpringElectricalControl,
  labelSizes: Float64Array | null,
  x: Float64Array,
  nEdgeLabelNodes: number,
  edgeLabelNodes: number[],
  flag: { value: number },
): void;

// src/layout/sfdp/index.ts

/** Public entry point. Registered as the "sfdp" layout engine. */
export function sfdpLayout(
  g: import('../../model/Graph').Graph,
  ctx: import('../../gvc/context').GvcContext,
): void;
```

## Acceptance Criteria

1. `SpringElectricalControl` struct is saved on entry to
   `multilevelSpringElectricalEmbedding` and restored on exit — mutations
   to `K`, `step`, `randomStart`, `adaptiveCooling` during execution do not
   persist to the caller.

2. The Barnes-Hut QuadTree is used for graphs with `n >= 45` and
   `tscheme != QUAD_TREE_NONE` (verified by checking that
   `QuadTree_get_repulsive_force` is called in the test).

3. Engine is registered under the string key `"sfdp"`.

## Observability

N/A — layout functions; no external I/O.

## Rollback

Reversible. Writes only new files under `src/layout/sfdp/`. Revert by
removing the files.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/layout/sfdp/sfdp.test.ts` exits 0
- One commit: `feat(sfdp): port sfdp multilevel spring-electrical engine`
- Tests cover: `AUTOP === -1.0001234`; control struct save/restore (mutate
  `ctrl.K` inside a spy, verify caller's value unchanged after return);
  engine registration as `"sfdp"`; coarsening on a 10-node graph reduces
  to fewer nodes at level 1; layout on a 10-node connected graph produces
  non-trivial positions.
