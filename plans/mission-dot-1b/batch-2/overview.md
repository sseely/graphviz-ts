# Batch 2 — Faithful parallel/opposing group routing

Single task. The high-risk port: migrate the multi-edge group router to faithful
primitives, mirroring C's `make_regular_edge` cnt>1 path (AD-2). Consumes T2's
recipe and T1's `makeFwdEdge`. After this, the fitter is unreferenced and Batch 3
can delete it.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Faithful parallel/opposing group routing (mirror C shared-base) | opus | `src/layout/dot/splines-route.ts`, `src/layout/dot/edge-route-splines.test.ts`, `src/layout/dot/multi-edge.test.ts` | T1, T2 | [ ] |

T2's pre-mission spike proved the recipe byte-exact; T3 implements it + resolves
two small residuals (back-member point-order normalization, AC4 stale spacing).

Gate per [../README.md](../README.md). One commit.
Commit: `feat(T3): route parallel/opposing edges through pathplan`.
