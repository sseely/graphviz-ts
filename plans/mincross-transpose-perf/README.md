# Mission: mincross transpose performance (C-parity, parity-preserving)

## Objective

Close the mincross **transpose** performance gap that blocks `tests/2471.dot`.
After the cluster-mincross fix (`mincross-clust-c-parity`, merged), 2471's
ordering is correct but it still does not complete: a single `transpose()` call
runs for >90s (V8 `--prof`: 98% in `transposeStep`→`transpose`→`mincrossStep`),
while native C renders all of 2471 in 2.78s. The fix must make 2471 complete
**without changing output** — every change is parity-preserving (byte-identical
to C) or it is wrong.

This is a prerequisite, not just next-in-sequence: x-coord assignment consumes
the final mincross order, so x-coord can never be validated on 2471 until 2471
completes mincross. Closing this unblocks the one graph that matters most.

## Onion context

Pipeline layers peeled in order: rank → mincross (order, DONE) → **mincross
perf** (this) → x-coord under clusters (next) → splines. Descending in order is
the signal each fix is final, not masking.

## The suspect (carried in, to confirm — not assume)

The per-swap crossing scope **already matches C**: `transposeStep` computes a
local `in_cross+out_cross` delta via `transposeCounts(v,w)` (not a global
`ncross`), and `ncross` is incremental via the `rk.valid` cache. So the "global
recompute per swap" theory is pre-refuted at code level. Batch 1 measures which
of three causes dominates (AD-4): **(a) pass-count**, **(b) non-convergence**,
**(c) constant-factor**. The >90s-in-one-call profile makes (a)/(b) prime.

## Success predicate (AD-1 + AD-4)

1. `tests/2471.dot` renders to completion in TS.
2. Output node order is **byte-identical to C** on every reproducer (oracle
   order-probe + zero golden churn) — the cardinal invariant.
3. A mid-size benchmark graph shows a large transpose speedup vs the pre-fix
   bundle.

## Branch / merge

- Branch: `feature/mincross-transpose-perf` (off `main`).
- Merge to `main` with a **merge commit** (preserves per-task commit IDs).

## Constraints

**STOP when:** any change alters output order on a reproducer, or churns a golden
whose new value ≠ C (parity broken — the cardinal sin); the fix needs a file
outside the write-set; Batch 1 shows the stall requires changing swap
**legality/order** (behavior change — re-plan); the routed fix does not move the
2471 needle (re-plan, don't pile on); the same hot-loop site changed 3× without
closing the gap; 2 consecutive gate failures.

**PUSH FORWARD when:** buffer-reuse / per-call-allocation removal that provably
preserves values; mechanical hot-loop access caching (hoisting `info.x` into a
local) that preserves values; benchmark-graph sizing choices.

## Quality gates

- `npx tsc --noEmit` → 0
- `npx vitest run` → all pass; **zero golden churn** (any churned golden's
  TS must equal C, or STOP)
- Order parity: oracle order-probe diff == C on mc3 + the mid-size benchmark
- Hook limits: 30 lines/fn, CCN 10, 5 params, 500/file
- `git diff --name-only` ⊆ write-set + any regenerated goldens

## Baseline (2026-06-17, main): tsc 0, vitest 1873. 2471 mincross does NOT
complete (>90s in one `transpose()` call; HEAD~1 identical → pre-existing).

## Batches

| Batch | Focus | Status |
|-------|-------|--------|
| 1 | Diagnose + route: measure pass-count vs non-convergence vs constant-factor (T1) | [x] |
| 2 | Apply the routed parity-preserving fix (T2) + conditional 2nd axis (T3) | [x] |
| 3 | Validate: 2471 completes, order == C, permanent regression + perf smoke (T4) | [~] partial — see below |

## Status after Batch 2 — hang CLOSED; 2471 has a residual order divergence

Write-set widening was **authorized**. Both fixes applied + committed:

- T2 `mincross-build.ts:buildRanksFlip` — reverse via C's `exchange()`.
- T3 `cluster.ts:mergeRanksInstall` — alias root array + `vStart` (not `.slice`).

**Achieved:** the transpose hang is closed — 2471 completes in TS (~49s; C
3.06s; was infinite). tsc 0; vitest **1873 pass, zero golden churn**. Order ==
C (per-rank name dump) on mc3, chain_24 (TB), chain_24_rl (RL), port_rl.

**Not yet met (cardinal invariant on 2471):** 2471's within-rank order differs
from C on ~10/23 (even, real-node) ranks — same node sets, different order. This
is **not** caused by these fixes (all controlled reproducers match C; zero
churn) and **not** the crossing tiebreak. It is a distinct, pre-existing
mincross-ORDER divergence, visible only now that 2471 completes (the prior
order-parity mission could never see it — 2471 hung). It needs 2471's full
structure to reproduce (back-edges / flat edges / nested clusters / scale).

**Decision pending** (see decision-journal T4): merge T2/T3 + open a follow-up
mission for 2471 order parity, vs. keep investigating here.

## Harness

- C oracle: `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -v FILE`.
  To instrument C: edit `lib/dotgen/mincross.c`, rebuild `dotgen` +
  `gvplugin_dot_layout`, copy **all three** `.dylib` names to `/tmp/gvplugins`
  (`.8`/plain are real copies, not symlinks — copying only `.8.0.12` loads a
  stale plugin), REVERT the C source after (it is sacred).
- TS perf: esbuild bundle (`npm run build`) + `node --prof` (per the project's
  hang-diagnosis recipe); `setMincrossTrace` is exported from mincross-order.ts.
- Reproducers: `mc3` (below), the 6-cluster chain (`/tmp/ab_clusters_tb.dot`),
  a synthetic scalable cluster-chain (parametric N), `tests/2471.dot`.

```
digraph { node [shape=rectangle];
  subgraph cluster_0 { a0;a1;a2;a3; a0->a1; a1->a2; a2->a3; }
  subgraph cluster_1 { b0;b1;b2;b3; b0->b1; b1->b2; b2->b3; }
  subgraph cluster_2 { c0;c1;c2;c3; c0->c1; c1->c2; c2->c3; }
  a3->b0; a0->b3; b3->c0; b0->c3;
}
```

## Index

- [decisions.md](decisions.md)
- [batch-1/overview.md](batch-1/overview.md) · [batch-2/overview.md](batch-2/overview.md) · [batch-3/overview.md](batch-3/overview.md)
- [diagrams/component-map.md](diagrams/component-map.md) · [diagrams/data-flow.md](diagrams/data-flow.md)
- [decision-journal.md](decision-journal.md)

## Related memory

`2471-blocker-is-cluster-ranking` (project memory) — prior two fixes + harness
recipe; this mission is its named follow-up.
