<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Survey, gate, refresh baseline, reconcile accepted-divergences

## Context
The fix is in (T1). Text measurement changes affect ≤23 non-ASCII corpus graphs.
Confirm `graphs-japanese` is resolved and no other case regresses, then refresh
the committed parity baseline and reconcile any accepted-divergences status
change. The survey is the project's layout-fidelity fitness function.

## Task (sequential — depends on T1)
1. Survey: `GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json
   npx tsx test/corpus/survey.ts` (writes `test/corpus/parity-rules.json`).
2. Gate: `npx tsx test/corpus/rules-gate.ts`. Must exit 0 (no regressions vs
   baseline). If it lists regressions — **STOP**, report them (esp. `1724`,
   `2343`, `2502`, `graphs-b993`); do not refresh the baseline.
3. Verify `graphs-japanese` is no longer `diverged` (expect `conformant`) in the
   new `parity-rules.json`. Note the net diverged-count delta and which of the
   23 non-ASCII graphs changed verdict.
4. Refresh baseline: `cp test/corpus/parity-rules.json test/corpus/parity.json`
   then `npx tsx test/corpus/dashboard.ts` (regenerates `PARITY.md`).
5. Reconcile accepted-divergences (AD-5): for each non-ASCII graph that is now
   **conformant** and has an entry in `accepted-divergences.json`, remove the
   entry, its row in `rules-known-divergences.md`, and its id from the hardcoded
   rules-allowlist in `accepted-divergences.test.ts`. Then
   `npx vitest run test/corpus/accepted-divergences.test.ts` (must pass).

## Write-set
- `test/corpus/parity.json`, `test/corpus/parity-rules.json`,
  `test/corpus/PARITY.md` (generated — never hand-edit)
- `test/corpus/accepted-divergences.json`,
  `test/corpus/rules-known-divergences.md`,
  `test/corpus/accepted-divergences.test.ts` (only if entries removed)

## Read-set
- `README.md` quality-gate / baseline-refresh recipe
- `test/corpus/{survey.ts,rules-gate.ts,dashboard.ts}` (run, don't edit)
- `test/corpus/accepted-divergences.test.ts` (the guard — hardcodes the
  rules-allowlist; edit the list if removing ids)

## Architecture decisions in scope
AD-4 (0 regressions bar), AD-5 (reconcile), AD-6 (reversible).

## Acceptance criteria
- **Given** the post-fix survey, **when** `rules-gate.ts` runs, **then** it exits
  0 (zero regressions).
- **Given** the new `parity.json`, **then** `graphs-japanese` is `conformant`.
- **Given** the reconciliation, **when** `npx vitest run
  test/corpus/accepted-divergences.test.ts`, **then** it passes (no stale entry,
  no dangling hardcoded id).
- **Given** `git diff test/corpus/PARITY.md`, **then** `graphs-japanese` left the
  diverged table and totals updated.

## Observability requirements
N/A.

## Rollback notes
Reversible — regenerated/hand-reconciled artifacts; revert the commit.

## Quality bar
Return only: gate result (pass/regressions), `graphs-japanese` verdict
before/after, the net diverged delta + which non-ASCII graphs changed, and the
accepted-divergences change. No preamble.

## Boundaries
- **Always:** STOP and report if `survey:gate` shows ANY regression — never
  refresh the baseline to mask it.
- **Never:** hand-edit generated `parity*.json`/`PARITY.md`; never remove an
  accepted entry whose id is still non-conformant.

## Commit format
`chore(T2): refresh parity baseline after non-ASCII textmeasure fix`
