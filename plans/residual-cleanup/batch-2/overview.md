# Batch 2 — outcomes (write-sets journal-authorized from batch-1 docs)

| ID | Description | Model | Depends | Done |
|---|---|---|---|---|
| R6 | 2371 outcome (registry writer if accept) | sonnet | R1 | [x] |
| R7 | 1949 fixes (both sub-mechanisms) | sonnet | R2 | [x] done (e1ae0d5+8df1ddc) |
| R8 | 1453 fix | sonnet | R3 | [x] done (23d4114) |
| R9 | ortho family fix (1447_1+2620) | per R4 | R4 | [x] done (3 commits) |
| R10 | 2646 outcome | per R5 | R5 | [x] (collapsed into R6 — same registry-writer file ownership) |

Protocol identical to endgame batch-3 outcome tasks: fix at origin within
proposedWriteSet + regression test, or registry trio (R6 only), or journal
already-closed. Local validation; ONE survey gate for the batch.

R6 and R10 were both registry-only ACCEPT outcomes writing the same three
files (accepted-divergences.json, known-divergences.md,
known-divergences-examples.test.ts); per the one-writer-per-file rule they
were dispatched as a single agent (R6) covering both 2371 and 2646. See
decision-journal.md for the A6→A8 class-letter renumbering finding.
