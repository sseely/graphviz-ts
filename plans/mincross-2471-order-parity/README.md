# Mission: 2471 mincross order parity (byte-identical to C)

## Objective

Make `tests/2471.dot`'s **final mincross node order byte-identical to C**. The
transpose hang is already closed (`mincross-transpose-perf`, merged), so 2471
now completes — and that newly-visible output reveals a residual within-rank
order divergence from C. This is the next onion layer: rank → mincross order
(this) → x-coord under clusters → splines.

## Carried-in findings (from mincross-transpose-perf, do not re-derive)

- **Hang fixed**, parity preserved everywhere verifiable: tsc 0; vitest 1874,
  zero golden churn; order==C on mc3, chain_24 (TB **and** RL), and a
  record-port + RL + cluster repro. A permanent RL+cluster order regression
  guards it (`src/layout/dot/mincross-cluster-order.test.ts`).
- **The divergence:** per-rank C↔TS name dump on 2471 differs on ~10/23 ranks —
  specifically the **even (real-node) ranks** r2..r20. Same node *sets* per
  rank, different within-rank **order**. So ranking is correct; mincross
  ordering diverges.
- **NOT caused by the transpose-perf fixes** — every controlled reproducer is
  byte-identical to C and golden churn is zero. The divergence needs 2471's full
  structure (it does not reproduce in small RL/cluster/port graphs).
- **NOT the crossing tiebreak.** C's `in_cross`/`out_cross` (mincross.c:581-614)
  tiebreak on `port.p.x`; TS `accumCross` uses `val()` (`port.order`). Swapping
  TS to `port.p.x` *changed* the divergence without fixing it (and is a no-op on
  the early/root passes) → reverted, not the cause. (Still a latent faithfulness
  gap worth a separate look, but not this bug.)
- **Separate bug, out of scope:** disconnected-component **packing**. A repro
  with a disconnected `cluster_2` placed it *overlapping* `cluster_0` in TS
  (identical y), while C stacks components. That is x-coord/packing, not mincross
  order — log it, don't chase it here.

## Where to look (hypotheses, unverified)

The 2471-specific triggers absent from the matching repros: **back-edges**
(2471 has many; "lost edge" warnings), **flat edges / `do_ordering`**, **nested
clusters** (246, some nested), **label/virtual-node ordering at scale**. Likely
suspects: `mincross-flat.ts` (flat reorder), `mincross-order.ts`
(medians/reorder/`flatMval`), `mincross-build.ts` (`do_ordering`, install order),
cluster recursion order in `mincross.ts`. Bisect by constructing the smallest
2471 subgraph that still diverges (start from a single divergent even rank's
nodes + their edges).

## Success predicate

1. 2471 final per-rank order **byte-identical to C** (name dump diff == 0).
2. Zero golden churn; order==C preserved on all prior reproducers.
3. tsc 0; vitest all pass.

## Harness (proven)

- C oracle + per-rank dump: instrument `dot_mincross` end (mincross.c) to print
  `r<rank>: name…` (virtuals `_v`) under an env gate; rebuild
  `gvplugin_dot_layout`, copy **all three** dylib names to `/tmp/gvplugins`;
  `CDUMP=1 GVBINDIR=/tmp/gvplugins dot -Tsvg`. REVERT C after.
- TS dump: gate a per-rank dump at the end of `dotMincross` on a global; drive
  via the esbuild bundle (`npm run build`) + a node import of `renderSvg`.
- Diff the two `r…:` blocks. mc3 sanity-matches; use the same on the bisected
  subgraph.
- 2471 TS run ≈ 45-49s — usable but not a tight loop; bisect to a small repro
  before iterating on a fix.

## Constraints

Parity is the cardinal invariant (match C exactly; any churn must equal C).
Same STOP rules as the parent mission: stop if a fix alters output on a passing
reproducer, needs an unowned file, or the same site changes 3× without closing
the diff.

## Status

- [ ] Batch 1 — isolate a minimal divergent subgraph from 2471; identify the
  divergent pass/function with the dump harness.
- [ ] Batch 2 — apply the C-faithful fix; verify 2471 order==C + zero churn.

## Related

- Parent mission: `plans/mincross-transpose-perf/` (decision-journal T1-T4).
- Memory: `2471-blocker-is-cluster-ranking` (now: hang fixed; order divergence
  is the new blocker).
