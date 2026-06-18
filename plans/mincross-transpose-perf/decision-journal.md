# Decision Journal — mincross-transpose-perf

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-17 | — | Brief created. Suspect carried in: per-swap scope already matches C (local `transposeCounts`, incremental `ncross`) → "global recompute" pre-refuted; the 90s-in-one-`transpose()` profile makes pass-count/non-convergence prime over constant-factor. Success = 2471 completes + order byte-identical to C + mid-size speedup (AD-1/AD-4). Write-set widened to the 4 hot-path files (AD-2). Measure-then-route (AD-3). Baseline tsc 0, vitest 1873. | Phase 1 diagnosis |
