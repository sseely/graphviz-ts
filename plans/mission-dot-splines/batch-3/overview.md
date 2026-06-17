# Batch 3 — Multi-rank forward chains → faithful

Migrate plain multi-rank forward edges (virtual chains) from `computeSplineMulti`
to `routeMultiRankEdgeFaithful`. The chain faithful path already exists for
labeled/side-port multi-rank edges; extend it to plain chains.

T1 inventory governs granularity (split into T3a/T3b per cluster if needed).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Route plain multi-rank forward edges via the faithful chain path; fix golden deltas; pin long-span oracles | opus | `src/layout/dot/edge-route.ts`, `src/layout/dot/edge-route-chain.ts`, `src/layout/dot/edge-route-splines.test.ts` | T2 | [x] |

Gate per [../README.md](../README.md). One commit.
Commit: `feat(T3): route multi-rank forward edges through pathplan`.
