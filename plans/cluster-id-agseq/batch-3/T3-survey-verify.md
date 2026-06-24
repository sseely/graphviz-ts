<!-- SPDX-License-Identifier: EPL-2.0 -->

# T3 — survey verification + dashboard regen

## Context

T1–T2 changed cluster id emission to AGSEQ. This task proves the change against
the full dot corpus and refreshes the parity dashboard. The survey renders 796
inputs and compares against the native `dot 15.1.0` oracle.

## Task
1. Run: `npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts`
   (regenerates `parity.json` + `PARITY.md`). This can take minutes — do not
   interrupt.
2. Confirm the **7 confirmed targets** left `diverged` (now byte- or
   structural-match): `graphs-nestedclust`, `linux.x86-nestedclust_dot`,
   `macosx-nestedclust_dot`, `nshare-nestedclust_dot`, `705`, `graphs-b7`,
   `1514`.
3. Confirm **0 net regressions**: the `clust*` / `labelclust*` / `grdcluster`
   byte-match cases (≈40, listed in the pre-change PARITY.md byte-match block)
   remain byte-match. Compare pre/post `parity.json` per-id verdicts — judge by
   per-id verdict deltas, not bucket counts (re-bucketing is expected for the
   multi-axis `@id` cases).
4. Write a decision-journal entry: targets flipped, any re-bucketed, any
   regression, and the net byte+structural delta.

## Diagnosis branch (decides T4)
If any of the 7 targets did **not** flip, or a guard regressed:
- Render that input via `npx tsx test/corpus/render-one.ts <path> dot` and diff
  cluster ids vs `dot -Tsvg <path>`.
- If the port's cluster seq is **lower** than the oracle's by the count of
  edge-endpoint subgraphs (`{…} -> {…}`) appearing before that cluster in source
  order → endpoint-subgraph drift → execute **T4**.
- If the mismatch has any other cause → **stop** and document (out of scope per
  README stop conditions).

## Read-set
- `test/corpus/survey.ts`, `test/corpus/dashboard.ts` (run, don't modify)
- `test/corpus/parity.json` (pre-change snapshot for the diff — `git stash`/`git
  show HEAD:` the baseline if needed)
- `~/.claude/rules/` memory note: judge bucket fixes by per-id verdict deltas

## Acceptance criteria
- Given the post-change survey, when checking the 7 targets, then none is in the
  `diverged` list.
- Given pre vs post `parity.json`, when diffing per-id verdicts, then no id
  moves byte/structural → diverged (0 regressions).
- Given `PARITY.md`, when read, then its summary counts reflect the new run
  (byte-match increased, diverged decreased by ≥7 minus any re-bucket).

## Observability
N/A.

## Rollback
Reversible — `PARITY.md`/`parity.json` are generated artifacts.

## Quality bar
Survey completes; verdict diff computed and recorded in the decision journal.

## Commit
`test(T3): refresh parity dashboard for AGSEQ cluster ids`
