# Decision Journal — mincross-c-parity

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-17 | — | Profiled 2471 hang: transpose dominates. Found transpose reverse condition inverted (cross<0 vs C c1<c0||(c0>0&&reverse&&c1==c0)). C does 50-198-pass transposes too (normal). C renders in 2.78s; TS >50× slower. | node --prof + C instrumentation |
| 2026-06-17 | — | Found: transpose missing candidate flag + valid invalidation. reorder/main-loop/medians match C. | Systematic C-vs-TS read |
| 2026-06-17 | T1 | Implemented (working tree): transposeCounts (count-based), shouldSwap, candidate flag, alloc-free. Goldens 1864 green. | Faithful transpose_step port |
| 2026-06-17 | — | Baseline: tsc 0, vitest 1864 | Pre-mission green |
| 2026-06-17 | T2 | Committed: valid invalidation on swap (Root ranks r, r±1). Goldens conformant (1864). | mincross.c:657-665 |
| 2026-06-17 | T3 | Committed: unit test for shouldSwap (fwd/reverse tie matrix) + transposeCounts c0/c1 direction. +3 tests → 1867. lizard/tsc clean. | Pins the reverse-bug fix |
| 2026-06-17 | — | **Batch 1 complete.** All 3 transpose divergences landed + tested, goldens conformant. Next: Batch 2 trajectory-diff harness. | — |
| 2026-06-17 | B2-T1 | Committed faithful port of mincross.c:723 Verbose print as setMincrossTrace hook (default null). Enables C<->TS trajectory diff. Goldens conformant (1867). | — |
| 2026-06-17 | B2-T2 | **Trajectory diff: ROOT CAUSE FOUND — it's NOT mincross.** 2471 root mincross entry: C=23 ranks/3213 vnodes/cur=2629070 vs TS=31 ranks/2197 vnodes/cur=100010. Structural (build/rank), not transpose. ncross+transpose confirmed correct: repro2 (HTML+cluster+RL) trajectory conformant C↔TS through 2 invocations. | C+TS STATS probe at mincross entry (both reverted after) |
| 2026-06-17 | B2-T2 | **Ablation (per user) isolates CLUSTERS as sole trigger.** Single-feature root-STATS C-vs-TS: plain TB/RL, HTML-only, self/multi-edge all MATCH; clusters (±HTML ±RL) all DIVERGE identically (C 24r/54n vs TS 6r/24n). HTML hypothesis refuted. Decisive: strip cluster wrappers (same edges) → TS 24r/54n = C exactly; re-add wrappers → TS collapses to 6r. TS cluster handling DESTROYS a correct ranking — ranks each cluster locally, never offsets/stacks into global rank space. Upstream of mincross (dot_rank/cluster.c). This is the 2471 blocker + hang cause. | abl_compare.sh in /tmp |
| 2026-06-17 | — | **Mission pivot:** Batch 1 transpose fixes valid + kept. But Batches 3-4 premise (mincross is 2471 bottleneck) is wrong — the bottleneck is cluster RANKING. Recommend new mission `cluster-rank-c-parity` targeting dot_rank cluster collapse/expand/offset. | — |
