<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. One row per non-trivial judgment call.

| Date | Batch/Task | Decision | Rationale |
|------|-----------|----------|-----------|
| 2026-06-30 | B0/T0 | divergentStage = cluster-mincross-order (ReMincross best-order selection), NOT x-coord NS / containment | Paired LDBG instrumentation: port==C order through after-merge2; diverge only in mincross(g,2). x-coords faithfully honor the port's (wrong) order, so it is a true reorder. |
| 2026-06-30 | B0/T0 | Root cause = `interclexp` edge-iteration order ≠ C `agfstedge`; fixTarget `cluster.ts::interclexp` | Per-rank rcross at ReMincross entry differs ONLY at r=3 (C19/port17). Sole diff = edge `n488->n2` xpenalty (C2/port1). Port iterates `g.edges` insertion order so parallel intercluster multi-edges are non-adjacent → prev-chain merge misses them → xpenalty not merged into the direct fast edge rcross reads. Inside the cluster surface → stop-condition 1 NOT triggered. |
| 2026-06-30 | B0/T0 | All C + port instrumentation reverted; both trees git-clean; oracle regenerated | Per T0 boundaries (no probes left). tsc=0. |
| 2026-06-30 | B1/T1 | Fix = `interclexp` iterates `[...n.outEdges(g), ...n.inEdges(g)]` (C agfstedge order) instead of `g.edges` insertion order | Minimal, C-faithful (matches `agfstedge` = agfstout∘agfstin). All 13 node X now ±0 vs oracle; rank y=-38 order = C `n505,n487,n486,n526,n513,n518,n479`; `compareSvg` pass=true. |
| 2026-06-30 | B1/T1 | Un-skipped the `parallel-cluster-ldbxtried` whole-SVG golden (removed `knownResidual`) — a 3rd file beyond the {cluster.ts + *.test.ts} write-set | The skip rationale was exactly this now-fixed X cascade; the graph is now conformant (golden passes in-suite). Un-skipping converts it to an active gate and the stale knownResidual would otherwise mislead. Manifest entry count unchanged (165). Suite 169/169, full 2512/2512. Logged per autonomous out-of-write-set rule. |
| 2026-06-30 | B2/T2 | Survey gate PASS — 0 regressions, 0 new timeout/errored; baseline refreshed | conformant 533→536, diverged 51→48; structural-match 194 + oracle-error 11 unchanged. The ONLY verdict moves: graphs/share/windows-ldbxtried diverged→conformant (Δ323/323/322→0). Refreshed parity.json + parity-rules.json + PARITY.md. |
