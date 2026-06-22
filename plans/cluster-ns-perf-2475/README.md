<!-- SPDX-License-Identifier: EPL-2.0 -->
# Follow-up: network-simplex perf hang on many-cluster graphs (2475_2)

## Type: perf (known-hard, deferred)

Created 2026-06-22 while fixing the anonymous-subgraph parser collision
(`feat(parser): unique names for anonymous subgraphs`). That fix is correct —
it preserves all sibling anonymous subgraphs (cgraph `%N` naming) instead of
collapsing them to one — but it exposed a pre-existing port perf hang.

## Symptom
`2475_2.dot` (24,592 lines, hundreds of anonymous `subgraph {cluster=true}`
blocks) went **diverged → timeout** in the parity survey after the parser fix.
Before the fix the port saw ~1 cluster (the colliding name dropped the rest) and
rendered fast-but-wrong; now it sees all the clusters and the layout does not
finish in the 20s survey window (>90s, effectively a hang). Native dot renders
it fine, so this is a port-side performance gap, accepted as a tracked
regression (user decision 2026-06-22 — the prior output was already wrong).

## Root area (profiled)
`node --prof` on the port render: ~58% of JS time in `nsUpdate` ← `rank2`
(network simplex, `src/layout/dot/ns.ts` / `ns-core.ts`). The network simplex
does not converge quickly with hundreds of clusters. Same class as the **2471
cluster-ranking** saga (see memory `2471-blocker-is-cluster-ranking`): correct
cluster order makes the x-coord / rank network simplex non-converge.

## Next steps (when picked up)
1. Confirm hang vs slow: does it ever finish? Bound iterations and measure.
2. Compare the port's `rank2`/`nsUpdate` iteration count + balance pass against
   native dot's `rank(g, 2, nsiter2(g))` on 2475_2 — is the port missing the
   `nslimit`/`nsiter2` iteration cap, or is its pivot selection pathological?
3. Likely shares a fix with the 2471 ns non-convergence. Pin to C with the
   `maxphase` phase-isolation trick.

## Status
| Phase | Status |
|-------|--------|
| Identify hot path | [x] nsUpdate/rank2 (network simplex), >90s on 2475_2 |
| Root-cause ns non-convergence with many clusters | [ ] |
| Fix | [ ] |
