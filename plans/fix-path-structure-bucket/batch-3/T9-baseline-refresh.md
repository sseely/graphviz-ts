# T9 — final baseline refresh + mission summary

## Task
1. Run the full survey with the canonical recipe (memory:
   parity-json-recipe-estimate-ghl): `npm run survey` (Estimate measurer,
   `GVBINDIR=/tmp/ghl`), then `npm run survey:gate`.
2. Audit PER-ID verdict deltas vs the pre-mission baseline (parity.json @
   9032e52): zero regressions allowed; list every changed id in the decision
   journal (memory: bucket-fix-rebucketing — judge by per-id deltas, not
   bucket counts).
3. Refresh the committed baseline: `cp` parity-rules.json → parity.json per
   the recipe, run `npm run survey:dashboard` to regenerate PARITY.md.
4. Write the mission summary at the bottom of the brief README: tasks
   completed vs planned, per-id before/after verdicts for the 8 bucket ids,
   decisions made (count + flagged), gate results, deferred/tracked-deep
   items with note links.
5. Confirm `.agent-notes/` observations are complete for every mechanism
   found; delete any leftover scratch files from the repo root.

## Quality gates
- `npx tsc --noEmit` exit 0
- `npm run test` exit 0
- survey gate: 0 regressions, 0 clip-regressions
- `git diff --name-only` for this task's commit touches only the write-set

## Commit
`chore(T9): refresh parity baseline + dashboard post path-structure fixes`

## Rollback: Reversible.
## Observability: N/A.
