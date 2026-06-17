# Batch 4 — Back edges + non-forward → faithful

Migrate multi-rank back edges (`routeBackEdge`) and non-forward edges
(`routeEdgeNonForward`, dir=back/both/none) off the simplified fitter onto the
faithful chain path (with spline reversal as needed, per the dot-edge-multi
back-edge handling).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | Route back + non-forward regular edges via the faithful path; fix golden deltas; pin a back-edge oracle | opus | `src/layout/dot/edge-route.ts`, `src/layout/dot/edge-route-chain.ts`, `src/layout/dot/edge-route-splines.test.ts` | T3 | [x] |

Gate per [../README.md](../README.md). One commit.
Commit: `feat(T4): route back + non-forward edges through pathplan`.
