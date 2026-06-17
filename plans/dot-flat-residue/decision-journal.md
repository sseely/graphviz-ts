# Decision Journal — dot-flat-residue

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-17 | — | Mission scoped from DOT-9 + DOT-10 (catalog stale: DOT-3/4 already done) | User selected flat residue over SFDP-1 |
| 2026-06-17 | — | Baseline: tsc exit 0, vitest 1852 passed | Pre-mission green |
| 2026-06-17 | T1 | Confirmed driver skips already-routed edges (edge-route.ts:336), so routing the whole group from its representative is safe — no double-install | Cleared the main DOT-9 regression risk before coding |
| 2026-06-17 | T1 | makeSimpleFlat ported; no-port dispatcher renamed makeAdjFlatNoPortEdge, routes no-label groups via makeSimpleFlat. tsc 0, vitest 1853, zero golden churn | AD-1 churn guard passed: single flats byte-identical, parallel flats now fan. Comparison: comparisons/dot-9-parallel-flat.md |
