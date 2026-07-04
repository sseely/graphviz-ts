<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — Re-survey, gate, refresh parity baseline

## Context
The fix is in (T2). Confirm it resolves all three shells variants without
regressing any other corpus case, then refresh the committed parity baseline so
the dashboard reflects the new state. The parity survey is the project's layout
fidelity fitness function (a report, not a CI gate — but `survey:gate` must show
0 regressions before the baseline is updated).

## Task (sequential — depends on T2)
1. Run the headless survey: `npm run survey` (writes
   `test/corpus/parity-rules.json`; uses `GVBINDIR=/tmp/ghl`,
   `GV_TEXT_MEASURER=estimate`).
2. Run the gate: `npm run survey:gate`. Must exit 0 (no regressions vs baseline).
   If it lists regressions, **STOP** — the fix regressed a previously-matching
   case (stop condition); do not refresh the baseline.
3. Verify the three shells variants improved: in the new `parity-rules.json`,
   `graphs-shells`, `share-shells`, `windows-shells` are no longer `diverged`
   (expect `conformant` or `structural-match`).
4. Refresh the committed baseline:
   `cp test/corpus/parity-rules.json test/corpus/parity.json` then
   `npm run survey:dashboard` (regenerates `test/corpus/PARITY.md`).

## Write-set
- `test/corpus/parity.json`
- `test/corpus/PARITY.md`
- (`test/corpus/parity-rules.json` is a generated survey artifact; commit only if
  the repo already tracks it as the canonical baseline source — match existing
  convention.)

## Read-set
- README quality-gate / baseline-refresh recipe
- `test/corpus/survey.ts`, `rules-gate.ts`, `dashboard.ts` (run, don't edit)

## Architecture decisions in scope
AD-4 (reversible — regenerated artifacts).

## Acceptance criteria
- **Given** the post-fix survey, **when** `npm run survey:gate` runs, **then** it
  exits 0 (zero regressions).
- **Given** the new `parity.json`, **when** the three shells ids are inspected,
  **then** none is `diverged` (each is `conformant` or `structural-match`).
- **Given** the baseline refresh, **when** `git diff test/corpus/PARITY.md`,
  **then** the shells ids have moved out of the diverged table and totals updated.

## Observability requirements
N/A.

## Rollback notes
Reversible — `parity.json`/`PARITY.md` are regenerated; revert the commit.

## Quality bar
Return only: gate result (pass/regressions), the three shells verdicts before/
after, and the net diverged-count delta. No preamble.

## Boundaries
- **Always:** stop and report if `survey:gate` shows ANY regression — do not
  refresh the baseline to mask it.
- **Never:** hand-edit `parity.json` or `PARITY.md` (both are generated).

## Commit format
`chore(T3): refresh parity baseline after graphs-shells flat-order fix`
