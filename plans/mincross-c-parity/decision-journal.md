# Decision Journal — mincross-c-parity

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-17 | — | Profiled 2471 hang: transpose dominates. Found transpose reverse condition inverted (cross<0 vs C c1<c0||(c0>0&&reverse&&c1==c0)). C does 50-198-pass transposes too (normal). C renders in 2.78s; TS >50× slower. | node --prof + C instrumentation |
| 2026-06-17 | — | Found: transpose missing candidate flag + valid invalidation. reorder/main-loop/medians match C. | Systematic C-vs-TS read |
| 2026-06-17 | T1 | Implemented (working tree): transposeCounts (count-based), shouldSwap, candidate flag, alloc-free. Goldens 1864 green. | Faithful transpose_step port |
| 2026-06-17 | — | Baseline: tsc 0, vitest 1864 | Pre-mission green |
