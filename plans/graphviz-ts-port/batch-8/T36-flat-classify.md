# T36 — Flat Edges and Edge Classification

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source is THE SPEC. T36 ports three files:
`lib/dotgen/flat.c`, `lib/dotgen/class1.c`, and `lib/dotgen/class2.c`.

**class1.c** runs inside `dot1_rank` (before network simplex) and builds the
fast-graph virtual edge structure for rank constraints. It calls
`mark_clusters`, identifies cluster-crossing edges, and routes them through a
SLACKNODE intermediate node (the `interclust1` path) with `CL_BACK` weight
penalty. The `interclust1` offset calculation:
`offset = ED_minlen(e) + ND_rank(UF_find(t)) - ND_rank(UF_find(h))`
is split into two sub-edge lengths via integer arithmetic that must be
replicated exactly.

**class2.c** runs at the start of `dot_mincross`. It creates virtual node
chains for long edges (every intermediate rank needs a virtual node for
crossing minimization). The main loop processes edges in a specific order:
cluster edges via `interclrep`, multi-edges via `merge_chain`/`other_edge`,
self-edges via `other_edge`, flat edges via `flat_edge(g, e)`, forward edges
via `make_chain`, and backward edges via `make_chain` on the reverse direction.
The virtual-weight class table (see architecture doc) weights singleton nodes
heavily to prevent arbitrary drift.

**flat.c** processes flat (same-rank) edges after mincross. It calls
`checkFlatAdjacent`, `flat_node` (creates a virtual node in rank r-1 for
non-adjacent labeled flat edges), `flat_limits`, and — in the exceptional case
where labeled flat edges exist at rank 0 — `abomination`, which shifts the
entire rank array forward by one. The name `abomination` is from the C source
and must appear in the TypeScript port (as a comment if not as the function
name itself).

**make_chain and virtual weight table:**

```
weights[ORDINARY][ORDINARY]=1  weights[ORDINARY][SINGLETON]=2
weights[SINGLETON][ORDINARY]=2  weights[SINGLETON][SINGLETON]=8
all others: 1
```

Singleton nodes are those isolated in their rank (no neighbors in adjacent
ranks); they get high-weight edges to prevent them from drifting arbitrarily
during crossing minimization.

**class2 stub in T34:**

T34 (mincross) contains a forward-call stub to `class2`. When T36 lands, that
stub must be replaced with the real import from `classify.ts`. This
replacement is part of T36's write-set on `mincross.ts` — add `mincross.ts`
to the write-set explicitly.

## Task

Port `lib/dotgen/flat.c`, `lib/dotgen/class1.c`, and `lib/dotgen/class2.c` to
`src/layout/dot/flat.ts` and `src/layout/dot/classify.ts`. Write tests in
`src/layout/dot/flat.test.ts`. Update `src/layout/dot/mincross.ts` to replace
the `class2` stub with the real import.

`fastgr.c` helper functions (`fast_edge`, `delete_fast_edge`, `virtual_node`,
`virtual_edge`, `flat_edge`, `other_edge`, `merge_oneway`, etc.) are used
pervasively. Port these into a `src/layout/dot/fastgr.ts` helper module that
both `classify.ts` and `flat.ts` import. `fastgr.ts` is added to the
write-set.

## Write-Set

```
src/layout/dot/flat.ts
src/layout/dot/classify.ts
src/layout/dot/fastgr.ts
src/layout/dot/flat.test.ts
src/layout/dot/mincross.ts   (replace class2 stub with real import)
```

## Read-Set

- `~/git/graphviz/lib/dotgen/flat.c` — full source
- `~/git/graphviz/lib/dotgen/class1.c` — full source
- `~/git/graphviz/lib/dotgen/class2.c` — full source
- `~/git/graphviz/lib/dotgen/fastgr.c` — full source (fast-graph primitives)
- `~/git/graphviz/docs/architecture/lib/dotgen.md` — class1.c, class2.c,
  flat.c, fastgr.c sections

## Architecture Decisions

- AD-1: `ED_to_virt`, `ED_count`, `ED_xpenalty`, `ED_weight`, `ED_minlen`,
  `ND_weight_class`, `GD_has_flat_edges`, `GD_nlist`, `ND_next`, `ND_prev`
  all become direct TypeScript fields.
- AD-7: Virtual nodes created by `virtual_node()` use `NodeInfo.alg = { kind:
  'virtual' }`. Label virtual nodes use `alg = { kind: 'labelVirtual', label:
  TextLabel }`. SLACKNODE virtual nodes use `alg = { kind: 'slack' }`.

## Interface Contracts

```typescript
/**
 * Create virtual edges in the fast graph for rank constraint enforcement.
 * Handles cluster-crossing edges via interclust1 (SLACKNODE intermediate).
 * Must run after mark_clusters and before network simplex (dot1_rank).
 */
export function class1(g: Graph): void;

/**
 * Post-rank edge classification. Creates virtual node chains for long edges.
 * Handles multi-edges, cluster edges, flat edges, forward/backward edges.
 * Must run at the start of dot_mincross.
 */
export function class2(g: Graph): void;

/**
 * Process flat (same-rank) edges. Creates label virtual nodes in rank r-1.
 * May call abomination() to insert rank -1 when labeled flat edges exist at
 * the topmost rank.
 *
 * NOTE: The function named 'abomination' in lib/dotgen/flat.c is preserved
 * here. It shifts the entire rank array forward by one rank — O(n) operation.
 * It is only triggered when there is no other place for a flat edge label.
 *
 * Returns true if rank arrays were reset (checkLabelOrder was called).
 */
export function flatEdges(g: Graph): boolean;
```

### Virtual weight class constants (must match C exactly)

```typescript
export const VIRTUAL_WEIGHTS: readonly number[][] = [
  // [ORDINARY, ORDINARY, SINGLETON, ...] — indices match NodeInfo.weightClass
  // Row 0 (ORDINARY): [1, 2, 1, ...]
  // Row 1 (SINGLETON): [2, 8, 1, ...]
  // All others: 1
];
```

## Acceptance Criteria

- Given a flat edge (tail and head at the same rank), when `class2(g)` runs,
  then the edge appears in `NodeInfo.flatOut` (not `NodeInfo.out`) and
  `GraphInfo.hasFlatEdges === true`.
- Given a forward edge spanning 3 ranks (A at rank 0, B at rank 2), when
  `class2(g)` runs, then one virtual node is created at rank 1 and two
  virtual edges connect A→vn→B.
- Given a backward edge (head rank < tail rank), when `class2(g)` runs, then
  the edge is converted to a forward chain via `make_chain(g, head, tail, e)`
  (the reversed-direction path) matching C behavior.
- Given a labeled non-adjacent flat edge at rank 0 (no rank above it), when
  `flatEdges(g)` runs, then `abomination` is called and `GraphInfo.minrank`
  is decremented by 1.

## Observability

N/A — pure library.

## Rollback

Reversible — source-only addition.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for `src/layout/dot/flat.test.ts`
- One commit: `feat(dot): add flat edges and edge classification (class1/2)`
