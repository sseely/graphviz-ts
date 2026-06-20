<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — Goldens + parity verification

## Context
Lock in the straight-mode fix with golden tests and quantify the parity gain.
Goldens encode the C-oracle output; the parity dashboard is a report (AD-1 of the
corpus harness), judged by per-id verdict deltas (see memory
`bucket-fix-rebucketing`), not aggregate counts.

## Task
1. Add golden input `test/golden/inputs/dot-long-edge-straight.dot` =
   `digraph G { a->b->c->d->e->f; a->f; }`.
2. Generate its reference from the canonical oracle:
   `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg <in> > refs/dot-long-edge-straight.svg`.
3. Add ≥1 corpus winner as a golden (recommend `p2` from
   `~/git/graphviz/tests/graphs/p2.gv`; pick another from the improved list if
   useful). Same ref-generation step.
4. Register entries in `test/golden/manifest.json` (engine `dot`, toleranceClass
   `deterministic`) and bump the count assertion in
   `test/golden/suite.test.ts` (currently expects 129).
5. Run `npx vitest run test/golden/suite.test.ts` — new goldens must pass.
6. Regenerate the dashboard: `npx tsx test/corpus/survey.ts && npx tsx
   test/corpus/dashboard.ts`. Compute per-id deltas vs
   `git show HEAD:test/corpus/parity.json` (filter timeout/errored as noise):
   confirm IMPROVED > 0 and REGRESSED == 0. Record the counts in the
   decision journal.

## Write-set
- `test/golden/inputs/dot-long-edge-straight.dot` (+ any extra corpus-winner input)
- `test/golden/refs/dot-long-edge-straight.svg` (+ matching ref)
- `test/golden/manifest.json`
- `test/golden/suite.test.ts` (count assertion + comment)
- `test/corpus/PARITY.md`, `test/corpus/parity.json`

## Read-set
- `test/golden/manifest.json` (entry shape; see the `dot-cluster-external-edge`
  entry added previously as a template)
- `test/golden/suite.test.ts:64-75` (count assertion + tally comment)
- `test/corpus/survey.ts`, `test/corpus/dashboard.ts` (regen commands)

## Acceptance criteria
- Given the new goldens, when `npx vitest run` runs, then they pass at
  `deterministic` tolerance and the count assertion matches the new total.
- Given the regenerated parity vs baseline, when per-id deltas are computed,
  then REGRESSED == 0 and IMPROVED > 0; counts recorded in decision-journal.md.
- Given `git diff --name-only`, then only write-set files changed.

## Observability
N/A — the parity dashboard IS the project's fidelity report; update it.

## Rollback
Reversible.

## Quality bar
One commit: `test(parity): goldens + dashboard for long-edge straight-mode`.
