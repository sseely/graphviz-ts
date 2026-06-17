# Batch 6 — Delete the simplified fitter

With every regular-edge category migrated (T2–T5), the simplified fitter is dead.
Remove it and its now-unused helpers, then run the full gate to confirm the
faithful path is the sole regular-edge router and all 115 goldens + new oracles
hold.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T6 | Delete `computeSpline`/`computeSplineMulti`/`buildRankCorridor`/`straightEdgeSplineWithRank` + dead helpers; remove fitter branches + the `splines-route.ts` stub | opus | `src/layout/dot/edge-route-poly.ts`, `src/layout/dot/edge-route-routing.ts`, `src/layout/dot/edge-route.ts`, `src/layout/dot/edge-route-chain.ts`, `src/layout/dot/splines-route.ts`, `src/layout/dot/edge-route-helpers.ts` | T5 | [ ] |

Gate per [../README.md](../README.md). One commit. Merge mission with a merge commit.
Commit: `refactor(T6): delete the simplified edge fitter`.
