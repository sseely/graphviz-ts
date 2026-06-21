<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Golden + parity verification

## Context
Lock the rounded-render fix with a deterministic golden and quantify the parity
gain. The parity dashboard is judged by per-id verdict deltas (memory
`bucket-fix-rebucketing`), not aggregate counts.

## Task
1. Add golden input `test/golden/inputs/dot-rounded-clusters-mrecord.dot`
   exercising a rounded cluster (incl. `rounded,filled`) AND an Mrecord in one
   small deterministic graph, e.g.
   `digraph { subgraph cluster_0 { style="rounded,filled"; fillcolor=grey95; a [shape=Mrecord,label="x|y"]; } subgraph cluster_1 { style=rounded; color=steelblue; b; } a->b; }`
   (pick the exact graph during execution; keep it small and deterministic).
2. Generate its reference from the canonical oracle:
   `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg <in> > refs/dot-rounded-clusters-mrecord.svg`.
3. Register in `test/golden/manifest.json` (engine `dot`, toleranceClass
   `deterministic`) and bump the count assertion in `test/golden/suite.test.ts`
   (132 → 133).
4. Run `npx vitest run test/golden/suite.test.ts` — the new golden must pass.
5. Regenerate the dashboard: `npx tsx test/corpus/survey.ts && npx tsx
   test/corpus/dashboard.ts`. Compute per-id deltas vs the branch-point baseline
   (filter timeout/errored/oracle-error as noise): confirm IMPROVED > 0 and
   REGRESSED == 0. Record the counts in `decision-journal.md`.

## Write-set
- `test/golden/inputs/dot-rounded-clusters-mrecord.dot`
- `test/golden/refs/dot-rounded-clusters-mrecord.svg`
- `test/golden/manifest.json`
- `test/golden/suite.test.ts` (count assertion + tally comment)
- `test/corpus/PARITY.md`, `test/corpus/parity.json`

## Read-set
- `test/golden/manifest.json` (entry shape; `dot-point-shape` is the most recent
  template) and `test/golden/suite.test.ts:64-77` (count assertion + comment)
- `test/corpus/survey.ts`, `test/corpus/dashboard.ts` (regen commands)

## Interface contract
Consumes T1's corrected rendering only via the oracle/survey; no code interface.

## Acceptance criteria
- AC1: Given the new golden, when `npx vitest run` runs, then it passes at
  `deterministic` tolerance and the count assertion matches the new total (133).
- AC2: Given regenerated parity vs the baseline, when per-id deltas are computed,
  then REGRESSED == 0 and IMPROVED > 0; counts recorded in decision-journal.md.
- AC3: Given `git diff --name-only HEAD~1 HEAD`, then only write-set files changed.

## Observability
N/A — the parity dashboard IS the fidelity report; update it.

## Rollback
Reversible.

## Quality bar
One commit: `test(parity): golden + dashboard for rounded clusters and Mrecord`.
