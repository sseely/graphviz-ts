# T3 — Diagnose the transpose oscillation (root-cause doc)

## Context

With the T1 vStart fix, TS `transpose` (`mincross-cross.ts`) loops
`while (delta >= 1)` forever (delta plateaus ~5221) where C converges in 3s.
Uncapped, 270 duplicate `ND_order` appear before transpose; with a ≤5 step cap
2471 completes clean. Root cause is **unknown** — this task finds it.

## Task (diagnose; do NOT ship a fix here)

Drive from T2's classification (A small repro, or B = 2471):

1. **Dup-order hypothesis first (AD-3).** Instrument per-rank/per-step a detector
   for (a) duplicate `ND_order` and (b) `order != absolute index` within each
   rank window. Find the **first step + rank** where a violation appears, then
   trace the exact operation (which `exchange`, in `reorder` vs `transposeStep`)
   that creates it. Each individual `exchange` is provably consistent — look for
   the *input* that is already inconsistent and walk back to its origin.
2. **If no dup at the divergence point**, pivot: dump the per-rank order
   (fingerprinted) at the first oscillating `transpose` entry, C vs TS, and find
   the first rank/pair where TS's swap decision differs from C's. Compare
   `transposeCounts`/`accumCross` (single-pass `val()`) against C's
   `in_cross`+`out_cross` (two separate calls, directional `port.p.x` tie) for
   that exact pair — the single-pass encoding may not reproduce C's structure.
3. Stop the moment a single C-faithful divergence is pinned.

## Write-set
- `plans/mincross-2471-faithful/batch-2/layer2-root-cause.md` (the deliverable)
- Temp-only: `mincross-cross.ts`/`mincross-order.ts` (probes; reverted after) and
  `~/git/graphviz/lib/dotgen/mincross.c` (C dumps; reverted after)

## Read-set
- `src/layout/dot/mincross-cross.ts` (transpose ~L216, transposeStep,
  transposeCounts/accumCross ~L106, exchange ~L139)
- `~/git/graphviz/lib/dotgen/mincross.c:581-660` (in_cross, out_cross,
  exchange, transpose_step)
- `../../mincross-2471-order-parity/decision-journal.md` (step-cap + dup findings)

## Acceptance criteria
- Given diagnosis, then `layer2-root-cause.md` names the exact function and the
  precise C-vs-TS behavioral difference, with a reproducible probe.
- Given the root cause, then a proposed faithful fix is written (function +
  change), scoped to the AD-5 write-set.
- Given completion, then all temp probes (TS + C) are reverted; `git -C
  ~/git/graphviz status --porcelain lib/dotgen` empty; TS tree clean.
- **STOP path:** if not localized in 2 rounds, the doc records what was ruled
  out + the next probe to try, and the tree is left reverted.

## Observability / Rollback
N/A — diagnostic only.

## Quality bar
Deliverable is the root-cause doc, not code. No production commit (probes
reverted). If it concludes STOP, that is a valid, documented outcome.
