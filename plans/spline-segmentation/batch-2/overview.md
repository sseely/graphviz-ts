# Batch 2 — issue-numbered routing case (MR-driven)

After Batch 1. Sequential: T4's fix depends on T3's diagnosis. Scope: ONE
issue-numbered `path-structure` case (extend to a second only if T3–T4 go
smoothly; log the decision).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Pick the most isolated issue-numbered path-structure case; recover its GitLab issue + closing MR; instrument C; identify the divergence | opus | `plans/spline-segmentation/decision-journal.md` (findings; read-only to `src/`) | Batch 1 | [ ] |
| T4 | Faithfully port the fix so the case improves verdict; add a test | opus | `src/<file from T3>` + a colocated `*.test.ts` | T3 | [ ] |

## Case selection (T3)
From `parity.json` `diverged` `path-structure` ids that are numeric (`NNNN`),
prefer the smallest `maxDelta` and an input whose `git log --all --grep '<num>'`
yields a clear issue + MR. Candidates to scan: the root `tests/*.dot` numbered
inputs (e.g. `1213-*`, `2471`, `1447`).

## Interface (T3 → T4)
T3 appends to the decision journal:
`{ issueNum, issueIntent (1 line from the MR), divergentFn, cRef, rootCause }`.

## Stop conditions
Per README. If the chosen case turns out to be a deep multi-cause routing
divergence (not a single isolated branch) → STOP, report, and pick a different
case or end the mission.

## Quality gates
All gates from [../README.md](../README.md). Snapshot parity.json before T4's
survey run.
