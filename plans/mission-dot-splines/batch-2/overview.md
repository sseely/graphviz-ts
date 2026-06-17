# Batch 2 — Adjacent-rank forward edges → faithful

Migrate plain adjacent-rank forward edges from the simplified fitter
(`straightEdgeSplineWithRank`) to `routeRegularEdgeFaithful`. This is the
highest-coverage category and fixes the wide fan-out / fan-in collapse.

The T1 inventory governs granularity: if many `adj-plain` goldens shift, split
T2 into per-cluster fix-tasks (T2a, T2b, …) and log the split in the journal.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Route adjacent-rank plain forward edges via the faithful path; fix golden deltas; pin fan-out/fan-in oracles | opus | `src/layout/dot/edge-route.ts`, `src/layout/dot/edge-route-faithful.ts`, `src/layout/dot/edge-route-splines.test.ts` (new) | T1 | [x] |

Gate per [../README.md](../README.md). One commit per task.
Commit: `feat(T2): route adjacent-rank forward edges through pathplan`.
