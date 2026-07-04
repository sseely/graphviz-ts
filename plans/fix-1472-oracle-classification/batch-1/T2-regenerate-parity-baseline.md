# T2 — regenerate the parity baseline and verify reclassification

## Context

After T1, the survey classifies a non-well-formed oracle as `oracle-error`. The
committed parity baseline (`test/corpus/parity.json`) must be regenerated so
1472 shows the new verdict, following the project's frozen recipe: survey with
the headless GVBINDIR + Estimate text measurer, gate at 0, then copy
`parity-rules.json → parity.json` and refresh the dashboard.

Recipe reference (memory: "parity.json recipe = Estimate + headless"):
`npm run survey` writes `parity-rules.json` (uses `GVBINDIR=/tmp/ghl`,
estimate measurer). `npm run survey:gate` must exit 0. Then
`cp parity-rules.json parity.json` and regenerate dashboard artifacts.

Depends on: **T1** (reclassification must be live).

## Task

1. Ensure the headless oracle dir exists: `npm run survey:setup` (idempotent;
   builds `/tmp/ghl`).
2. Run `npm run survey` (regenerates `test/corpus/parity-rules.json`).
3. Run `npm run survey:gate` — must exit 0.
4. Verify with the delta discipline (memory: judge by per-id verdict deltas):
   - `1472` verdict is now `oracle-error` (was `diverged`).
   - Counts shift exactly: `diverged` 33→32, `oracle-error` 11→12.
   - **No other id changed bucket.** Diff old vs new results by id; if any id
     other than 1472 moved, STOP (the helper may be gating on something it
     should not — see stop conditions in README).
5. Promote the baseline: `cp test/corpus/parity-rules.json test/corpus/parity.json`
   and regenerate the committed dashboard (`npm run survey:dashboard` or the
   dashboard step used by the committed `PARITY.md`, matching how the current
   `parity.json` was produced).

## Write-set

- `test/corpus/parity.json`
- `test/corpus/parity-rules.json`
- committed parity dashboard artifacts (e.g. `test/corpus/PARITY.md` /
  docs mirror) — only those the dashboard step regenerates

## Read-set

- `test/corpus/survey.ts` scripts (package.json `survey`, `survey:gate`,
  `survey:dashboard`)
- Current `test/corpus/parity.json` (1472 entry, `counts`)

## Acceptance criteria

- Given the regenerated baseline, when reading `parity.json`, then the `1472`
  entry has `verdict: "oracle-error"` and no `firstDiffPath: "<compare-threw>"`.
- Given old vs new results, when diffed by id, then only `1472` changed verdict.
- Given `npm run survey:gate`, when run on the new baseline, then it exits 0.

## Observability

N/A — generated test artifacts.

## Rollback

Reversible — `git checkout` the JSON/docs artifacts and re-run the survey.

## Quality bar

`survey:gate` exit 0; per-id delta shows exactly one changed id (1472).
Return only the structured result — no preamble or trailing summary.

## Commit

`chore(T2): refresh parity baseline — 1472 diverged→oracle-error`
