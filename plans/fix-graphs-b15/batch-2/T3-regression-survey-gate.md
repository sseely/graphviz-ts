<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — Survey, gate vs HEAD, refresh baseline, reconcile

## Context
The fix is in (T2). Concentrate changes can affect any concentrate graph. Confirm
`graphs-b15` is conformant and nothing regresses, gating against the **committed
HEAD** baseline (the on-disk `parity.json` can be pre-contaminated — observed in
the non-ASCII-textmeasure mission, where 11 entries on disk differed from HEAD and
would have masked regressions). Then refresh the committed baseline.

## Task (sequential — depends on T2)
1. Survey: `GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json
   npx tsx test/corpus/survey.ts` (writes `test/corpus/parity-rules.json`).
   (Note: `survey.ts` logs "wrote parity.json" verbatim regardless of
   `PARITY_OUT` — ignore the text; it writes `parity-rules.json`.)
2. Capture the true baseline: `git show HEAD:test/corpus/parity.json >
   /tmp/b15_base.json`. If on-disk `parity.json` is dirty, also
   `git checkout HEAD -- test/corpus/parity.json`.
3. Gate vs HEAD: `npx tsx test/corpus/rules-gate.ts test/corpus/parity-rules.json
   test/corpus/parity.json`. Must exit 0. If it lists regressions — **STOP**,
   report them; do not refresh the baseline.
4. Verify `graphs-b15` is `conformant` in `parity-rules.json` (expect
   diverged→conformant). Note the net diverged delta + any other concentrate
   graph that changed verdict.
5. Refresh baseline: `cp test/corpus/parity-rules.json test/corpus/parity.json`
   then `npx tsx test/corpus/dashboard.ts` (regenerates `PARITY.md`).
6. Reconcile (AD-4): if any concentrate graph that is now conformant has an entry
   in `accepted-divergences.json`, remove it, its `rules-known-divergences.md`
   row, and its id from the hardcoded list in `accepted-divergences.test.ts`;
   then `npx vitest run test/corpus/accepted-divergences.test.ts` (must pass). If
   no entries change, leave those 3 files untouched.

## Write-set
- `test/corpus/parity.json`, `test/corpus/parity-rules.json`,
  `test/corpus/PARITY.md` (generated — never hand-edit)
- `test/corpus/accepted-divergences.json`,
  `test/corpus/rules-known-divergences.md`,
  `test/corpus/accepted-divergences.test.ts` (only if entries removed)

## Read-set
- `README.md` quality-gate / baseline recipe; `decisions.md#ad-4`
- `test/corpus/{survey.ts,rules-gate.ts,dashboard.ts}` (run, don't edit)
- `test/corpus/accepted-divergences.test.ts` (hardcodes the rules-allowlist)

## Architecture decisions in scope
AD-4 (0 regressions vs HEAD), AD-5 (reversible).

## Acceptance criteria
- **Given** the post-fix survey, **when** `rules-gate.ts` runs against the HEAD
  baseline, **then** it exits 0 (zero regressions).
- **Given** the new `parity.json`, **then** `graphs-b15` is `conformant`.
- **Given** reconciliation, **when** `npx vitest run
  test/corpus/accepted-divergences.test.ts`, **then** it passes.
- **Given** `git diff test/corpus/PARITY.md`, **then** `graphs-b15` left the
  diverged table and totals updated.

## Observability requirements
N/A.

## Rollback notes
Reversible — regenerated/hand-reconciled artifacts; revert the commit.

## Quality bar
Return only: gate result (pass/regressions), `graphs-b15` verdict before/after,
net diverged delta + any other concentrate graph that changed, and the
accepted-divergences change (if any). No preamble.

## Boundaries
- **Always:** gate against the COMMITTED HEAD baseline; STOP and report on ANY
  regression — never refresh the baseline to mask it.
- **Never:** hand-edit generated `parity*.json`/`PARITY.md`; never remove an
  accepted entry whose id is still non-conformant.

## Commit format
`chore(T3): refresh parity baseline after graphs-b15 concentrate fix`
