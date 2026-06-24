<!-- SPDX-License-Identifier: EPL-2.0 -->

# X2 — Validate + comparison page

## Context

X1 implemented the fix. This task proves zero regressions, measures the speedup,
and documents the outcome (project CLAUDE.md completion rule).

## Task

1. Full survey: `npx tsx test/corpus/survey.ts`. Diff per-id verdicts vs
   `parity-baseline.json`. **0 changed verdicts** required (a mincross order
   change ripples into positions/splines → any change is a regression).
2. Byte-identity spot-check: render 2108 + a few mincross-heavy cases before
   (baseline build) and after; `diff` must be empty.
3. Re-time 2108 (primary) + graphs-b100 / graphs-b104 / 1718 via the production
   `dist` bundle; record C-vs-port before/after.
4. Write `comparisons/mincross-2108.md`: the diagnosis verdict, the fix, the
   before/after timings, and whether any case flips out of `timeout` (note the
   tsx-survey-vs-dist overhead caveat from the prior mission).
5. Update `decision-journal.md` with the final numbers and reference the
   comparison page.

## Write-set

- `plans/mincross-perf-derisk/comparisons/mincross-2108.md` — create
- `plans/mincross-perf-derisk/decision-journal.md` — append

## Read-set

- `parity-baseline.json`, `findings.md`, `decisions.md#ad-3`
- prior comparison page `plans/dot-hangs-crashes/comparisons/timeout-cases.md`
  (format + the tsx-survey overhead caveat)

## Acceptance criteria

- **Given** the post-fix survey, **when** diffed vs baseline, **then** 0 changed
  verdicts and byte-match ≥ 312 / structural ≥ 256.
- **Given** 2108 before/after SVGs, **when** diffed, **then** byte-identical.
- **Given** 2108 re-timed, **when** logged, **then** the comparison page records
  the new time vs native (14 s) and vs the pre-fix 84 s.
- **Given** the mission, **when** complete, **then** the comparison page is
  referenced in the decision journal (completion rule).

## Observability / Rollback

N/A. Reversible — revert X1 + X2 commits.

## Quality bar

The survey gate is the exit gate. If any per-id verdict changed, STOP (AD-3) —
the fix altered layout, not just speed.
