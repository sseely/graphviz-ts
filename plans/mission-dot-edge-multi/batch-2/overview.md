# Batch 2 — grouping-loop wiring + parity pins

Runs after T2 (the router must be correct before the grouping loop dispatches
multi-edge groups to it).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Edge-grouping dedup-by-orig so opposing forms cnt=2; pin opposing + labeled-parallel edge "1"; quarantine labeled edge "2" + label positions | opus (direct) | `src/layout/dot/splines.ts`, `src/layout/dot/edge-route-multi.test.ts` (extend) | T2 | [x] |

> **T3 scope note (2026-06-16):** Implemented as a targeted dedup-by-orig, not a
> full port of the C break-conditions (portcmp / MAINGRAPH / FLATEDGE-label).
> The existing group-by-main-edge grouping is conformant on the 115 goldens;
> adding break-conditions risks splitting golden groups (AD-2). None of the G1
> corpus needs them. See the decision journal.

Gate per [../README.md](../README.md). Commit: `feat(T3): port dot_splines
edge-grouping loop + multi-edge oracle pins`.
