# T4 — Validate + baseline refresh

## Context

Final batch. Confirm 2368 byte-match (or the documented ≤1pt residual per AD-3)
with 0 corpus regressions, then refresh the committed parity baseline. C is the
spec; the survey gate is the source of truth.

## Task

1. Run the full survey against the committed Batch-1/2(/3) code:
   `GVBINDIR=/tmp/ghl PARITY_OUT=parity-probe.json npx tsx test/corpus/survey.ts`
   then `npx tsx test/corpus/rules-gate.ts test/corpus/parity-probe.json`.
2. Assert GATE PASS, 0 regressions, 0 clip-regressions; assert 2368 is
   `byte-match` (goal) OR `diverged` with only the documented ≤1pt x-NS residual.
3. Refresh the baseline:
   `cp parity-probe.json test/corpus/parity-rules.json && cp parity-probe.json test/corpus/parity.json && npx tsx test/corpus/dashboard.ts`.
4. Write the session-end summary at the bottom of `../README.md`.

## Write-set
- `test/corpus/parity.json`
- `test/corpus/parity-rules.json`
- `test/corpus/PARITY.md`

## Read-set
- `../README.md` (quality gates + recipes)
- `test/corpus/rules-gate.ts` (gate semantics)

## Interface contracts
None.

## Acceptance criteria
- Given the committed fixes, when the full survey runs, then GATE PASS, 0
  regressions, 0 clip-regressions.
- Given the parity report, then 2368 is `byte-match` (mission goal) OR `diverged`
  with ONLY the documented ≤1pt x-NS residual (AD-3 outcome).
- Given the refresh, when `dashboard.ts` runs, then `parity.json`,
  `parity-rules.json`, `PARITY.md` reflect the new state and the byte-match count
  is ≥ the prior 492 (2368 may add +1).

## Observability / Rollback
N/A. Reversible (revert the baseline files).

## Quality bar
Survey GATE PASS 0 regressions. Commit:
`chore: refresh parity baseline after 2368 byte-match`.
