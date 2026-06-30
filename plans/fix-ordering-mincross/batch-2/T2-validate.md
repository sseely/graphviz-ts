# T2 — Validate full survey + refresh baseline

## Context

Batch 1 fixed the `ordering` enforcement. This task validates corpus-wide and
locks in the new baseline.

## Task

1. Run the full survey + rules-gate:
   `GVBINDIR=/tmp/ghl PARITY_OUT=parity-probe.json npx tsx test/corpus/survey.ts && npx tsx test/corpus/rules-gate.ts test/corpus/parity-probe.json`.
2. Confirm **GATE PASS, 0 regressions**. Cross-check the 13 `ordering` graphs
   (`graphs-b58`, `{linux.x86,macosx,nshare}-ordering_dot1`,
   `{graphs,share,windows}-pgram`, `{graphs,share,windows}-trapeziumlr`, `1472`,
   `1990`, `graphs-in`): record which now byte/structural-match and which remain
   diverged.
3. Per AD-5: for any still-diverged `ordering` graph, identify whether the
   in-rank order now matches C (ordering fixed) but a SECONDARY cause remains
   (x-NS, spline, cluster); document it in the decision journal. Do not fix
   secondary causes here.
4. Refresh the baseline:
   `cp test/corpus/parity-probe.json test/corpus/parity-rules.json && cp test/corpus/parity-probe.json test/corpus/parity.json && npx tsx test/corpus/dashboard.ts`.
5. Verify the refreshed gate is self-consistent
   (`npx tsx test/corpus/rules-gate.ts test/corpus/parity-probe.json` → 0
   improvements/0 regressions).

## Write-set

- `test/corpus/parity.json`, `test/corpus/parity-rules.json`,
  `test/corpus/PARITY.md` (regenerated).

## Read-set

- `decisions.md#ad-3`, `#ad-5`
- `../README.md` (corpus-reach list)

## Acceptance criteria

- Given the full survey, when the gate runs, then GATE PASS, 0 regressions, 0
  clip-regressions.
- Given the 13 `ordering` graphs, when checked, then the decision journal records
  each as fixed / fixed-but-secondary-residual / unchanged-with-reason.
- Given the refreshed baseline, when the gate re-runs against it, then 0
  improvements / 0 regressions (self-consistent).
- Given `git diff --name-only`, then only the three `test/corpus/` baseline files
  changed in this task.

## Observability / Rollback

N/A. Reversible (revert commit).

## Quality bar

GATE PASS before commit. One commit: `chore(T2): refresh parity baseline …`.

## Boundaries

- **Never** refresh the baseline while the gate is failing; never accept a
  conformant regression to make a number look better.
