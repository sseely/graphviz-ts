# Batch 1 — diagnose + route

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|-----------|------|
| T1 | Measure pass-count vs non-convergence vs constant-factor; route Batch 2 | `decision-journal.md` (+ reverted probes) | — | [x] |

## T1 result (2026-06-17)

Cause = **(b) non-convergence**. Two faithful-port deviations from C, both
confirmed (probes reverted), both **outside the write-set** → **STOPPED**:

1. `mincross-build.ts:buildRanksFlip` — manual 0-based rank reverse assigning
   `order=j` ignores `vStart`; C's flip block uses `exchange()`
   (`mincross.c:1293-1300`). Breaks RL/flip + multi-component (`vStart>0`).
   Fix: `exchange(ctx, rankGet(rk,j), rankGet(rk,last-j))`. Makes TS transpose
   byte-identical to C.
2. `cluster.ts:mergeRanksInstall:136` — `.slice(ipos)` copies the rank array;
   C aliases (`GD_rank(subg)[r].v = GD_rank(root)[r].v + ipos`). Cluster
   transpose swaps then never persist → 2nd non-convergence. Fix:
   `subg.rank[r].v = root.rank[r].v; subg.rank[r].vStart = ipos`.

Both fixes → 2471 completes in TS (44.4s, was infinite). Numbers + evidence in
`decision-journal.md`. Batch 2 blocked on write-set authorization (see README).

## Goal

Produce a journal routing decision (AD-3/AD-4) that names the dominant transpose
cost **with numbers** and the exact Batch-2 target site, plus a parity baseline.

## Probe-confirmed facts (do not re-derive)

- 2471 mincross does not complete; >90s inside a single `transpose()` call;
  V8 `--prof` = 98% `transposeStep`→`transpose`→`mincrossStep`. HEAD~1 identical
  (97.6%) → pre-existing, not a regression.
- Per-swap scope already matches C: `transposeStep` uses local
  `transposeCounts(v,w)` (in_cross+out_cross over the two nodes' edges), not a
  global `ncross`. `ncross` is incremental via `rk.valid` cache.

## What T1 must measure (both sides)

1. **Pass-count:** instrument TS `transpose`'s `do…while` — count passes per
   call, swaps per pass, and the `delta` trajectory. Do the same in C
   (`transpose`, instrument-and-revert). Compare on the synthetic mid-size graph
   AND a bounded 2471 window. Diverging pass-counts ⇒ cause (a)/(b).
2. **Convergence:** does TS `delta` reach 0 (terminates) or oscillate ≥1 on
   2471? Oscillation ⇒ cause (b).
3. **Per-pass cost:** if pass-counts match C, profile per-pass — per-pair
   `[0,0]` alloc in `transposeCounts`, `new Array` in `rcross`, megamorphic
   property access ⇒ cause (c).
4. **Parity baseline:** capture C's per-rank order (oracle) for mc3 + the
   mid-size graph for later byte-diff (reuse the prior mission's order-probe).

## C spec anchors

- `transpose` / `transpose_step` — `mincross.c:632-688`
- `in_cross` / `out_cross` (local delta) — `mincross.c:583-630`
- `ncross` / `rcross` (incremental, `valid` cache) — `mincross.c`
- reused buffers `TI_list` / `Count` — `mincross.c` (init_mincross alloc)

## Deliverable

A `decision-journal.md` row stating: dominant cause ∈ {a,b,c} with the measured
numbers, the exact target function(s)+lines for Batch 2, and the parity baseline
location. All probes reverted (TS + C source).
