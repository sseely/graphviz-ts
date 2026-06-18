# Architecture Decisions — mincross-transpose-perf

## AD-1: parity is the cardinal invariant

**Context:** A perf change to the ordering hot path can silently alter the final
node order; downstream x-coord/spline consumers would then diverge, far costlier
to trace from 2471 than to catch here.

**Decision:** Output node order must stay **byte-identical to C**. Verified three
ways: (1) existing golden suite with **zero churn**; (2) a *new permanent*
deterministic order-signature regression on a mid-size cluster graph; (3) a
one-time both-sides order-probe vs the C oracle in Batch 1. A value-changing
"optimization" is wrong by definition.

**Consequences:** "Faster" only counts if order is unchanged. Any golden churn
whose new value ≠ C is a STOP.

## AD-2: write-set (widened, pre-authorized)

**Context:** The hot path spans the transpose loop, the crossing-count helpers,
and the node-access helpers it calls; the cause is unknown until Batch 1.

**Decision:** Write-set = `mincross-cross.ts`, `mincross-order.ts`,
`mincross-utils.ts`, `fastgr.ts` (node-access helpers) + their `*.test.ts`.
No other source file without re-planning.

**Consequences:** Bounded candidate set; no mid-stream re-confirmation for these.

## AD-3: measure-then-route

**Context:** A perf fix applied before diagnosis risks optimizing the wrong
thing.

**Decision:** Batch 1 (T1) measures and writes a routing decision to the journal
naming the dominant cost **with numbers** and the exact target site. Batch 2
applies **only** the routed fix.

**Consequences:** Batch 2's content is determined by Batch 1, not pre-guessed.

## AD-4: the three-way fork Batch 1 must resolve

**Context:** 98% of time is in `transposeStep`, inside a single `transpose()`
call that runs >90s. Per-swap scope already matches C (local `transposeCounts`;
incremental `ncross`).

**Decision:** Classify the dominant cause as one of:
- **(a) pass-count** — `transpose`'s `do…while(delta>=1)` runs far more passes
  than C (candidate-pruning or delta-accounting divergence).
- **(b) non-convergence** — a single `transpose()` never terminates (delta
  oscillates ≥1); correctness-adjacent, not "slow".
- **(c) constant-factor** — per-pair `[0,0]` alloc in `transposeCounts`,
  `new Array(nextN+1)` per `rcross`, megamorphic `info.x ?? 0` in the hot loop.

**Consequences:** (a)/(b) route to "match C's loop exactly"; (c) routes to
"mirror C's reused buffers / hoist access". The 90s-in-one-call shape makes
(a)/(b) prime.

## AD-5: parity-preserving means "match C", not "improve on C"

**Context:** C's order is the oracle; the goal is C's speed *and* C's output.

**Decision:** For (a)/(b), mirror C's `transpose`/`transpose_step` candidate +
delta logic exactly. For (c), mirror C's reused `TI_list`/`Count` buffers and
hoist repeated `ND_*` access into locals. No change may alter a computed
crossing value or a swap decision.

**Consequences:** Optimizations are mechanical equivalences, trivially parity-safe.

## AD-6: benchmark graph

**Context:** 2471 hangs, so it cannot be the measurement loop; need a graph that
completes in both C and TS yet exposes the gap and its growth curve.

**Decision:** Use a synthetic **scalable cluster-chain** (parametric N clusters,
the mc3 shape grown) to measure the growth curve, plus one real corpus graph for
realism. Pick the largest that completes in TS within a sane wall-clock.

**Consequences:** Repeatable, size-tunable measurement independent of 2471.

## AD-7: rollback

Reversible — revert the merge. Internal perf only; no data model, API contract,
schema, or output change (AD-1). No staged rollout needed.
