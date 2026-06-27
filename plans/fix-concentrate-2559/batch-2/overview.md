# Batch 2 — Faithful fix + golden + unit test (TDD)

Single task, one commit. Depends on T1's pinned fix location and assertion shape.
TDD internally: write the failing golden/unit test (Red), port C's `spline_merge`
trunk routing (Green), typecheck + tests pass before committing.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Port C `spline_merge` trunk routing; add 2559 golden + unit test | typescript-pro (Sonnet) | `<fixFile from T1>` (+≤2 sibling routing files if T1 says so), `test/golden/inputs/concentrate-2559.dot`, `test/golden/refs/concentrate-2559.svg`, one `src/layout/dot/*.test.ts` | T1 | [ ] |

Write-set is finalized from T1's interface block. If T1's `fixFile` is outside
`edge-route-chain.ts`/`splines-route.ts`/`edge-route-faithful.ts`, this batch is
blocked (stop condition).
