# Batch 2 — fix the flat-edge routing branch

After Batch 1. T2 depends on T1's diagnosis (the divergent function + C ground
truth). Single fix task.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Faithfully port the divergent flat-routing branch (from T1); add a colocated regression test. Extract flat-box helpers to a NEW `splines-flat-boxes.ts` if the file would exceed 500 lines (AD-5) | opus | `src/layout/dot/splines-flat.ts` (+ optional new `splines-flat-boxes.ts`) + a colocated `*.test.ts` | T1 | [ ] |

## File-size note (AD-5)
`splines-flat.ts` is at 481/500. Before adding logic, decide whether to extract
the flat-box helpers (`topBoxes`/`bottomBoxes`/`makeFlatEndBox`) to a new
`src/layout/dot/splines-flat-boxes.ts`. Declare the final write-set in the
commit. One writer per file.

## Stop conditions
Per README. AD-4 applies: if the fix needs files outside the T1 write-set or a
deeper routing change -> STOP.

## Quality gates
All gates from [../README.md](../README.md). Snapshot `parity.json` before T2's
survey run; require 0 regressions + `241_0` improves verdict
(diverged -> structural/byte-match).
