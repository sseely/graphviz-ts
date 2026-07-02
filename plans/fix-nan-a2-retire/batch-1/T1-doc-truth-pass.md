<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Stage-1 truth pass: §A2 doc + honest JSON reasons

## Context
graphviz-ts, faithful TS port of C graphviz. `docs/known-divergences.md` §A2
carries a 2026-06-30 status note admitting its own body is stale: A2 has
largely collapsed (proc3d conformant); only the `NaN` family remains, its
node geometry now matches C exactly, and the residual is 8 edge endpoints —
yet the section still presents the FreeType width table as current and shows
non-corpus proc3d overlay figures. `test/corpus/accepted-divergences.json`
still gives the 3 NaN entries the stale reason "wide-label font-metric delta
… tips an integer x-network-simplex constraint".

## Task
Stage 1 of decisions.md#d2 — truth-only, zero verdict churn:
1. Rewrite §A2 so no claim contradicts the measured 2026-06-30 state: text
   measurement is neutralized (both sides estimate); nodes match exactly;
   the open residual is the 8 straight-edge endpoints (4 pairs listed in
   README). Keep the injectable-TextMeasurer explanation (still accurate).
   Move superseded analysis to a clearly-marked historical appendix or cut
   it. Fix/remove the FreeType table framing and non-corpus proc3d figures.
2. Re-word the `reason` field of the 3 NaN entries (`graphs-NaN`,
   `share-NaN`, `windows-NaN`) to the honest residual ("nodes exact; 8
   straight-edge endpoints shift 6–14 pt; mechanism under re-diagnosis, see
   §A2"). Do NOT remove entries, change `match`/`class`/`scope`/`verdict`/
   `bound`, or touch A1/A3/R-* entries.

## Write-set
- `docs/known-divergences.md`
- `test/corpus/accepted-divergences.json`

## Read-set
- `docs/known-divergences.md` §A2 (lines ~103–270)
- `test/corpus/accepted-divergences.json`
- `test/corpus/PARITY.md` accepted-deltas table (lines ~30–45, for cross-refs)
- `test/corpus/accepted-divergences.test.ts` (the guard you must keep green)

## Acceptance criteria
- Given the guard, when `npx vitest run test/corpus` runs, then PASS.
- Given the fresh committed parity, when `rules-gate` runs, then output
  unchanged from before T1.
- Given §A2 and the JSON reasons, when read against the README "Objective"
  facts, then no contradiction remains (nodes-exact, 8-edge residual, both
  sides estimate).
- Given `git diff --name-only`, then exactly the two write-set files.

## Observability / Rollback
N/A — docs+metadata only. Reversible (single revert).

## Commit
`docs(a2): stage-1 truth pass — §A2 reality + honest NaN entry reasons`
