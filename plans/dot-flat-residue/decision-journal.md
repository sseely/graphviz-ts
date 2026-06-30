# Decision Journal — dot-flat-residue

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-17 | — | Mission scoped from DOT-9 + DOT-10 (catalog stale: DOT-3/4 already done) | User selected flat residue over SFDP-1 |
| 2026-06-17 | — | Baseline: tsc exit 0, vitest 1852 passed | Pre-mission green |
| 2026-06-17 | T1 | Confirmed driver skips already-routed edges (edge-route.ts:336), so routing the whole group from its representative is safe — no double-install | Cleared the main DOT-9 regression risk before coding |
| 2026-06-17 | T1 | makeSimpleFlat ported; no-port dispatcher renamed makeAdjFlatNoPortEdge, routes no-label groups via makeSimpleFlat. tsc 0, vitest 1853, zero golden churn | AD-1 churn guard passed: single flats conformant, parallel flats now fan. Comparison: comparisons/dot-9-parallel-flat.md |
| 2026-06-17 | T2 | **STOP — mis-scope discovered.** Copy-back implemented faithfully (copyFlatLabel mirrors dotsplines.c:1273-1277); label now EMITTED (gap "drops label" closed). BUT label lands at TS (77.6,-54.2) vs C oracle (72,-32.91) — 21pt off. Diagnosis: no-label ported flat is conformant (`M54,-18C56.75...` == C), but the LABELED aux edge diverges: aux label vnode at aux-y=59.25 (needs ~37), spline bends wider (64.24 vs 62.13). Root cause is upstream — the aux pipeline's layout of a *labeled* cross-rank edge, not the copy-back. AD-3 assumed the aux label was correctly placed; it is set but not conformant. | Per autonomous-execution: stop when a task is mis-scoped / contradicts an AD. Cannot write an honest conformant oracle pin; will not pin a known-wrong value. T2 code left uncommitted pending decision. |
