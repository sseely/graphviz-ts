<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — straight-mode segmentation (the behavioral change)

One task. This is the heavy, risky core; kept whole because a half-applied smode
loop cannot be committed working.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2b | Add straight-mode branch to `routeChainSegmented` | implementation | `src/layout/dot/edge-route-chain.ts`, `src/layout/dot/edge-route-chain.straight.test.ts` | T1, T2a | [ ] |

Gate after batch: L5 byte-matches oracle; L3/L4 unchanged; `npx vitest run`
(all pass); `npx tsc --noEmit` clean; parity per-id deltas show 0 regressions.

- [T2b](T2b-straight-mode.md)
