# T1 — Fix recursive local subcluster ranking

## Context

graphviz-ts is a faithful TS port of C Graphviz (spec at `~/git/graphviz`, tag
15.0.0). In the dot ranking phase, clusters are ranked recursively: C's
`collapse_cluster(g, subg)` calls `dot1_rank(subg)` to rank the cluster's nodes
**locally** (a 4-node chain → local ranks 0,1,2,3), then `cluster_leader`
unions them. Later, `class1`'s `interclust1` uses each endpoint's local rank
offset (`tail.rank - leader.rank`) to space cluster leaders apart so clusters
**stack** into distinct rank bands.

The TS port's `dot1Rank(subg)` returns all-zero local ranks, so the spacing
offset degenerates to `minlen=1` and chained clusters overlap (6 ranks vs C's
24 on a 6-cluster chain). This is the root cause of the `tests/2471.dot` hang.

## Task

Find why `dot1Rank(subg)` leaves a collapsed subcluster's internal nodes at
rank 0, and fix it so they get their local network-simplex ranks (matching C).
Port faithfully — do not redesign. TDD: failing test first.

## Write-set

- `src/layout/dot/rank.ts` (the fix)
- `src/layout/dot/rank.test.ts` (regression test)
- `src/layout/dot/classify.ts`, `src/layout/dot/cluster.ts` — **only if**
  diagnosis lands there (AD-1); log the reason in the journal.

## Read-set

- `src/layout/dot/rank.ts:262-470` — `collapseCluster`, `dot1Rank`, `rank1`,
  `expandRanksets`, `setMinmax`
- `src/layout/dot/classify.ts:85-145` — `interclust1`, `class1` (faithful; for
  understanding the consumer of local ranks)
- C: `~/git/graphviz/lib/dotgen/rank.c` `dot1_rank`/`collapse_cluster`/`rank1`/
  `expand_ranksets`; `~/git/graphviz/lib/dotgen/class1.c` `interclust1`
- Memory `2471-blocker-is-cluster-ranking` (full probe evidence + harness)

## Architecture decisions

- AD-1 (scope may include classify/cluster), AD-2 (oracle goldens — not this
  task), AD-3 (rank-structure target). See decisions.md.

## Interface contract

After T1, for a cluster containing chain `n0→n1→n2→n3`, the subcluster's nodes
have local ranks `{n0:0, n1:1, n2:2, n3:3}` at `class1` time, and `interclust1`
offsets for inter-cluster edges reflect the tail's local-rank offset (not all
`1`). Consumed by Batch 2 verification.

## Acceptance criteria (Given/When/Then)

1. Given a cluster with chain `n0→n1→n2→n3`, when `dot1Rank` ranks it, then the
   internal local ranks are `0,1,2,3` (not `0,0,0,0`).
2. Given the 6-cluster chain reproducer, when ranked, then the root graph's
   mincross-entry has `nranks=24, totalNodes=54` (== C).
3. Given an inter-cluster edge from a cluster's bottom node, when `interclust1`
   computes its offset, then the offset includes the tail local-rank term
   (> 1 for a multi-rank cluster).
4. Given a cluster-free graph and a single-small-cluster graph, when ranked,
   then output is byte-identical to baseline (no regression — these match C
   today).

## Quality bar

- Write the failing test (criterion 1) first; then fix; then green.
- `npx tsc --noEmit` → 0. `npx vitest run` → all pass (goldens may churn for
  multi-cluster graphs — that's Batch 2; if a cluster-free/single-cluster
  golden churns, STOP, it's a regression).
- Hook limits: 30 lines/fn, CCN 10, 5 params, 500/file.

## Observability

N/A — no new observable operations. (`setMincrossTrace` diagnostic hook exists.)

## Rollback

Reversible — revert the commit. Internal rank-assignment state only.

## Commit

One commit: `fix(T1): rank subcluster internals in dot1Rank (cluster stacking)`.
Body explains the all-zero-local-rank root cause and the C reference.
