# T7 — Validate + refresh baseline

## Context
Final gate for the mission. The anchor (Batch 1) + wiring (Batch 2) must yield
2368/2368_1/1624 conformant with zero regressions across the 790-graph corpus,
then the committed baseline is refreshed.

## Task
1. Confirm all temporary instrumentation is gone (C source clean + rebuilt;
   no `NSDBG`/`XORG`/`XNS`/`FDBG` code in `src/`).
2. Run the full survey to a probe file:
   `GVBINDIR=/tmp/ghl PARITY_OUT=parity-probe.json npx tsx test/corpus/survey.ts`.
3. `npx tsx test/corpus/rules-gate.ts test/corpus/parity-probe.json` — require
   `GATE PASS`, `regressions=0`, and `2368`/`2368_1`/`1624` = `conformant`
   (verify each in the probe file).
4. Diff probe vs committed `parity.json`: the ONLY verdict changes should be
   2368 (diverged→conformant) and any sibling in the degenerate-labeled-flat
   family that legitimately improved; no conformant→worse.
5. Refresh baseline: `cp parity-probe.json parity.json`,
   `cp parity-probe.json parity-rules.json`, `rm parity-probe.json`,
   `npx tsx test/corpus/dashboard.ts`; re-run `survey:gate` → 0/0.

## Write-set
- `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md`

## Read-set
- `test/corpus/rules-gate.ts`, `test/corpus/survey.ts`

## Acceptance criteria
- Given the survey, then `regressions=0` and 2368/2368_1/1624 are conformant.
- Given the verdict diff, then no graph went conformant→worse.
- Given the refreshed baseline, when `survey:gate` re-runs, then 0 regressions / 0
  improvements (baseline now includes the win).

## Observability / Rollback
N/A. Reversible.

## Quality bar
tsc + vitest green. Commit: `chore(parity): refresh baseline after x-NS anchor + degenerate-flat wiring`.
Then write the mission summary at the bottom of README.md.
