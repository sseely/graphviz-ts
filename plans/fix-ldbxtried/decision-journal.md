<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. One row per non-trivial judgment call.

| Date | Batch/Task | Decision | Rationale |
|------|-----------|----------|-----------|
| 2026-06-30 | B0/T0 | divergentStage = cluster-mincross-order (ReMincross best-order selection), NOT x-coord NS / containment | Paired LDBG instrumentation: port==C order through after-merge2; diverge only in mincross(g,2). x-coords faithfully honor the port's (wrong) order, so it is a true reorder. |
| 2026-06-30 | B0/T0 | Root cause = `interclexp` edge-iteration order ≠ C `agfstedge`; fixTarget `cluster.ts::interclexp` | Per-rank rcross at ReMincross entry differs ONLY at r=3 (C19/port17). Sole diff = edge `n488->n2` xpenalty (C2/port1). Port iterates `g.edges` insertion order so parallel intercluster multi-edges are non-adjacent → prev-chain merge misses them → xpenalty not merged into the direct fast edge rcross reads. Inside the cluster surface → stop-condition 1 NOT triggered. |
| 2026-06-30 | B0/T0 | All C + port instrumentation reverted; both trees git-clean; oracle regenerated | Per T0 boundaries (no probes left). tsc=0. |
