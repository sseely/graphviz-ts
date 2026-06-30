<!-- SPDX-License-Identifier: EPL-2.0 -->

# T3 — Goldens, dashboard refresh, regression scan

## Context

T1 (empty label spans) and T2 (`size=` scaling) are merged on the branch. This
task regenerates the parity dashboard and proves the win + no regression. Per
`CLAUDE.md`: a mission with a quarantined/excluded case is not complete until its
comparison page exists and is referenced in the decision journal.

## Task

1. Regenerate the survey and dashboard:
   ```
   npx tsx test/corpus/survey.ts
   npx tsx test/corpus/dashboard.ts
   ```
2. **Confirm the canary:** the 6 `rankdir_dot*` rows
   (`linux.x86-rankdir_dot{,1,2}`, `nshare-rankdir_dot{,1,2}`) move out of
   `diverged` — ideally to `conformant`, at minimum to `structural-match`. If
   any remain `diverged`, capture the residual `firstDiffPath` and write a
   comparison note (see step 5).
3. **Regression floor (D5):** `conformant` count ≥ 278 and **no** row regresses
   (a previously byte/structural row must not become worse). Compare the new
   `parity.json` against the pre-mission baseline by id. `errored`/`timeout`
   counts must not rise.
4. **Reach check:** report how many of the ~137 `size=` inputs improved
   (byte/structural deltas). Spot-check 2–3 non-rankdir `size=` graphs.
5. **`ratio=` residuals:** for any `ratio=` graph that improved on scale but
   still diverges on node positions, note it as the deferred ratio-aspect-layout
   mission (D3) — do not fix here. Record in the decision journal with the id
   and `firstDiffPath`.

## Write-set

- `test/corpus/parity.json` — regenerated
- `test/corpus/PARITY.md` — regenerated (generated artifact)

## Read-set

- `test/corpus/survey.ts`, `test/corpus/dashboard.ts` (run, do not edit)
- pre-mission `parity.json` (git `main` version) for the regression diff
- [decisions.md#d5](../decisions.md#d5), [#d3](../decisions.md#d3)

## Architecture decisions

D5 (regression floor ≥ 278, 0 regressions), D3 (ratio-aspect residuals are
deferred, not fixed here).

## Interface contracts

None downstream. `parity.json` shape is the existing `SurveyResult[]`
(unchanged).

## Acceptance criteria

- Given the regenerated survey, when inspecting the 6 `rankdir_dot*` rows, then
  all 6 are no longer `diverged` (conformant preferred; structural-match
  acceptable with a logged residual).
- Given the regenerated survey, when comparing to baseline by id, then
  `conformant ≥ 278` and **0 rows regressed**; `errored`/`timeout` unchanged.
- Given a non-rankdir `size=` graph (spot-check), when surveyed, then it
  improved or is unchanged (never regressed).
- Given any `ratio=` graph still diverging on position, when triaged, then it is
  recorded as deferred (D3), not modified.

## Observability

N/A — survey is dev/test infra (a report, not a gate per the dashboard's AD-1).

## Rollback

**Reversible** — `parity.json`/`PARITY.md` are regenerable artifacts.

## Quality bar

Full-branch `npx tsc --noEmit --stableTypeOrdering` + `npx vitest run` green.
Commit: `test(T3): refresh parity dashboard for size= scaling`. Body: state the
rankdir verdicts, the conformant delta, and any deferred `ratio=` residuals.

## Boundaries

- **Never:** hand-edit `parity.json`/`PARITY.md` (regenerate only); fix
  `ratio=` layout-position residuals (out of scope, D3); mark the mission
  complete if any row regressed (stop and report instead).
