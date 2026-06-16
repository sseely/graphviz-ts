# Batch 2 — grouping-loop wiring + parity pins

Runs after T2 (the router must be correct before the grouping loop dispatches
multi-edge groups to it).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Port the dot_splines edge-grouping loop (getmainedge / BWDEDGE normalization / dispatch) faithfully, then pin opposing + labeled-parallel as dot-oracles | sonnet | `src/layout/dot/splines.ts`, `src/layout/dot/edge-route-multi.test.ts` (extend) | T2 | [ ] |

Gate per [../README.md](../README.md). Commit: `feat(T3): port dot_splines
edge-grouping loop + multi-edge oracle pins`.
