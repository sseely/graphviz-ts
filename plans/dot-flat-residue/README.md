# Mission: dot flat-edge residue (DOT-9 + DOT-10)

## Objective

Close the two remaining flat-edge routing gaps left after the
flat-labels and edgetype missions, so adjacent same-rank edges route
conformantly to `dot` 15.0.0:

- **DOT-9** — port `makeSimpleFlat` so a no-port, **no-label** group of
  adjacent same-rank edges fans into a spindle (today `cnt>1` parallel
  unlabeled flats overlap because the group falls back to the simplified
  fitter).
- **DOT-10** — copy the flat-edge **label position** back from the
  rotated aux graph in `copyOneFlatSpline`, so port-bearing adjacent
  labeled flats stop dropping their label.

## Branch / merge

- Branch: `feature/dot-flat-residue`
- Merge back to `main` with a **merge commit** (not squash) — preserves
  per-task commit IDs referenced in the decision journal.

## Constraints (stop / push-forward)

**STOP and wait for human input when:**
- Any existing golden churns. Goldens are conformant from the C binary;
  a change means a porting bug, not a new-correct case.
- T2 feasibility spike fails: the aux pipeline does **not** leave
  `auxe.info.label.pos` set after `dotSplines_`. Reassess
  `cloneFlatEdge` (the label object is not deep-cloned by `cloneEdge`).
- 2 consecutive quality-gate failures on the same check.
- The same code location is changed 3× without resolving the same
  failing check.
- A fix needs to modify a file outside the task's declared write-set.

**PUSH FORWARD with judgment when:**
- A hook limit (CCN 10 / 30-line fn) forces splitting a helper — split
  it, log the split in the decision journal.
- A choice is purely stylistic and does not change routed geometry.

## Quality gates

Run after every task. Format per `autonomous-execution.md`:

- command: `npx tsc --noEmit`
  pass: exit 0
  on_fail: fix_and_rerun
- command: `npx vitest run`
  pass: exit 0, pass count >= 1852 (baseline), zero regressions
  on_fail: fix_and_rerun
- command: `git diff --name-only main`
  pass: only files in the task write-sets changed (+ plans/)
  on_fail: stop

Hook limits: 30 lines/fn, CCN 10, 5 params, 500 lines/file.

A new/changed routing case is **not done** until its comparison page
(oracle diff vs `dot -Tsvg`) exists under `comparisons/` and is
referenced in `decision-journal.md`.

## Baseline (captured 2026-06-17, pre-mission)

- `npx tsc --noEmit` → exit 0
- `npx vitest run` → 1852 passed (126 files)

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 (DOT-9) done; T2 (DOT-10) deferred → DOT-11 | [x] T1 / [deferred] T2 |

## Outcome (2026-06-17)

- **T1 (DOT-9):** DONE — `makeSimpleFlat` ported; unlabeled parallel
  adjacent flats fan conformant to dot 15.0.0. Suite 1853 passed, zero
  golden churn. Merged to main.
- **T2 (DOT-10):** DEFERRED. The faithful copy-back was implemented and
  verified, but the emitted label position is not conformant: it inherits
  an upstream divergence in the aux pipeline's layout of a *labeled*
  cross-rank edge. Re-filed as **DOT-11** in
  `../layout-engine-backlog/gaps/dot.md`. T2 code reverted; copy-back lands
  conformant once DOT-11 is fixed.

## Index

- [decisions.md](decisions.md)
- [batch-1/overview.md](batch-1/overview.md)
- [batch-1/T1-makeSimpleFlat.md](batch-1/T1-makeSimpleFlat.md)
- [batch-1/T2-flat-label-copyback.md](batch-1/T2-flat-label-copyback.md)
- [decision-journal.md](decision-journal.md)
