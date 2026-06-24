# Batch 2 — Fix + verify

Implement the faithful fix at the location T3 pinned, prove it on the minimal
fixture (TDD), then verify the full suite, parity survey, and the `2475_2`
end-to-end acceptance. Remove the temporary probes from Batch 1.

The write-set of T4 is **determined by T3's `firstDivergence.file`** — most
likely `position-aux.ts` (aux-edge gap), possibly `ns-subtree.ts` (feasible
tree/cutvalues) or `ns.ts` (pivot selection).

## Tasks

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | Faithful fix + TDD regression test | (orchestrator) | position-cluster.ts + .test.ts | T3 | [x] |
| T5 | Full verification + probe cleanup | (orchestrator) | (probes removed), decision-journal.md | T4 | [x] |

## Exit criteria
- Port x-coord pivot count on the minimal fixture == native's (T3 target).
- `npx tsc --noEmit` clean; `npx vitest run` ≥2263 pass.
- Parity survey: 0 verdict regressions vs baseline.
- `2475_2`: pivots ≈ native (~8748), render < 20s.
- All Batch-1 temporary probes removed; `git diff` is limited to the fix file,
  its test, and the committed fixture.
