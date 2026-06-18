# Batch 1 — diagnose + route

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|-----------|------|
| T1 | Measure pass-count vs non-convergence vs constant-factor; route Batch 2 | `decision-journal.md` (+ reverted probes) | — | [ ] |

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
