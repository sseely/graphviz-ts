<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 1 — Unify into one edgecmp-ordered pass

**Blocked on Batch 0 GO (T0.3).** Sequential — T1.2 rewrites the shared dispatch;
each step re-runs the full survey to stay 0-regression. T1.3 is conditional.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1.1 | TDD goldens (red): flip `ldbxtried` golden to active + add a minimal repro (lone edge sharing a vnode with a later-`edgecmp` group); manifest entries (+count). Watch fail. | sonnet | `test/golden/inputs/*`, `test/golden/refs/*`, `test/golden/manifest.json`, `test/golden/suite.test.ts` (count) | T0.3 | [x] |
| T1.2 | Unify the pass (Option A): route each `edgecmp` group in `dotSplines_` in order — `cnt>1` → `routeParallelEdgeGroup`, `cnt==1` → `routeOneEdge` — and remove the separate `routeDotEdges` pass. Make goldens green; cnt==1 byte-stable where no shared-state interaction. | sonnet | `src/layout/dot/splines.ts`, `src/layout/dot/edge-route.ts` | T1.1 | [x] |
| T1.3 | Align `edge-order.ts:edgeRouteCmp` to C's order — ONLY if T0.3 implicates it | sonnet | `src/layout/dot/edge-order.ts` | T1.2 | [x] **N/A** (T0.3: port `edgecmp` is positional-exact to C; no comparator change) |

T1.3 is **conditional** — include only if T0.3's root cause names a comparator
divergence; otherwise mark `[x] N/A` in this table and the journal.

## Quality gates (after each task)
```
- command: npm run typecheck
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm test
  pass: exit 0  (repro + ldbxtried goldens pass; no previously-green golden fails)
  on_fail: fix_and_rerun
- command: npm run survey && npm run survey:gate
  pass: 0 regressions vs prior verdicts
  on_fail: stop   # shared-router/order regression — investigate vs fresh oracle
```

## Write-set conflict check
T1.1 = test artifacts only. T1.2 = splines.ts + edge-route.ts (one logical
dispatch change, one writer). T1.3 = edge-order.ts (disjoint). Sequential by
dependency.
