<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — Re-survey, gate, refresh parity baseline

## Context
The fix is in (T2). Confirm it resolves both 1213 variants without regressing any other
corpus case, then refresh the committed parity baseline so the dashboard reflects the
new state. The parity survey is the project's layout-fidelity fitness function;
`survey:gate` must show 0 regressions before the baseline is updated.

## Task (sequential — depends on T2)
1. Run the headless survey: `npm run survey` (writes `test/corpus/parity-rules.json`;
   uses `GVBINDIR=/tmp/ghl`, `GV_TEXT_MEASURER=estimate`). If a bare `tsx` is not on
   PATH, run the underlying command with `npx tsx` (see README note).
2. Run the gate: `npm run survey:gate`. Must exit 0 (no regressions vs baseline). If it
   lists regressions, **STOP** — the fix regressed a previously-matching case (stop
   condition); do not refresh the baseline.
3. Verify both 1213 variants improved: in the new `parity-rules.json`, `1213-1` and
   `1213-2` are no longer `diverged` (expect `conformant` or `structural-match`).
4. Refresh the committed baseline:
   `cp test/corpus/parity-rules.json test/corpus/parity.json` then
   `npm run survey:dashboard` (regenerates `test/corpus/PARITY.md`).

## Write-set
- `test/corpus/parity.json`
- `test/corpus/parity-rules.json` (tracked canonical baseline source — refresh it too)
- `test/corpus/PARITY.md`

## Read-set
- README quality-gate / baseline-refresh recipe
- `test/corpus/survey.ts`, `rules-gate.ts`, `dashboard.ts` (run, don't edit)

## Architecture decisions in scope
AD-5 (reversible — regenerated artifacts).

## Acceptance criteria
- **Given** the post-fix survey, **when** `npm run survey:gate` runs, **then** it exits 0
  (zero regressions).
- **Given** the new `parity.json`, **when** `1213-1` and `1213-2` are inspected, **then**
  neither is `diverged` (each is `conformant` or `structural-match`).
- **Given** the baseline refresh, **when** `git diff test/corpus/PARITY.md`, **then** the
  1213 ids have moved out of the diverged table and totals updated.

## Observability requirements
N/A.

## Rollback notes
Reversible — `parity.json`/`parity-rules.json`/`PARITY.md` are regenerated; revert the
commit.

## Quality bar
Return only: gate result (pass/regressions), the two 1213 verdicts before/after, and the
net diverged-count delta. No preamble.

## Boundaries
- **Always:** stop and report if `survey:gate` shows ANY regression — do not refresh the
  baseline to mask it.
- **Never:** hand-edit `parity.json`, `parity-rules.json`, or `PARITY.md` (all generated).

## Commit format
`chore(T3): refresh parity baseline after 1213 spline fix`
