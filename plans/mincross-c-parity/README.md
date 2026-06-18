# Mission: mincross C-parity (large-graph correctness + performance)

## Objective

Make the TS dot `mincross` (crossing minimization) match the C
implementation in both **correctness** and **performance** so large graphs
(e.g. `tests/2471.dot`, 35k lines, HTML tables + clusters + flat labels)
render. C renders 2471 in **2.78s**; the TS is **>50× slower** (effectively
hangs). The cause is several divergences, all in the **transpose** phase,
plus a JS hot-path performance gap.

This is a **long-spanning, multi-batch** mission: land the known fixes,
then systematically diff each mincross component against C to surface and
fix the rest, then optimize the hot path.

## Discovered divergences (C-instrumented)

| # | Piece | Divergence |
|---|-------|-----------|
| 1 | `transpose_step` reverse condition | TS swapped on `cross < 0`; C: `c1 < c0 \|\| (c0>0 && reverse && c1==c0)` — inverted reverse logic worsened crossings |
| 2 | `transpose` candidate flag | Missing; C re-examines only candidate ranks (set on swap for r, r±1), terminates on `delta < 1` |
| 3 | `transpose_step` `valid` invalidation | C sets `Root[r/r±1].valid=false` on swap to invalidate the ncross cache; TS never does → stale `ncross()` after transpose |
| 4 | Performance | JS hot path (`transposeCounts` O(deg²), ~1750 transpose passes on 2471) far slower than compiled C |

Confirmed **matching** C: main loop (`MaxIter=24`/`MinQuit=8`/`Convergence=.995`/
`trying`), `reorder` (incl. its valid invalidation), `medians`, `xpen`,
`ncross`/`rcross` caching structure.

## Verification harness

C dot layout is in the **`gvplugin_dot_layout` plugin** (rebuild +
`cp plugin/dot_layout/libgvplugin_dot_layout*.dylib /tmp/gvplugins/`; run via
stdin with `GVBINDIR=/tmp/gvplugins`). See [[recover-slack-and-c-harness]],
[[corpus-scan-for-rare-triggers]]. The trajectory diff (Batch 2) instruments
both C and TS to dump `ncross` per `mincross_step` iter and compares.

## Branch / merge

- Branch: `feature/mincross-c-parity` (currently `investigate/mincross-c-parity`).
- Merge to `main` with a merge commit.

## Constraints (stop / push-forward)

**STOP when:** any golden churns and the change is NOT a faithful C match
(if a fix makes the TS match C and churns a golden, the golden was wrong —
regenerate from the C oracle and document); a fix needs files outside the
batch write-set; the same divergence resists 3 fix attempts; a perf change
alters output.

**PUSH FORWARD when:** hook-limit split; a fix is a verified C match even if
it changes internal (non-output) state.

## Quality gates

- `npx tsc --noEmit` → 0
- `npx vitest run` → ≥ 1864, zero golden churn (unless a golden is
  regenerated from the C oracle, documented in the journal)
- Hook limits: 30 lines/fn, CCN 10, 5 params, 500/file.

## Baseline (2026-06-17, main): tsc 0, vitest 1864.

## Batches

| Batch | Focus | Status |
|-------|-------|--------|
| 1 | Land the 3 transpose correctness fixes (reverse, candidate, valid) | [x] |
| 2 | C↔TS trajectory harness; surface remaining divergences | [ ] |
| 3 | Fix each discovered divergence (one component per task) | [ ] |
| 4 | Performance: profile + optimize hot path so 2471 completes | [ ] |

## Index

- [decisions.md](decisions.md)
- [batch-1/overview.md](batch-1/overview.md)
- [decision-journal.md](decision-journal.md)
