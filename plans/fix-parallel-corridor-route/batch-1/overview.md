<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 1 — Faithful per-edge corridor routing

**Blocked on Batch 0 GO (T0.3).** Sequential — these tasks share the router files
(one writer at a time); the exact split is refined by T0.3. The shared-router risk
(ADR-3) means each step re-runs the full survey to stay 0-regression.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1.1 | TDD goldens (red): add minimal repro + `ldbxtried` inputs/refs (headless oracle), manifest entries (+bump count). Watch fail. | sonnet | `test/golden/inputs/*`, `test/golden/refs/*`, `test/golden/manifest.json`, `test/golden/suite.test.ts` (count) | T0.3 | [x] |
| T1.2 | Resolve group representative to original edge (T0.3 root-cause, not offset-port): `baseSplineForGroup` resolveOrigEdge + `groupRealHead` clip. Goldens green; survey 0-regr +13 improvements. | sonnet→opus | `src/layout/dot/splines-route.ts` (`edge-route-faithful.ts` NOT needed) | T1.1 | [x] |
| T1.3 | Cross-rank straight path: `makeStraightEdges` route via corridor not dumb points (only if T0.3 implicates it) | sonnet | `src/layout/dot/straight-edges.ts`, `src/layout/dot/splines.ts` | T1.2 | [x] N/A — mechanism is not makeStraightEdges (T0.3) |
| T1.4 | Per-edge box/corridor construction (only if T0.3 implicates it) | sonnet | `src/layout/dot/edge-route-boxes.ts`, `src/layout/dot/edge-route-routing.ts` | T1.2 | [x] N/A — box/corridor builders correct (T0.3 probe) |

T1.3/T1.4 are **conditional** — include only if T0.3's root cause names them;
otherwise mark `[x] N/A` in this table and the journal. Their write-sets are
disjoint from each other so, if both needed, they may run back-to-back but each
re-runs the survey.

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
  on_fail: stop   # shared-router regression — investigate vs fresh oracle
```

## Write-set conflict check
T1.1 = test artifacts only. T1.2 = splines-route + edge-route-faithful. T1.3 =
straight-edges + splines. T1.4 = edge-route-boxes + edge-route-routing. No two
tasks write the same file. Sequential by dependency.
