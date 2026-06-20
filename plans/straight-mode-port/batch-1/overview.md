<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — helper + safe no-op refactor

Two independent tasks (different files), runnable in parallel. Both are
prerequisites for the behavioral change in T2b (batch-2).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Port `straightPath`; regression-pin `straightLen` | implementation | `src/layout/dot/splines-route.ts`, `src/layout/dot/splines-route.test.ts` | — | [x] |
| T2a | Refactor chain routing into `routeChainSegmented` (single-segment, byte-identical) | implementation | `src/layout/dot/edge-route-chain.ts` | — | [x] |

T1 and T2a touch different files → no write conflict. Execute solo per
`parallelism.md` (delicate port; default single-agent).

Gate after batch: `npx vitest run` (2000 pass), `npx tsc --noEmit` clean, and
for T2a a **byte-identical** parity check vs baseline (no verdict changes at all).

- [T1](T1-straight-path.md)
- [T2a](T2a-route-chain-segmented.md)
