<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — Re-survey, gate, refresh baseline, reconcile accepted-divergences

## Context
The fix is in (T2). Confirm it resolves `nshare-root_twopi` without regressing any
other corpus case, then refresh the committed parity baseline and reconcile the
stale accepted-divergences entry. The parity survey is the project's
layout-fidelity fitness function; `survey:gate` must show 0 regressions before the
baseline is updated.

## Task (sequential — depends on T2)
1. Run the headless survey: `npm run survey` (writes `test/corpus/parity-rules.json`;
   uses `GVBINDIR=/tmp/ghl`, `GV_TEXT_MEASURER=estimate`). Use `npx tsx` on the
   underlying command if a bare `tsx` is not on PATH (see README note).
2. Run the gate: `npm run survey:gate`. Must exit 0 (no regressions vs baseline).
   If it lists regressions, **STOP** — the fix regressed a previously-matching
   case; do not refresh the baseline.
3. Verify `nshare-root_twopi` improved: in the new `parity-rules.json` it is no
   longer `diverged` (expect `conformant`; `structural-match` only if an AD-4
   residual was accepted).
4. Refresh the committed baseline:
   `cp test/corpus/parity-rules.json test/corpus/parity.json` then
   `npm run survey:dashboard` (regenerates `test/corpus/PARITY.md`).
5. Reconcile the accepted-divergences entry (AD-5):
   - If `nshare-root_twopi` is now **conformant**: remove its
     `accepted-divergences.json` entry (`scope: rules`, `class R-emit`) and its
     row in `rules-known-divergences.md` — it no longer needs a rules-gate
     exception. Re-run `npx vitest run test/corpus/accepted-divergences.test.ts`
     (the guard asserts listed ids are still non-conformant; a removed id passes).
   - If an AD-4 residual was accepted: rewrite the entry's `bound`/`reason` to the
     true post-fix residual and add the paired prose to `docs/known-divergences.md`.

## Write-set
- `test/corpus/parity.json`
- `test/corpus/parity-rules.json` (tracked canonical baseline source — refresh too)
- `test/corpus/PARITY.md`
- `test/corpus/accepted-divergences.json` (remove or rewrite the stale entry — AD-5)
- `test/corpus/rules-known-divergences.md` (paired prose)
- `docs/known-divergences.md` (only if an AD-4 residual is accepted)

## Read-set
- README quality-gate / baseline-refresh recipe
- `test/corpus/survey.ts`, `rules-gate.ts`, `dashboard.ts` (run, don't edit)
- `test/corpus/accepted-divergences.json` + `accepted-divergences.test.ts` (the
  guard that pairs list edits with non-conformance)

## Architecture decisions in scope
AD-5 (reconcile accepted entry), AD-6 (reversible — regenerated artifacts).

## Acceptance criteria
- **Given** the post-fix survey, **when** `npm run survey:gate` runs, **then** it
  exits 0 (zero regressions).
- **Given** the new `parity.json`, **when** `nshare-root_twopi` is inspected,
  **then** it is no longer `diverged` (conformant, or structural-match only with a
  signed-off AD-4 residual).
- **Given** the accepted-divergences reconciliation, **when**
  `npx vitest run test/corpus/accepted-divergences.test.ts`, **then** it passes
  (no stale/rotted entry).
- **Given** the baseline refresh, **when** `git diff test/corpus/PARITY.md`,
  **then** `nshare-root_twopi` has moved out of the diverged table and totals
  updated.

## Observability requirements
N/A.

## Rollback notes
Reversible — `parity.json`/`parity-rules.json`/`PARITY.md`/`accepted-divergences.json`
are regenerated or hand-reconciled; revert the commit.

## Quality bar
Return only: gate result (pass/regressions), the `nshare-root_twopi` verdict
before/after, the net diverged-count delta, and the accepted-divergences change.
No preamble.

## Boundaries
- **Always:** stop and report if `survey:gate` shows ANY regression — do not
  refresh the baseline to mask it.
- **Never:** hand-edit `parity.json`/`parity-rules.json`/`PARITY.md` (generated);
  never remove an accepted-divergences entry while its id is still non-conformant
  (the guard will fail).

## Commit format
`chore(T3): refresh parity baseline + reconcile accepted-divergences after root_twopi fix`
