# Mission: dot flat-edge aux label (DOT-11 + DOT-10)

## Objective

Make port-bearing adjacent labeled flat edges route byte-identically to
`dot` 15.0.0. Two upstream bugs in `make_flat_adj_edges`'s rotated aux
pipeline (`splines-flat.ts`), then the label copy-back:

- **DOT-11a** — `repositionFlatAux` iterates the `nodes` Map, so the aux
  graph's virtual nodes (label vnode + routing vnodes) never get
  `y = midx`. C iterates `GD_nlist`. Fix: iterate `nlist`. Makes the
  labeled-flat spline byte-exact and corrects the label X. **Proven in
  diagnosis** (1853 pass, zero churn).
- **DOT-11b** — even after 11a, the aux edge label `pos.y` is frozen at a
  pre-reposition value (59.25) instead of tracking the repositioned vnode
  `coord.y` (72). Localized to the aux label-placement
  (`placeVnlabel`/`placeRegularEdgeLabels`).
- **DOT-10** — re-add the faithful label copy-back (`copyFlatLabel`,
  `dotsplines.c:1273-1277`); with 11a+11b done it lands byte-exact.

## Branch / merge

- Branch: `feature/dot-flat-aux-label`
- Merge to `main` with a **merge commit** (preserves per-task IDs).

## Constraints (stop / push-forward)

**STOP when:**
- Any existing golden churns (goldens are byte-exact from C).
- T2's fix would require changing label placement for **non-aux** graphs
  (regression risk) — keep the fix scoped to the aux pipeline.
- 2 consecutive gate failures on the same check.
- Same location changed 3× without resolving the same failure.
- A fix needs a file outside the task write-set.

**PUSH FORWARD when:**
- A hook limit forces splitting a helper — split it, log it.
- A choice is purely stylistic and does not change routed geometry.

## Quality gates

- command: `npx tsc --noEmit` — pass: exit 0 — on_fail: fix_and_rerun
- command: `npx vitest run` — pass: exit 0, >= 1853, zero regressions —
  on_fail: fix_and_rerun
- command: `git diff --name-only main` — pass: only task write-sets (+
  plans/) — on_fail: stop

Hook limits: 30 lines/fn, CCN 10, 5 params, 500 lines/file.
A new case is not done until its comparison page (oracle diff vs
`dot -Tsvg`) exists under `comparisons/` and is referenced in the journal.

## Baseline (2026-06-17, main)

- `npx tsc --noEmit` → exit 0
- `npx vitest run` → 1853 passed (126 files)

## Oracle reference

`~/git/graphviz/build/cmd/dot/dot -Tsvg`, GVBINDIR=/tmp/gvplugins, 15.0.0.
Input `digraph{ {rank=same; a b} a:e->b:w[label="x"] }`:
- label "x" → (72, -32.91)
- spline → `M54,-18C62.13,-18 60.91,-26.42 68.62,-29 71.47,-29.95 72.53,-29.95 75.38,-29 78.03,-28.11 79.62,-26.54 80.91,-24.85`

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 (DOT-11a), T2 (DOT-11b), T3 (DOT-10) | [ ] |

## Index

- [decisions.md](decisions.md)
- [batch-1/overview.md](batch-1/overview.md)
- [batch-1/T1-reposition-nlist.md](batch-1/T1-reposition-nlist.md)
- [batch-1/T2-label-y.md](batch-1/T2-label-y.md)
- [batch-1/T3-label-copyback.md](batch-1/T3-label-copyback.md)
- [decision-journal.md](decision-journal.md)
