# Batch 1 — localize + fix the swap-blocking site

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|-----------|------|
| T1 | Localize where C makes the crossing-removing move that TS rejects | `decision-journal.md` (+ reverted probe) | — | [x] |
| T2 | Fix the localized defect + TDD regression (per-rank order == C) | localized file(s) of `mincross-cross.ts`/`mincross-order.ts`/`mincross-build.ts`/`mincross.ts` + `*.test.ts` | T1 | [x] |

## Probe-confirmed facts (do not re-derive)

- `mc3` (3 clusters, long edges `a3->b0 a0->b3 b3->c0 b0->c3`): C and TS both
  START at cur_cross 1; C → 0 at pass 0 iter 1; TS holds at 1 forever.
- Same starting order → NOT init-order; NOT a missing phase (TS `dotMincross`
  mirrors C: runComponents→merge2→runClusters→runRemincross).
- The stuck crossing is in the FIRST root `mincross(g,0)` (runComponents).

## C spec anchors

- `dot_mincross` orchestration — `mincross.c:331-394`
- `mincross_clust` — `mincross.c:531`
- `transpose`/`transpose_step` swap test — `mincross.c:632-688`
- `left2right` cluster constraint — `mincross.c` (clust_left2right) /
  TS `mincross-cross.ts:left2right`, `left2rightCluster`
- `medians`/`reorder` — `mincross.c` / TS `mincross-order.ts`

## Prime suspect (verify first)

`left2right` cluster guard active during the first `mincross(g,0)` blocking the
transpose swap that removes the crossing — i.e. clusters constrain ordering
earlier than C, or the contiguity guard is over-restrictive. Confirm before
ruling in `medians`/`reorder` or `build_ranks`.
