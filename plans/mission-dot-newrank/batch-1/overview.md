# Batch 1 — Foundations (parallel)

Three independent tasks with disjoint write-sets. T1 lands the cgraph
subgraph/node primitives (consumed by T3/T4). T2 lands the `removeFromRank`
helper (consumed by T4). T5 is the self-contained LEAFSET `expand_leaves` port
(independent of newrank). All run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Port `agsubg`/`agsubnode`/`agnode`/`agdelnode`/`agdelsubg` | opus | `src/model/cgraph-ops.ts`, `src/model/cgraph-ops.test.ts` | — | [x] |
| T2 | `removeFromRank` helper (inverse of `install_in_rank`) | opus | `src/layout/dot/fastgr.ts`, `src/layout/dot/fastgr.test.ts` | — | [x] |
| T5 | Implement `expandLeaves` (LEAFSET leaf-slot edge handling) | opus | `src/layout/dot/position.ts`, `src/layout/dot/leafset.test.ts` | — | [x] |

Gate per [../README.md](../README.md). One commit per task.
- T1: `feat(T1): port cgraph subgraph/node ops for newrank fill nodes`
- T2: `feat(T2): add removeFromRank (inverse of install_in_rank)`
- T5: `feat(T5): implement expand_leaves for LEAFSET leaf packing`
