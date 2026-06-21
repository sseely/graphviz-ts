# Decision Journal

Appended during execution. Every non-trivial judgment call gets a row.

| Date | Batch/Task | Decision | Rationale |
|------|------------|----------|-----------|
| 2026-06-21 | planning | plans/ NOT gitignored | project tracks mission briefs as committed artifacts (existing convention); skip the global skill's gitignore step |
| 2026-06-21 | planning | baseline green: typecheck + build exit 0, 2090 tests pass (156 files) | pre-flight before execution |
| 2026-06-21 | planning | branch feature/expose-library-api created; brief committed (d689e5b) | mission start |
| 2026-06-21 | Batch 1 | execution plan: T1/T2/T3 are independent (disjoint write-sets: gvc/default-context, api/edge-ops, api/geometry) → 3 parallel typescript-pro agents | parallelism rule: independent files, no shared writes |
| 2026-06-21 | Batch 1 / T2 | finding: parser processEdgePair (builder.ts:233) does NOT dedup strict edges; T2 strict-dedup follows cgraph agedge semantics, not a parser port | verified against live tree; recorded in .agent-notes for the T2 agent |
| 2026-06-21 | pre-existing | scratch/debug files (debug-*.ts, *-probe.ts, edge-route-fwd.ts, *.scratch.test.ts, *.mjs) carry stale TS errors but are excluded from `tsc --noEmit` (gate passes); not in any write-set | logged per pr-workflow; out of scope |
| 2026-06-21 | Batch 1 / T1 | createDefaultContext: 8 engines + 11 renderers; 21 tests; commit 74b6b14 | done |
| 2026-06-21 | Batch 1 / T2 | addEdge: strict-dedup follows cgraph agedge wildcard probe (id=0,objtype=0; symmetric for undirected); name irrelevant to dedup gate; 12 tests; commit 40617c4 | done |
| 2026-06-21 | Batch 1 / T3 | getLayout snapshot: width/height inches→points (×72); bezier points use bz.size not list.length; 13 tests; commit 2683f48. Agent left files uncommitted (blocked on lizard complexity hook); orchestrator finished residue inline after verifying tsc+test green | done; known subagent hook-loop pattern |
| 2026-06-21 | Batch 1 gate | PASS: git diff shows only the 6 write-set files; 2136 tests pass (159 files, +46); build exit 0; typecheck exit 0 | gate between batches |
