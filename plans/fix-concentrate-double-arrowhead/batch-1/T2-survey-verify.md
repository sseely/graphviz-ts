<!-- SPDX-License-Identifier: EPL-2.0 -->

# T2 — Survey verification + residual documentation

## Context
The corpus survey (`test/corpus/survey.ts` → `parity.json` → `dashboard.ts` →
`PARITY.md`) is the differential report vs the headless oracle. After T1 lands,
regenerate it and confirm the predicted flips with **zero regressions**. The
survey ORACLE cache can go stale and produce false regressions — verify any
flagged regression against a FRESH oracle before treating it as real
(see [[make-edge-pairs-trunc-fix]] GOTCHA).

## Task
1. Regenerate: `npm run survey && npm run survey:dashboard`.
2. Confirm verdict deltas:
   - `graphs-b135`, `167`, `2087` → byte-match or structural (no childCount diff).
   - `2825`, `1453` → improved (childCount diff gone).
   - `graphs-b15`, `graphs-b69` → arrowhead diff gone; a separate x-coord residual
     may remain (expected — see [[b69-concentrate-undermerge]]).
   - **No** input regresses from byte/structural → diverged.
3. If b15/b69 (or any target) retain a residual after the arrowhead is correct,
   add/extend a one-paragraph entry in `docs/known-divergences.md` describing it
   as the pre-existing x-coord position residual, not an arrowhead defect. Do NOT
   invent a residual that isn't there.
4. Commit the regenerated `parity.json` + `PARITY.md` (generated artifacts).

## Write-set
- `test/corpus/parity.json` (regenerated)
- `test/corpus/PARITY.md` (regenerated)
- `docs/known-divergences.md` (only if a residual must be documented)

## Read-set
- `test/corpus/survey.ts`, `test/corpus/dashboard.ts` — how verdicts/buckets compute.
- `README.md` (this mission) — predicted impact table.

## Acceptance criteria (Given/When/Then)
- Given the regenerated dashboard, when the diverged list is compared to the
  pre-fix baseline, then `graphs-b135`/`167`/`2087` are no longer in the
  element-count diverged bucket and **no** new id appears in diverged.
- Given a flagged regression (if any), when re-checked against a freshly built
  oracle, then it is confirmed real before any rollback decision.
- Given a remaining b15/b69 residual, when documented, then `known-divergences.md`
  attributes it to x-coord position (cross-links [[b69-concentrate-undermerge]]),
  not to arrowheads.

## Observability
N/A.

## Rollback
Reversible — artifacts regenerate from source; revert restores prior report.

## Quality bar
`npm run survey` completes; 0-regression rule holds. Return only the verdict
delta summary — no preamble.

## Commit
`test(T2): refresh parity survey after concentrate arrowhead fix`
