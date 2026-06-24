<!-- SPDX-License-Identifier: EPL-2.0 -->

# T3 — Verify + regression scan

## Context

S1 localized and T2 fixed the long-edge under-segmentation. This task
regenerates the parity dashboard and proves the win + no regression. Per
CLAUDE.md, any deferred/quarantined case needs a comparison page referenced in
the journal.

## Task

1. Regenerate: `npx tsx test/corpus/survey.ts` then `npx tsx test/corpus/dashboard.ts`.
2. **Canary:** `graphs-p3` `sleep--runmem` matches the oracle's 4-cubic count and
   flips forward (diverged → structural- or byte-match). For the rankdir_dot rows
   S1 classified as this class, confirm their `path[1]` piece count now matches.
3. **Regression floor (D4):** `byte-match ≥ 281`, **0 per-id regressions** vs
   `main`'s `parity.json`; `errored`/`timeout` unchanged.
4. **Reach (D5):** report each rankdir_dot row's verdict delta. Same-class rows
   must flip out of `diverged`; separate-class rows (D5) stay diverged — record
   each in `comparisons/` (deferred, not chased).
5. **Residuals:** any row that improved but still diverges → record in the journal
   with id + `firstDiffPath` (deferred, D3), do not chase.

## Write-set

- `test/corpus/parity.json` (regenerated)
- `test/corpus/PARITY.md` (regenerated)
- `plans/long-edge-undersegment/comparisons/*` (deferred-residual pages)

## Read-set

- `test/corpus/survey.ts`, `test/corpus/dashboard.ts` (run, do not edit)
- pre-mission `parity.json` (git `main`) for the regression diff
- [decisions.md#d4](../decisions.md#d4), [#d3](../decisions.md#d3),
  [#d5](../decisions.md#d5)

## Architecture decisions

D4 (floor ≥ 281, 0 regressions), D3 (unrelated residuals deferred), D5 (rankdir
classification).

## Acceptance criteria

- Given the regenerated survey, when inspecting `sleep--runmem`, then it matches
  the oracle's 4-cubic piece count and `graphs-p3` flips forward.
- Given the survey vs baseline by id, then `byte-match ≥ 281` and **0 rows
  regressed**; `errored`/`timeout` unchanged.
- Given the in-class rankdir rows, then they flip out of `diverged`;
  separate-class rows are documented as deferred.
- Given a currently-matching graph (spot-check), then it is unchanged.

## Observability

N/A — survey is dev/test infra.

## Rollback

**Reversible** — `parity.json`/`PARITY.md` are regenerable.

## Quality bar

Full-branch `tsc` + `vitest` green. Commit: `test(T3): refresh parity dashboard
for long-edge under-segmentation fix`. Body: state the canary verdicts,
byte-match delta, rankdir classification outcome, and any deferred residuals.

## Boundaries

- **Never:** hand-edit `parity.json`/`PARITY.md` (regenerate only); fix unrelated
  residuals (D3/D5); mark the mission complete if any row regressed (stop +
  report).
