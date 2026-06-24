<!-- SPDX-License-Identifier: EPL-2.0 -->

# Comparison — mincross per-op optimization (2108 + mincross-bound corpus)

## Outcome

**Rescued partially: a per-op constant-factor speedup, byte-identical output.**
The mission diagnosed the 2108 slowdown as a **per-op constant factor** (the port
runs the *identical* 1.59 billion `reorderInner` iterations as native C — see
`../findings.md`), not an iteration-count gap. The fix therefore optimizes the
per-iteration cost of the reorder hot loop without changing the iteration count
or any comparison outcome. Result: 2108 still exceeds the 20 s survey budget
(it is fundamentally an O(W²) reorder over a ~3700-node-wide rank, faithful to C),
but every mincross-bound case is meaningfully faster and **no SVG byte changed**.

## The fix (X1)

`src/layout/dot/mincross-order.ts` — `reorderFindLp`, `reorderFindRp`,
`reorderInner` (the 47%-of-runtime hot path):

1. **Read-once (CSE):** each `node.info.mval` was read twice per node per
   iteration via the `mval !== undefined ? mval : -1` ternary; now read once into
   a local. Same `(mval ?? -1)` semantics, half the property-chain loads.
2. **Hoist loop-invariant:** `vlist[lp]` is constant across the `rp` scan in
   `reorderFindRp`; hoisted out of the inner loop (`left2right` was re-loading it
   each step).
3. **Allocation-free result:** `reorderFindRp` returned a fresh `{rp,muststay}`
   object every call — ~1.6e9 short-lived allocations on 2108. Now returns a
   reused module-scope scratch object (consumed synchronously by the single
   caller before the next call). Removes the GC churn.

Iteration count, comparison outcomes, and side-effect order are unchanged — this
is representation/per-op only (decisions.md AD-2 Path 2, AD-3).

Test lock: `src/layout/dot/mincross-reorder-perf.test.ts` pins the
`(mval ?? -1)` undefined/zero/negative boundaries and the shared-scratch safety
(consecutive calls do not alias).

## Timings (production bundle, best of 2 runs)

Native `dot` (oracle, GVBINDIR=/tmp/gvplugins): 2108 = 11.98 s, b100 = 7.56 s.

| case | before | after | drop |
|---|---|---|---|
| 2108.dot (primary) | 83.6 s | 72.3 s | −13.6% |
| b100.gv | 37.7 s | 30.1 s | −20.1% |
| 1718.dot | 30.6 s | 24.6 s | −19.8% |
| b104.gv | 33.2 s | 29.9 s | −10.0% |

`svg_bytes` identical before vs after on all four (22,127,966 / 3,309,381 /
373,815 / 3,309,381). 2108 single-run variance is high (±10 s on an 80 s render);
best-of-2 reported.

## Why not ≤3× native

The ≤3× / under-20 s target was explicitly **contingent on an iteration-count
gap** (README success bar). The diagnosis disproved that gap: the port already
matches C's pass count and crossing values exactly. The remaining gap is V8
per-op cost on a faithful billion-iteration loop; the only further lever would be
an **algorithm change**, which is forbidden (CLAUDE.md: the C source is the spec;
README STOP condition). So the achievable win is a constant factor, delivered.

## Parity gate (X2)

Full corpus survey (796 inputs) vs `parity-baseline.json`:

- byte-match: **312 → 312** (floor 312 ✓)
- structural-match: **256 → 256** (floor 256 ✓)
- changed per-id verdicts: **0** (required 0 ✓)
- **Result: GATE PASS** — output byte-identical corpus-wide.

Primary-case proof: 2108 is a survey timeout (not byte-compared there), so a
direct before/after self-diff (stash the fix, re-render, `cmp`) confirms the
2108 SVG is byte-identical: **2108-before.svg == 2108-after.svg** (22,127,966
bytes). Combined with `svg_bytes` parity on b100/1718/b104 and 0/796 verdict
changes, byte-identity (AD-3) is established.

Quality gates: `npm run typecheck` exit 0; `npm test` 2334 passed (176 files,
+5 new in `mincross-reorder-perf.test.ts`); `npm run build:js` exit 0.
