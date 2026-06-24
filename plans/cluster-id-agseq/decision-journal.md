<!-- SPDX-License-Identifier: EPL-2.0 -->

# Decision journal

Appended during execution. One row per non-trivial judgment call.

| date | task | decision | rationale |
|------|------|----------|-----------|
| 2026-06-22 | T1 | Reopened named subgraph reuses prior `seq`; merge/overwrite semantics left untouched | Parser overwrites a repeated `subgraph X{}` (verified: cluster_0 keeps only the 2nd body). C reopens and allocates no new AGSEQ. Reusing the prior seq makes ids faithful without changing geometry/merge (out of scope; mission states geometry already matches). Acceptance criterion "no double-increment" satisfied. |
| 2026-06-22 | T1 | Handled T1 inline (no subagent) | Single tightly-coupled task across 4 files in the seq model, <30 min; delegation overhead unjustified per parallelism.md. |
| 2026-06-22 | T2 | Included `src/gvc/device.ts` in the T2 commit (comment-only) | T2 task doc step 4 explicitly mandates updating the stale `device.ts:343` comment, but batch-2 overview's Writes column omitted it. Task spec is authoritative; change is a comment fix, no behavior. Not a stop condition. |
| 2026-06-22 | T2 | T2 verified inline; nestedclust → clust2/6/7 confirmed at render level | New svg-cluster-id.test.ts asserts oracle ids via renderSvg; full suite 2301→2304, 0 regressions. |
| 2026-06-22 | T3 | Survey PASS: 7/7 targets flipped, 0 regressions | All 7 confirmed targets left `diverged` (6→byte-match, 1514→structural-match). Per-id verdict diff vs HEAD baseline: 0 good→bad, 10 bad→good. Counts byte 272→278 (+6), structural 232→236 (+4), diverged 264→254 (−10). Re-bucketed multi-axis cases 121/258/2242 diverged→structural-match (next-diff progress, not a flip). |
| 2026-06-22 | T4 | NOT executed — contingency not triggered | ADR-4: T4 ships only if a target failed to flip or a guard regressed due to endpoint-subgraph seq drift. T3 showed 7/7 flips, 0 regressions, so no real corpus case exercises the `{…}->{…}` endpoint-subgraph branch ahead of a cluster. C-is-sacred satisfied: port the branch when a case demands it, not speculatively. |
