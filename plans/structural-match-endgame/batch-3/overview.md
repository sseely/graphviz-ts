# Batch 3 — fixes from Batch-1 verdicts

Write-sets journal-authorized from each family's analysis doc. At most one
registry-writing task (T13 if ortho verdict=accept). Tasks whose diag verdict
is already-closed are skipped (checkbox with note). Executor verifies
write-set disjointness before parallel dispatch. Batch gate: survey+gate.

| ID | Description | Model | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T11 | b29/b124 fix-or-accept | fable | per analysis/hub-fanin.md | T1 | [ ] |
| T12 | 2413 fix | fable | per analysis/2413-vspace.md | T2 | [ ] |
| T13 | ortho fix-or-accept (REGISTRY writer) | opus+sonnet | per analysis/ortho-tiebreak.md (+registry trio if accept) | T3 | [ ] |
| T15 | 2613 fix | sonnet | per analysis/2613-canvas.md | T5 | [ ] |
| T16 | 1453 fix | sonnet | per analysis/1453-curved.md | T6 | [ ] |
| T17 | 2646 fix | sonnet | per analysis/2646-recordport.md | T7 | [ ] |
