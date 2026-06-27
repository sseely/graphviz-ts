# T5 — validate + refresh baselines + merge

## Context
Confirm the feature fixes the 6 radius graphs with zero corpus regressions on
BOTH baselines, refresh the baselines, and land the branch.

## Task
1. Snapshot baselines: `cp test/corpus/parity-rules.json /tmp/pr.base.json`,
   `cp test/corpus/parity.json /tmp/pp.base.json`.
2. Headless survey: `npm run survey` → regenerates `parity-rules.json`.
   Diff vs `/tmp/pr.base.json`: assert **0 regressions** (match→diverged) and
   the 6 radius graphs improved (diverged→byte/structural-match).
3. `npm run survey:gate` → must print `GATE PASS`.
4. Pango baseline:
   `GV_TEXT_MEASURER=lut GVBINDIR=/tmp/gvplugins ORACLE_CACHE=$TMPDIR/oracle-pango-$(date +%s) PARITY_OUT=parity.json tsx test/corpus/survey.ts`.
   Diff vs `/tmp/pp.base.json`: assert 0 regressions + 6 radius graphs improved.
5. `npm run survey:dashboard` → regenerate `PARITY.md`.
6. Commit the fix tasks (one commit each per T1–T4 if not already committed) +
   a `chore(corpus)` baseline-refresh commit. `--no-ff` merge to `main`.
   **User pushes.**

## Read-set
- `README.md#quality-gates`, project memory `bucket-fix-rebucketing`
  (judge by per-id verdict deltas, not bucket counts).

## Write-set
- `test/corpus/parity-rules.json`, `test/corpus/parity.json`,
  `test/corpus/PARITY.md` (regenerated)
- commits + merge

## Acceptance criteria (Given/When/Then)
- Given the headless survey, When diffed vs the snapshot, Then 0 regressions and
  `graphs-radius` + the 5 OS `radius_dot` variants moved out of `diverged`.
- Given `npm run survey:gate`, When run, Then it prints `GATE PASS`.
- Given the pango survey, When diffed vs the snapshot, Then 0 regressions and the
  same 6 improvements.
- Given `npm test`, When run, Then green (incl. all new T1–T4 tests).

## Stop condition
If ANY graph regresses (match→diverged) and no faithful variant clears it →
STOP and report (decisions.md stop #4). A radius graph landing structural-match
(not byte) is success (ADR-4), not a stop.

## Observability / Rollback
N/A. Reversible — `git revert` the merge.
