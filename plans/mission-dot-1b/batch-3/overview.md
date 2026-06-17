# Batch 3 — Delete the simplified fitter

Single task. Pure dead-code removal once T1+T3 made every regular-edge path
faithful. Grep-gated (AD-3): delete only symbols verified unreferenced in the
live path.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | Delete fitter + `FaithfulForceMode` scaffolding + harness; backlog DONE | opus | `src/layout/dot/edge-route-poly.ts`, `src/layout/dot/edge-route-routing.ts`, `src/layout/dot/edge-route-helpers.ts`, `src/layout/dot/edge-route.ts`, `src/layout/dot/edge-route-chain.ts`, `src/layout/dot/splines-route.ts`, `.probes/dot-splines-faithful-measure.ts` (delete), `plans/layout-engine-backlog/gaps/dot.md` | T1, T3 | [ ] |

Gate per [../README.md](../README.md). One commit.
Commit: `refactor(T4): delete the simplified edge fitter`.
After the full gate passes, merge `feature/dot-1b` → `main` with a **merge commit**.
