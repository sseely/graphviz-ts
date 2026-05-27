# T33 — Rank Assignment via Network Simplex

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source is THE SPEC. T33 ports two files:
`lib/dotgen/rank.c` (1107 lines) and `lib/common/ns.c` (1414 lines, the
network simplex solver). In the C codebase `ns.c` lives in `lib/common/` but
is called exclusively by `lib/dotgen/`. The TypeScript port keeps it in
`src/layout/dot/ns.ts` as a private implementation detail of the dot engine —
not a shared module.

**CDT iteration order — highest-risk dependency in the entire batch.**

`collapse_sets()` in `rank.c` (~line 352) iterates subgraphs via
`agfstsubg(g)..agnxtsubg(subg)`, which traverses cgraph's CDT subgraph
dictionary in key-comparison (sorted) order. When multiple `rank=same`
subgraphs share nodes, `UF_union` calls execute in CDT order and the first
union's representative wins, determining the final rank for ambiguous nodes.
The same order dependency appears in `find_clusters()` (~line 369),
`compile_samerank()` (~line 650), and `compile_clusters()` (~line 868).

The TypeScript port must replicate this by iterating `Graph.subgraphs` in
insertion order that matches the CDT key-comparison sort used in C. Any
divergence produces silently incorrect layouts for graphs with ambiguous
`rank=same` constraints. This is stop condition #2 in the mission brief.

**Two rank pipelines:**

`dot1_rank` is the classic path. `dot2_rank` (newrank=true) builds an
auxiliary graph `Xg`, assigns ranks there, then copies back. Both must be
implemented. The `newrank` attribute on the graph selects the path.

**Network simplex terminology:**

A tight edge has `ND_rank(head) - ND_rank(tail) == ED_minlen`. Slack =
actual length minus minlen. NS minimizes the weighted sum of edge lengths
(slack × weight). The tree is maintained via `NodeInfo.par` (parent edge),
`NodeInfo.low`, and `NodeInfo.lim` (DFS subtree bounds for cut-value
computation).

**Virtual nodes for long edges:**

After rank assignment, `class2` (called from `dot_mincross`, not from
`dot_rank`) inserts virtual nodes at every intermediate rank for long edges
(edges spanning more than one rank). This task implements the rank assignment
only; virtual node insertion is T36.

## Task

Port `lib/dotgen/rank.c` (full 1107 lines) and `lib/common/ns.c` (full 1414
lines) to `src/layout/dot/rank.ts` and `src/layout/dot/ns.ts`. Write tests in
`src/layout/dot/rank.test.ts`. The NS solver in `ns.ts` is a private module
exported only from `rank.ts`; it must not be re-exported from the dot engine
index.

`dot_rank(g)` is the public entry point. Internally it dispatches to
`dot1_rank(g)` or `dot2_rank(g)` based on `GD_flags & NEW_RANK`.

Read the full source of both files before implementing. `rank.c` contains
numerous helper functions (`collapse_sets`, `collapse_cluster`,
`expand_ranksets`, `cleanup1`, `minmax_edges`, `minmax_edges2`,
`edgelabel_ranks`, `rank_set_class`, `set_minmax`, `cluster_leader`) that must
all be translated.

## Write-Set

```
src/layout/dot/rank.ts
src/layout/dot/ns.ts
src/layout/dot/rank.test.ts
```

## Read-Set

- `~/git/graphviz/lib/dotgen/rank.c` — full 1107 lines
- `~/git/graphviz/lib/common/ns.c` — full 1414 lines
- `~/git/graphviz/docs/architecture/lib/dotgen.md` — rank.c section, including
  the CDT iteration order critical note and dot1_rank/dot2_rank pipelines
- `~/git/graphviz/docs/architecture/lib-analysis-wip/interconnections.md` —
  Section 6.1 (CDT Iteration Order dependency)
- `~/git/graphviz/lib/dotgen/acyclic.c` — `reverse_edge` signature consumed
  by rank.c helpers
- `~/git/graphviz/lib/dotgen/decomp.c` — `decompose` signature consumed by
  rank.c

## Architecture Decisions

- AD-1: `ND_rank`, `ND_low`, `ND_lim`, `ND_par`, `GD_rank`, `GD_minrank`,
  `GD_maxrank`, `GD_flags`, `ED_minlen`, `ED_weight`, `ED_cutvalue`,
  `ED_tree_index` all become plain TypeScript fields on `NodeInfo`,
  `GraphInfo`, `EdgeInfo`.
- AD-8: `NodeInfo.rank` is repurposed as x-coordinate during the position
  phase (T35). `ns.ts` reads and writes `NodeInfo.rank` as the rank integer;
  this is safe here because the position phase has not yet begun.
- **CDT order (locked):** `Graph.subgraphs` iteration order must match CDT
  key-comparison order. Tests must verify this against a reference case before
  the task is considered complete.

## Interface Contracts

```typescript
/**
 * Assign integer ranks (layer indices, 0 = topmost for rankdir=TB) to all
 * nodes in g. Stores result in NodeInfo.rank. Dispatches to dot1_rank or
 * dot2_rank based on GD_flags & NEW_RANK.
 *
 * After this function returns:
 *   - Every node has a valid NodeInfo.rank >= 0
 *   - GraphInfo.minrank and GraphInfo.maxrank are set
 *   - Cluster GraphInfo.minrank/maxrank are set via set_minmax
 *
 * CDT ORDER CONTRACT: subgraph iteration in collapse_sets, find_clusters,
 * compile_samerank, and compile_clusters MUST match cgraph CDT key-comparison
 * order. Use Graph.subgraphs as an insertion-ordered Map whose insertion order
 * matches C DT_OSET ascending key order. Violating this contract causes stop
 * condition #2.
 */
export function dotRank(g: Graph): void;

/**
 * Run the network simplex rank solver on the fast graph of g.
 * balance=0: minimize edge length. balance=2: used in position phase for
 * x-coordinate LP (do not call directly from rank.ts with balance=2).
 * maxiter: cap on NS iterations; read from nslimit1 attr in rank.ts.
 */
export function rank(g: Graph, balance: number, maxiter: number): void;
```

### Key NodeInfo fields set by this task

```typescript
interface NodeInfo {
  rank: number;       // AD-8: also used as x-coord during position phase
  low: number;        // NS: DFS subtree lower bound for cut value
  lim: number;        // NS: DFS subtree upper bound for cut value
  par: Edge | null;   // NS: spanning tree parent edge
  ufSize: number;     // union-find subtree size (UF_size)
  ufRoot: Node;       // union-find representative (UF_find target)
}
```

## Acceptance Criteria

- Given a simple A→B→C chain with default minlen=1, when `dotRank(g)` runs,
  then `nodeA.info.rank === 0`, `nodeB.info.rank === 1`,
  `nodeC.info.rank === 2`.
- Given a graph with two `rank=same` subgraphs both containing node X (an
  ambiguous case), when `dotRank(g)` runs, then the rank assigned to X matches
  the C binary output — verified by running the reference binary and comparing
  `ND_rank` values. This is the CDT order test.
- Given an edge A→C spanning rank 0 to rank 2 (minlen=2), after `dotRank`
  completes, then the edge length equals its minlen (tight edge) with zero
  slack.
- Given `newrank=true` on the graph, when `dotRank(g)` runs, then
  `GD_flags & NEW_RANK` is set and `dot2_rank` code path executes (verify via
  the auxiliary graph `Xg` being constructed and `readout_levels` copying ranks
  back).

## Observability

N/A — pure library with no I/O.

## Rollback

Reversible — source-only addition. `ns.ts` is internal to this subdirectory.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for `src/layout/dot/rank.test.ts`
- CDT order test compares TypeScript rank output against C reference binary for
  a graph with ambiguous `rank=same` constraints
- One commit: `feat(dot): add rank assignment and network simplex solver`
