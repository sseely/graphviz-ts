# T35 — X-Coordinate Assignment and Cluster Expansion

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source is THE SPEC. T35 ports two files:
`lib/dotgen/position.c` (1133 lines) and `lib/dotgen/cluster.c`.

**CRITICAL — ND_rank aliasing (AD-8):**

During the position phase, `NodeInfo.rank` is repurposed as the x-coordinate
by the network simplex solver. The field is written by `rank(g, 2, nsiter2)`
(the LP x-position solve) and holds an x-coordinate, NOT a layer index, from
the start of that call until `set_xcoords` restores it.

`set_xcoords(g)` reads `ND_rank(v)` (the x-position written by NS) into
`ND_coord(v).x`, then immediately writes the saved layer index back into
`ND_rank(v)`. After `set_xcoords` returns, every node's `NodeInfo.rank` is
the layer index again.

An assertion must fire if any code reads `NodeInfo.rank` as a layer index
while the position phase is active. Implement this as:

```typescript
// In NodeInfo, add a debug flag:
// rankIsXCoord: boolean — true between create_aux_edges and set_xcoords.
// Add an accessor:
get rankAsLayer(): number {
  if (this.rankIsXCoord) throw new Error(
    'NodeInfo.rank is currently an x-coordinate (AD-8); call set_xcoords first'
  );
  return this.rank;
}
```

The assertion is not present in the C source (the dual-use is implicit) but
is required here to surface bugs early in porting subsequent tasks.

**dot_position(g) pipeline order:**

1. `mark_lowclusters`
2. `set_ycoords`
3. If Concentrate: `dot_concentrate` (from T37's `conc.ts`)
4. `expand_leaves`
5. If flat_edges: `set_ycoords` again
6. `create_aux_edges` → sets `NodeInfo.rankIsXCoord = true`
7. `rank(g, 2, nsiter2)` — NS writes x-coords into NodeInfo.rank
8. If disconnected: `connectGraph` + retry rank
9. `set_xcoords` → reads NodeInfo.rank as x, restores layer index,
   sets `NodeInfo.rankIsXCoord = false`
10. `set_aspect`
11. `remove_aux_edges`

**cluster.c integration:**

`cluster.c` provides `mark_clusters`, `mark_lowclusters`, `build_skeleton`,
`install_cluster`, `expand_cluster`, `merge_ranks`, `interclexp`,
`remove_rankleaders`, `clone_vn`, and `map_path`. These functions are closely
coupled to `position.c` and `mincross.c`. Port them in the same task.

`dot_compute_bb(g, root)` in `position.c` computes bounding boxes. It uses
`ND_rank(GD_ln)` and `ND_rank(GD_rn)` — the cluster left/right virtual nodes
— for x extents after `set_xcoords` has run. These reads are safe because
`set_xcoords` has already restored ranks by the time `dot_compute_bb` runs.

**GD_ln / GD_rn:**

Each cluster gets a left virtual node (`GraphInfo.ln`) and a right virtual
node (`GraphInfo.rn`) created by `make_lrvn`. These are `SLACKNODE` virtual
nodes with `NodeInfo.rank` temporarily holding x-positions during the NS
solve. `dot_compute_bb` reads them as x-positions for cluster bbox
computation — this happens inside the aliasing window and is intentional.

## Task

Port `lib/dotgen/position.c` (full 1133 lines) to `src/layout/dot/position.ts`
and `lib/dotgen/cluster.c` to `src/layout/dot/cluster.ts`. Write tests in
`src/layout/dot/position.test.ts`. Implement the `NodeInfo.rankIsXCoord`
assertion mechanism described above.

`dot_concentrate` is imported from T37's `conc.ts` (forward reference; stub
it as a no-op in this task, to be replaced when T37 lands).

## Write-Set

```
src/layout/dot/position.ts
src/layout/dot/cluster.ts
src/layout/dot/position.test.ts
```

## Read-Set

- `~/git/graphviz/lib/dotgen/position.c` — full 1133 lines
- `~/git/graphviz/lib/dotgen/cluster.c` — full source
- `~/git/graphviz/docs/architecture/lib/dotgen.md` — position.c section
  (dot_position pipeline, set_ycoords, create_aux_edges, make_LR_constraints,
  make_edge_pairs, pos_clusters, set_xcoords, set_aspect, expand_leaves,
  dot_compute_bb) and cluster.c section
- `~/git/graphviz/docs/architecture/lib-analysis-wip/interconnections.md` —
  Section 6.2 (ND_rank dual-use)
- `~/git/graphviz/lib/dotgen/rank.c` — `rank()` function signature (the same
  NS entry point used here with balance=2)

## Architecture Decisions

- AD-8: `NodeInfo.rank` dual-use — explicitly typed and documented. The
  `rankIsXCoord` assertion flag is a TypeScript addition not present in C; it
  is required to catch bugs in subsequent tasks that incorrectly read rank
  during the position phase.
- AD-1: All `GD_*`/`ND_*`/`ED_*` accesses become direct TypeScript fields.
- AD-7: `GraphInfo.ln` and `GraphInfo.rn` (cluster left/right virtual nodes)
  are stored as `Node | null` fields on `GraphInfo`.

## Interface Contracts

```typescript
/**
 * Assign x and y coordinates to all nodes. Uses network simplex as a linear
 * programming solver for x-coordinates. Handles cluster bounding boxes,
 * port alignment, and leaf expansion.
 *
 * WARNING — ND_rank aliasing (AD-8): Between create_aux_edges and
 * set_xcoords, NodeInfo.rank holds the x-coordinate written by the NS
 * solver, NOT the layer index. NodeInfo.rankIsXCoord is set true during
 * this window and the rankAsLayer getter throws if called.
 *
 * Returns 0 on success (WUR annotation matches C signature).
 */
export function dotPosition(g: Graph): number;

/**
 * Mark the innermost (deepest-nested) cluster for each node.
 * Sets NodeInfo.clust to the innermost cluster subgraph.
 * Required before spline routing (T37) and at the start of dot_position.
 */
export function markLowclusters(root: Graph): void;

/**
 * Mark the cluster for rank assignment purposes.
 * Sets NodeInfo.clust and NodeInfo.ranktype for each node in each cluster.
 * Different from markLowclusters — used during rank assignment, not splines.
 */
export function markClusters(g: Graph): void;

/**
 * Build the cluster skeleton for subg: one virtual SLACKNODE per rank.
 * Called from class2 (T36) and expand_cluster.
 */
export function buildSkeleton(g: Graph, subg: Graph): void;

/**
 * Expand cluster subg into the main rank arrays. Calls class2(subg),
 * allocate_ranks(subg), build_ranks(subg, 0), merge_ranks(subg),
 * interclexp(subg), remove_rankleaders(subg).
 */
export function expandCluster(subg: Graph): number;
```

### Assertion contract (must be in position.ts JSDoc)

```typescript
/**
 * ASSERTION: After set_xcoords returns, for every node v in g:
 *   v.info.rank === savedRank[v]   (the pre-position layer index)
 * If this assertion fails, a rank-restoration bug was introduced.
 * See AD-8 and lib/dotgen/position.c set_xcoords().
 */
```

## Acceptance Criteria

- After `dotPosition(g)` completes, `NodeInfo.rank === savedRank` for every
  node (rank restoration assertion: rank equals the layer index it had before
  `dotPosition` was called).
- Given a graph where `create_aux_edges` sets `rankIsXCoord = true`, when any
  code calls `node.info.rankAsLayer` during the aliasing window, then the
  getter throws `'NodeInfo.rank is currently an x-coordinate (AD-8)'`.
- Given a graph with a cluster containing nodes at ranks 0 and 2, after
  `dotPosition(g)` completes, then `cluster.info.bb` (bounding box) fully
  contains all member nodes' `NodeInfo.coord` positions (cluster bbox
  encloses all members).
- Given a graph with two sibling clusters at overlapping rank ranges,
  `separate_subclust` produces auxiliary edges that keep them horizontally
  separated (verified by checking `NodeInfo.coord.x` values: no node in
  cluster A has `x > leftmost x of cluster B`).

## Observability

N/A — pure library.

## Rollback

Reversible — source-only addition.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for `src/layout/dot/position.test.ts`
- The rank-restoration assertion is verified by a dedicated test case
- One commit: `feat(dot): add position x-coord assignment and cluster expansion`
