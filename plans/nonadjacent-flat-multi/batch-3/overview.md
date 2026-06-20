# Batch 3 — Wire the dispatch

Route the non-adjacent flat group through the new module from the real pipeline,
marking all group edges routed in one pass (mirrors the adjacent-flat dispatch).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | `routeFaithfulSidePort` collects the non-adjacent group + routes once via `routeFlatEdgeGroupFaithful` | direct (opus) | `src/layout/dot/edge-route.ts` | T2 | [ ] |

Gate: `tsc` clean; `render-one.ts` on synthetic cnt=2/3/bottom byte-matches native
end-to-end; cnt=1 synthetic unchanged; `vitest run` green; `lizard` clean; <500 lines.
