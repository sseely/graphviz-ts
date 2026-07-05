# Batch 3 — fixes from Batch-1 verdicts

Write-sets journal-authorized from each family's analysis doc. At most one
registry-writing task (T13 if ortho verdict=accept). Tasks whose diag verdict
is already-closed are skipped (checkbox with note). Executor verifies
write-set disjointness before parallel dispatch. Batch gate: survey+gate.

| ID | Description | Model | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T11 | b29/b124 fix | sonnet | splines.ts | T1 | [x] f7022ca |
| T12 | A3 registry (2413_1/2/decorate) | sonnet | registry trio | T2,T8 | [x] d8d8c6b |
| T13 | ortho trunc+ports fix | sonnet | ortho/* + adapter | T3 | [x] ea8e551 |
| T15 | 2613 fix | sonnet | per analysis/2613-canvas.md | T5 | [x] |
| T16 | 1453 dedupByOrig | sonnet | splines-groups.ts | T6 | [x] b7338ea |
| T17 | corridor-bounds freeze | sonnet | 5 files + splines.ts | T7 | [x] 9f875d9 — 2646 NOT closed (causal link refuted; still open) |
