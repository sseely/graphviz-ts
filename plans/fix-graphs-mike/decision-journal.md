<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution. One row per non-trivial judgment call.

| Date | Batch/Task | Decision | Rationale |
|------|-----------|----------|-----------|
| 2026-06-29 | B0/T0 | Root cause = node L misranked one rank up (cy -522 vs C -450); the over-segmented L→U spline is the symptom. Brief premise "pure edge geometry" is wrong. | Paired node-position compare: only L (and minor J x-9px) differ; viewBox matches. maxΔ 72.12 == one 72px rank-step. |
| 2026-06-29 | B0/T0 | Pinned to `ns.ts:tbSortNodes` (network-simplex TB_balance). C `LIST_SORT`==libc `qsort` (UNSTABLE) vs port stable `Array.prototype.sort`; equal-rank (r3) processing order flips → L sees nrank[3..4]=[6,5] in C (→r4) but [5,5] in port (→r3). Pre-sort order byte-identical both sides. | MIKEDBG paired instrumentation of C ns.c TB_balance + port tbBalance; both reverted clean. |
| 2026-06-29 | B0/T0 | STOP per README stop-condition #1: root cause is OUTSIDE edge-spline routing (rank-assignment phase). Write-set must expand from edge-route surface to `ns.ts`. Asking user for authorization (per user instruction) + approach (port BSD qsort vs quarantine). | fixTarget `ns.ts::tbSortNodes` ≠ brief's named edge-spline surface; reproducing platform qsort is a shared, architecturally significant change. |
| 2026-06-29 | B1 | User AUTHORIZED scope expansion into `ns.ts` and chose **Port BSD/macOS qsort**. Plan: verify a Bentley-McIlroy qsort TS port reproduces C's exact permutation first, then wire into tbSortNodes, gate on full survey, fall back to quarantine if net-negative. | User: "I suspect we will need to expand the write-set… ask for authorization." Survey is the safety net. |
| 2026-06-29 | B1 | Verified Bentley-McIlroy qsort (insertion-sort threshold 7, median-of-9 >40) reproduces the C oracle's 33-node mike permutation byte-for-byte (thresholds 4/6/8 fail) BEFORE editing `ns.ts`. New `bsd-qsort.ts::gvQsort`; `tbSortNodes` now uses it. | De-risks the shared-sort change; threshold confirmed empirically against the oracle, not assumed. |
| 2026-06-29 | B1 | Result: graphs/mike maxΔ 72.12→**0.0000** (all 39 edges byte-conformant; L cy −522→−450; L→U 14→8 pts; K→L resolved; J x-delta resolved). tsc clean; full vitest 2509 pass / 1 skip, 0 regressions. Commit then T2 survey. | T1 acceptance met. share/windows-mike are pos-annotated *different* graphs — verdict deferred to T2 survey (authoritative). |
