<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — survey, gate vs HEAD, refresh baseline, reconcile

## Context
The fix is in (T2). The collect change touches the core routing dispatch, so it
can affect ANY graph (esp. concentrate ones). Confirm `graphs-b15` is conformant
AND that **no id's maxDelta rises** (the doubled-bezier trap the prior attempt
hit), gating against the **committed HEAD** baseline (`git show
HEAD:test/corpus/parity.json`) — the on-disk `parity.json` can be
pre-contaminated. Then refresh the committed baseline.

## Task (sequential — depends on T2)
1. Setup: `npm run survey:setup` (builds `/tmp/ghl`). Snapshot HEAD baseline:
   `git show HEAD:test/corpus/parity.json > /tmp/b15_base.json` (and
   `git checkout HEAD -- test/corpus/parity.json` if the on-disk copy is dirty).
2. Survey via the cached tsx (see AD-1 note): `TSX=$(ls
   ~/.npm/_npx/*/node_modules/.bin/tsx | head -1); TSX_BIN="$TSX"
   GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json "$TSX" test/corpus/survey.ts`
   (writes `test/corpus/parity-rules.json`).
3. Gate vs HEAD: `"$TSX" test/corpus/rules-gate.ts test/corpus/parity-rules.json
   test/corpus/parity.json`. Must exit 0. Any regression (incl. a maxDelta rise)
   → **STOP**, report; do not refresh.
4. Delta discipline: diff HEAD vs new by id. `graphs-b15` must be `conformant`
   (was diverged). Confirm **no id regressed** and note any incidental
   concentrate improvements. Explicitly check no id's maxDelta increased.
5. Promote: `cp test/corpus/parity-rules.json test/corpus/parity.json`; then
   `"$TSX" test/corpus/dashboard.ts` (regenerates `PARITY.md`).
6. Reconcile (AD-4): if a now-conformant concentrate graph has an
   `accepted-divergences.json` entry, remove it + its `rules-known-divergences.md`
   row + its id in `accepted-divergences.test.ts`, then `"$TSX" -e vitest`
   (`npx vitest run test/corpus/accepted-divergences.test.ts`) must pass. If no
   entries change, leave those 3 files untouched.

## Write-set
- `test/corpus/parity.json`, `test/corpus/parity-rules.json`,
  `test/corpus/PARITY.md` (generated — never hand-edit)
- `test/corpus/accepted-divergences.json`,
  `test/corpus/rules-known-divergences.md`,
  `test/corpus/accepted-divergences.test.ts` (only if entries removed)

## Read-set
- README quality gates; `decisions.md#ad-4`
- `test/corpus/{survey.ts,rules-gate.ts,dashboard.ts}` (run, don't edit)

## Acceptance criteria
- Given the post-fix survey, when `rules-gate.ts` runs vs the HEAD baseline, then
  it exits 0 (zero regressions, zero maxDelta rises).
- Given the new `parity.json`, then `graphs-b15` is `conformant`.
- Given old vs new diffed by id, then only `graphs-b15` (+ any incidental
  improvements) changed and no id regressed.
- Given reconciliation, when the accepted-divergences test runs, then it passes.

## Observability
N/A.

## Rollback
Reversible — `git checkout` the artifacts + re-run the survey.

## Quality bar
Return only: gate result, `graphs-b15` before/after, net diverged delta + any
other changed id, and the accepted-divergences change (if any). No preamble.

## Boundaries
- **Always:** gate vs committed HEAD; STOP on ANY regression or maxDelta rise —
  never refresh the baseline to mask it.
- **Never:** hand-edit generated `parity*.json`/`PARITY.md`; never remove an
  accepted entry whose id is still non-conformant.

## Commit
`chore(T3): refresh parity baseline — graphs-b15 diverged->conformant`
