# Batch 1 — independent ports (parallel)

T1 and T2 touch disjoint files (`splines-flat.ts` vs `splines-route.ts` + their
own new tests) and have no interdependency, so they run in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Port `make_flat_labeled_edge` (G4) | sonnet | `src/layout/dot/splines-flat.ts`, `src/layout/dot/splines-flat-labeled.test.ts` (new) | — | [ ] |
| T2 | Port `make_regular_edge` multi-edge / label-vnode logic into the live faithful router (G1 core) | sonnet | `src/layout/dot/splines-route.ts`, `src/layout/dot/edge-route*.ts` (as the live dispatch requires), `src/layout/dot/edge-route-multi.test.ts` (new) | — | [ ] |

Gate after each task per [../README.md](../README.md) Quality Gates. One commit
per task. If T1 and T2 are run by parallel agents, confirm their write-sets do
not overlap before launch (T2 may touch `edge-route*.ts`; T1 must not).
