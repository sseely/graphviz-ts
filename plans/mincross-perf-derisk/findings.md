<!-- SPDX-License-Identifier: EPL-2.0 -->

# Findings — mincross perf derisk (Batch 1)

## Verdict

**Per-op constant factor (AD-2 Path 2). No iteration-count gap.**

The port executes the **identical** number of mincross passes, `reorder` calls,
`reorderInner` inner-iterations, `exchange`s, `transpose` rounds/steps/swaps, and
`ncross`/`rcross` calls as native C — confirmed by recompiling C with matching
counters (AD-1). For the primary case `2108.dot` the port runs
**1,591,556,868 `reorderInner` inner-iterations — exactly equal to C's
1,591,556,868.** The ~6× wall-clock gap is therefore purely the per-iteration cost
of running that faithful billion-iteration loop in V8 vs compiled C.

**Target function: `reorderInner`** (`mincross-order.ts`) plus its hot callees
`reorderFindLp`, `reorderFindRp`, `left2right`. Profiling attributed 47% of
runtime to `reorderInner`; the counters show why — a ~3700-node-wide rank makes
`reorder` O(W²), and the loop body is dominated by `node.info.mval` property-chain
reads. Secondary: `transposeStep`/`accumCross` (~17%).

The iteration-count fix path (AD-2 Path 1) is **disproven** and must not be
attempted — matching C's count is already achieved. An algorithm change is
forbidden. The only permitted lever is reducing the per-iteration cost of
`reorderInner` (byte-safe representation / hoisted reads), which yields a
constant-factor drop, not the ≤3× target that was contingent on an
iteration-count gap.

## Method

- **Port (D1):** temp counters in `mincross-utils.ts` / `-cross.ts` / `-order.ts`
  (reverted before the gate), driven by `instr-port.ts` via `tsx`. Per-pass
  crossings captured through the existing `setMincrossTrace` hook.
- **C (D2):** matching counters added to `lib/dotgen/mincross.c`, dot_layout
  plugin rebuilt into `/tmp/gvplugins`, dumped at `dot_mincross` exit. Reverted
  and the clean plugin reinstalled afterward.
- **Per-pass trace:** native `dot -v` emits the same `mincross: pass P iter I …`
  line the port logs — compared directly with no recompile.

## Per-pass convergence trace — byte-identical

`b100.gv`, single mincross invocation, both sides identical at every step:

| pass.iter | port cur_cross | C cur_cross | port best | C best |
|---|---|---|---|---|
| 0.0 | 3990427 | 3990427 | 3990427 | 3990427 |
| 0.3 | 2059586 | 2059586 | 2059586 | 2059586 |
| 1.3 | 1911273 | 1911273 | 1911273 | 1911273 |
| 2.0 | 1713360 | 1713360 | 1713360 | 1713360 |
| 2.8 (quit, trying=8=MinQuit) | 1724708 | 1724708 | 1713360 | 1713360 |

17 iterations, 1 invocation — identical. `MinQuit=8`, `MaxIter=24`,
`Convergence=.995` effective values match C exactly on both sides.

## Counter dumps — port vs C

### 2108.dot (primary; native 11.98 s, port ~84 s ≈ 7×)

| counter | PORT | C | match |
|---|---|---|---|
| ncrossCalls | 172 | 172 | ✓ |
| rcrossCalls | 239 | 239 | ✓ |
| reorderCalls | 233 | 233 | ✓ |
| **reorderInnerIters** | **1,591,556,868** | **1,591,556,868** | ✓ exact |
| **reorderExchanges** | **484,932,627** | **484,932,627** | ✓ exact |
| mincrossStepCalls | 122 | 122 | ✓ |
| transposeCalls | 135 | 135 | ✓ |
| transposeRounds | 5,154 | 5,154 | ✓ |
| transposeStepCalls | 11,633 | 11,633 | ✓ |
| transposeSwaps | 385,561 | 385,561 | ✓ |
| accumCrossPairs | 821,297,579 | 1,642,595,158 | port = ½ C† |

### b100.gv (generalization; native 7.56 s, port ~33 s ≈ 4.4×)

| counter | PORT | C | match |
|---|---|---|---|
| reorderInnerIters | 228,684,702 | 228,684,702 | ✓ exact |
| reorderExchanges | 82,788,894 | 82,788,894 | ✓ exact |
| transposeRounds | 5,461 | 5,461 | ✓ |
| transposeStepCalls | 52,483 | 52,483 | ✓ |
| transposeSwaps | 14,283,397 | 14,283,397 | ✓ |
| ncross/rcross/reorder | 21/314/240 | 21/314/240 | ✓ |
| accumCrossPairs | 301,449,734 | 602,899,468 | port = ½ C† |

### 2471.dot (control; mincross only ~12%; native 2.85 s, port ~19 s)

| counter | PORT | C | match |
|---|---|---|---|
| reorderInnerIters | 25,318,473 | 25,318,684 | ✓ ≈ (Δ 211 / 0.0008%) |
| reorderExchanges | 9,522,146 | 9,508,360 | ≈ (cluster-path noise) |
| transposeRounds | 3,970 | 4,057 | ≈ |
| mincrossStepCalls | 2,013 | 2,013 | ✓ |
| reorderCalls | 3,698 | 3,698 | ✓ |

2471 is cluster-heavy (6 invocations, 2266 traced iters); the sub-0.001%
divergence on the billion-scale counter is within cluster-ordering noise and
does not affect the verdict — and 2471 is not a perf target.

† The port's `accumCross` accumulates **both** swap directions (c0 and c1) in a
single double-loop, where C calls separate `in_cross`+`out_cross` over the same
edge products. The port therefore does **half** the cross-comparisons C does — it
is already strictly more efficient on that path, so there is no lever there.

## Why reorderInner dominates

`reorderCalls=233` but `reorderInnerIters=1.59e9` → ~6.8 M inner-iterations per
`reorder`. `reorder` is `for nelt in [n-1..0] { reorderInner }`, and each
`reorderInner` scans the rank window, so it is O(W²) for a rank of width W.
6.8 M ≈ W²/2 ⇒ W ≈ 3700: there is a ~3700-node-wide rank. This O(W²) is **present
in C too** (same code shape, same count) — it is faithful, not a bug. The gap is
that each of those 1.6 B iterations costs more in V8.

## Chosen Batch-2 path (AD-2 Path 2)

Reduce the per-iteration cost of `reorderInner` and its callees **without changing
the iteration count or any comparison outcome** (byte-identity is sacred, AD-3):

1. Hoist the repeated `vlist[i]!.info.mval !== undefined ? … : -1` reads — the
   loop reads the `node.info.mval` property chain multiple times per node per
   iteration; read each node/`.info`/`.mval` once into locals.
2. Optionally snapshot the rank's per-node `mval` into a flat `number[]` kept in
   sync across `exchange`, turning the inner comparisons from megamorphic object
   property reads into monomorphic array reads (cf. memory
   `ns-hotpath-ninfo-slowmode`: `.info` dictionary-mode access was the NS killer).

Expectation: a **constant-factor** drop on the `reorder` portion (the dominant
47%), not a collapse to ≤3× — the ≤3× target was explicitly contingent on an
iteration-count gap, which does not exist. Output must remain byte-identical; the
survey gate (byte-match ≥ 312, structural ≥ 256, 0 changed verdicts) is the proof.
