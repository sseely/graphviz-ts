<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Survey gate + baseline refresh

## Context
The x-NS tree construction runs for EVERY dot graph, so the b51 fix (T1) must be
proven regression-free across the whole corpus before merge. The gate is the
headless parity survey (port `EstimateTextMeasurer` vs headless C oracle), per-id
diffed against the committed baseline.

## Task
Run the full survey, diff per-id vs baseline, require 0 regressions, then refresh
the baseline and commit.

## Read-set
- `test/corpus/parity.json` (baseline: byte-match **522**, struct 183, diverged 73)
- Recipe memory: parity.json & parity-rules.json share the Estimate+headless recipe.

## Method (commands)
```
# 1. headless oracle dir (clean — ensure no probe residue in C)
sh test/corpus/gen-headless-gvbindir.sh
# 2. full survey (789 applicable; 2854 is quarantined perf; ~25 min)
GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts
# 3. per-id diff vs baseline (rank: byte-match>structural>diverged)
node -e '<per-id improved/regressed diff; see prior session pattern>'
```
Wait for completion (slow tail: 2646 ~5.6min, 2371 ~3.2min, etc. — do NOT kill;
a graph being slow is not a hang. See the 2854 false-alarm lesson in
`.agent-notes/flat-edge-spurious-yslope-class.md`).

## Acceptance (Given/When/Then)
- Given the survey output, when per-id diffed vs baseline, then **0 regressions**
  (no byte-match or structural graph moves to a worse verdict).
- Given share-b51, then it IMPROVES (diverged → structural-match or byte-match),
  and ideally graphs-b51 / windows-b51 too.
- Given a clean diff, when the baseline is refreshed
  (`cp parity-rules.json parity.json` + `GVBINDIR=/tmp/ghl npx tsx
  test/corpus/dashboard.ts`), then `PARITY.md` regenerates with the new counts.

## Stop conditions
- ANY regression → STOP. Do not refresh baseline, do not merge. Log the regressed
  ids to decision-journal and investigate (the order change had a wider effect).

## Commit + merge
- Commit the fix (T1) + baseline refresh together is acceptable, or T1's code
  commit + a separate `chore: refresh parity baseline after x-NS order fix`.
- Merge `feature/fix-xns-tree-order` to main with a **merge commit** (mission
  branch — preserves per-task commits). Ask before pushing (user pushes).

## Observability / Rollback
N/A runtime. Reversible — revert the merge. The survey IS the verification.

## Quality bar
0 regressions is the hard gate. Report the per-id improved/regressed lists
explicitly before refreshing the baseline.
