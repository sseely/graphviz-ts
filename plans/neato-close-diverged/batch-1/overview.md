<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 1 — B1 packing / lone-node placement (the lever)

Single blocking task. The confirmed B1 root cause (disconnected-component
packing placing a lone node 11pt off) drives the 44-item graph-fill bucket and
cascades into B2/B4/B5. Must land and be re-swept before any residual triage.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Fix disconnected-component packing / lone-node placement | debugger (self, no worktree) | `src/layout/pack/poly-pack.ts`, `src/layout/pack/array-pack.ts`, `src/layout/neato/index.ts`, `src/layout/neato/init.ts` (only if sizing is the cause) | — | [x] |

**Result (2026-07-20):** root cause = neato component packing ran `packGraphs`
with `doSplines` clobbered to `false` by `getPackInfo`, and `poly-place.ts`
`fillEdge` had only a straight-line branch — so self-loop/curve spline bulges
were undercounted, packing the lone component one grid step (11pt) too close.
Fixed in `src/layout/pack/poly-place.ts` (ported spline-following branch) +
`src/layout/neato/index.ts` (`pinfo.doSplines=true` after `getPackInfo`, C
order). neato 95→90 diverged, 5 fixed, 0 regressions across neato + dot + circo
+ twopi + osage + patchwork. Second cause `2609`/`2258`/`2556` (overlap=false
single-component under-scale, in `overlap.ts`, outside write-set) flagged for T2.
`init.ts` NOT touched (sizing was not the cause).

Runs in the mission branch directly (not a worktree) — it is the sole task in
its batch and every later batch depends on its committed result.
