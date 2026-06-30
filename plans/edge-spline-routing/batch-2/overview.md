<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 2 — Fix the localized divergence

The fix, written **after** S1 pins `#d-fixsite`. This overview and the T2 spec
are templates until then; S1 rewrites T2 with concrete content.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T2 | Correct the long-edge spline divergence at the site S1 localized; pin to instrumented C; TDD | sonnet | **TBD by S1** (one of `src/common/splines-routespl.ts`, `src/layout/dot/edge-route-chain.ts`, … + its `.test.ts` + maybe a golden) | S1 | [ ] |

Dependency: T2 cannot start until S1 fills `#d-fixsite` and rewrites
[T2-fix.md](./T2-fix.md).

Gate after batch: `tsc` clean; `vitest` green incl. new test; the reproducer's
diverging edge conforms to the oracle; spot-check ≥2 currently-matching edges
for zero byte change; `git diff --name-only main` ⊆ {S1 docs, T2 write-set}.
