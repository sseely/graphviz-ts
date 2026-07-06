<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: 2620 pure-ortho edge-routing residual

**Objective.** Drive corpus case 2620's residual ortho edge-path divergence
to conformant or documented-irreducible acceptance. Baseline (main 02af46c,
2026-07-05): 2620 = structural-match, ~423 diffs, maxΔ585, `maxDeltaPath`
`svg/g[1]/g[428]/path[1]/@d[4]` (a single edge coordinate). ALL node-order
diffs are gone — F2/F5's mincross transpose-gate fix made the maze INPUT match
C, so this is a PURE edge-routing residual in the ortho corridor/track pipeline.
Distinct from residual-cleanup's three landed ortho fixes (M1 apple-qsort, M2
addPEdges, M3 gcell-ULP — all on main; 2620 still diverges).

**Global invariant:** conformant count must not drop below 754.

## Batches

| Batch | Status | Doc |
|---|---|---|
| 1 — T1 bounded diagnosis (fable, worktree) | [ ] | [batch-1/overview.md](batch-1/overview.md) |
| 2 — T2 outcome (fix OR registry accept) + survey gate | [ ] | [batch-2/overview.md](batch-2/overview.md) |
| 3 — T3 closeout | [ ] | [batch-3/overview.md](batch-3/overview.md) |

## Constraints

**Stop and ask** when: the fix write-set must exceed `src/ortho/`
(standing amendment — name the expanded set, do not auto-expand); two
consecutive survey-gate failures on the same check; the diagnosis contradicts
a landed fix (M1–M3); verdict=split reveals a second, upstream mechanism.

**Push forward** on: which ortho file to instrument first; test-fixture shape;
any maxΔ=0.0 timeout flip (standalone-verify per the 1652/2646 rule, never a
stop).

**Inherited ops (wholesale from residual-cleanup/endgame):** diagnosis agents
worktree-isolated, docs returned as final messages (writes don't persist —
orchestrator writes analysis/*.md); one registry writer per batch if accept;
per-batch survey gate on an OTHERWISE-IDLE box; NEVER rebuild the dot binary
(oracle-cache signature); revert C instrumentation + rebuild the ortho plugin
(/tmp/gvmine or /tmp/gvplugins) with byte-verification; one-branch-per-fix
squash-merged via an integration branch, push, delete; keep plans/ forever.

## Quality gates (per batch)

- `npx tsc --noEmit` → clean
- `npx vitest run` → green (incl. TB_balance qsort pin — gvQsort is global)
- Survey: `GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts`
  then `npx tsx test/corpus/rules-gate.ts` → 0 regressions (standalone-verify
  any maxΔ=0.0 timeout flip before calling it a regression)
- Snapshot refresh after pass: `cp test/corpus/parity-rules.json
  test/corpus/parity.json && npx tsx test/corpus/dashboard.ts`

## Links
[decisions.md](decisions.md) · [decision-journal.md](decision-journal.md) ·
analysis/ (diagnosis outputs) · [diagrams/component-map.md](diagrams/component-map.md)

Model routing: T1 fable (tricky ortho diagnosis); T2 sonnet (mechanical fix or
registry write); T3 orchestrator inline. Rollback: everything Reversible.
