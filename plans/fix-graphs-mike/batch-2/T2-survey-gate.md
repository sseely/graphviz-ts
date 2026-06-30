<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Survey gate + baseline refresh

## Context
The edge-spline router runs for EVERY dot graph, so the mike fix (T1) must be
regression-free across the whole corpus before merge. Gate = the headless parity
survey (port `EstimateTextMeasurer` vs headless C oracle), per-id diffed against
the committed baseline.

## Task
Run the full survey, diff per-id vs baseline, require 0 regressions, then refresh
the baseline and commit; merge the branch.

## Read-set
- `test/corpus/parity.json` (baseline: conformant **525**, structural 183,
  diverged 70, oracle-error 11)
- `../../docs/conformance.md` (the verdict definition)

## Method (commands)
```
sh test/corpus/gen-headless-gvbindir.sh                 # clean oracle (no probe residue)
GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts
# per-id diff vs baseline (rank conformant>structural>diverged); 0 regressions
```
Wait for completion (~25 min; slow graphs like 2646/2371 are NOT hangs — do not
kill).

## Acceptance (Given/When/Then)
- Given the survey output, when per-id diffed vs baseline, then **0 regressions**
  (no conformant or structural graph moves to a worse verdict).
- Given graphs-mike, then it IMPROVES (diverged → conformant or structural), and
  share-mike / windows-mike improve identically.
- Given a clean diff, when the baseline is refreshed (`cp parity-rules.json
  parity.json` + `GVBINDIR=/tmp/ghl npx tsx test/corpus/dashboard.ts`), then
  `PARITY.md` regenerates with the new counts.

## Stop conditions
- ANY regression → STOP. Do not refresh baseline, do not merge. Log regressed ids
  to decision-journal and investigate.

## Commit + merge
- Commit: T1 code commit + a `chore: refresh parity baseline after mike fix`.
- Merge `feature/fix-graphs-mike` to main with a **merge commit** (preserves
  per-task commits). Ask before pushing (user pushes).

## Observability / Rollback
N/A runtime. Reversible — revert the merge. The survey IS the verification.

## Quality bar
0 regressions is the hard gate. Report the per-id improved/regressed lists
explicitly before refreshing the baseline.
