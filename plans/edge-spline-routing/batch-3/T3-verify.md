<!-- SPDX-License-Identifier: EPL-2.0 -->

# T3 — Verify + regression scan

## Context

S1 localized and T2 fixed the long-edge extra-segment divergence. This task
regenerates the parity dashboard and proves the win + no regression. Per
CLAUDE.md, any quarantined/excluded case needs a comparison page referenced in
the journal.

## Task

1. Regenerate: `npx tsx test/corpus/survey.ts` then `npx tsx test/corpus/dashboard.ts`.
2. **Canary:** the reproducer's diverging edge and rankdir_dot* paths 10/17/21
   match the oracle's bezier piece counts; report whether the 6 rankdir_dot*
   rows move out of `diverged` (byte/structural). If any remain diverged,
   capture the residual `firstDiffPath` and write a comparison page under
   `plans/edge-spline-routing/comparisons/`.
3. **Regression floor (D4):** `conformant ≥ 280`, **0 per-id regressions** vs
   `main`'s `parity.json`; `errored`/`timeout` unchanged.
4. **Reach:** report how many long-edge / Helvetica rows improved (verdict +
   maxDelta deltas); spot-check 2-3.
5. **Residuals:** any row that improved on segment count but still diverges →
   record in the journal with id + `firstDiffPath` (deferred), do not chase (D3).

## Write-set

- `test/corpus/parity.json` (regenerated)
- `test/corpus/PARITY.md` (regenerated)

## Read-set

- `test/corpus/survey.ts`, `test/corpus/dashboard.ts` (run, do not edit)
- pre-mission `parity.json` (git `main`) for the regression diff
- [decisions.md#d4](../decisions.md#d4), [#d3](../decisions.md#d3)

## Architecture decisions

D4 (floor ≥ 280, 0 regressions), D3 (unrelated residuals deferred).

## Acceptance criteria

- Given the regenerated survey, when inspecting the reproducer + rankdir paths,
  then the previously extra-segment edges match the oracle piece counts.
- Given the survey vs baseline by id, then `conformant ≥ 280` and **0 rows
  regressed**; `errored`/`timeout` unchanged.
- Given a currently-matching graph (spot-check), then it is unchanged.
- Given any still-diverging improved row, then it is recorded as deferred, not
  modified.

## Observability

N/A — survey is dev/test infra.

## Rollback

**Reversible** — `parity.json`/`PARITY.md` are regenerable.

## Quality bar

Full-branch `tsc` + `vitest` green. Commit: `test(T3): refresh parity dashboard
for long-edge spline fix`. Body: state the canary verdicts, conformant delta,
and any deferred residuals.

## Boundaries

- **Never:** hand-edit `parity.json`/`PARITY.md` (regenerate only); fix unrelated
  residuals (D3); mark the mission complete if any row regressed (stop + report).
