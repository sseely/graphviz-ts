# Decision Journal — dot-edgetype

| Time | Task | Decision | Rationale |
|------|------|----------|-----------|
| plan | — | Execution plan: Batch 1 sequential (T1→T2→T3→T4); routers share files so no parallelism. | parallelism.md autonomous-mode: log plan, proceed. |
| T2 | computeSpline decline path | `computeSpline` (pathplan fitter) is UNREACHABLE for regular `splines=line/polyline` edges. | Throw-instrumented `computeSpline`, rendered 5-case corpus (line/poly × adjacent/multi/labeled) — none threw. Confirms DOT-1b retired the regular fitter; T3 need not touch `edge-route-poly.ts`. |
| T2 | wiring verified | Multi-rank `a->c` diverges by type: SPLINE curves, PLINE emits collinear straight segments, LINE collapses to a vertical 4-pt line; default SPLINE conformant (1847 pass, 115 goldens). | Box-straighten already yields a straight multi-rank LINE; T3 reconciles port-to-port endpoints vs C `makeLineEdge` against the oracle. |
| T3 | makeLineEdge conformant | Multi-rank LINE now **conformant** to dot 15.0.0: TB a->c, TB deep a->d, LR a->c all match exactly (box-straighten was ~0.2pt off; makeLineEdge center+port endpoints are exact). | Confirms AD-2 — porting makeLineEdge, not relying on box-straighten, was correct. |
| T3 | back-edge LINE scope | makeLineEdge dispatched on the forward multi-rank path only; multi-rank back-edge LINE uses the box-straighten (still straight). | Forward path is the common case; T4 pins/quarantines back-edge LINE if it diverges. |
| T3 | labeled delr==2 | `a->c[label=x]` over a->b->c (delr=2 + EDGE_LABEL) declines makeLineEdge per C guard → box path. 7-pt label branch needs delr>=3 + label; T4 exercises it. | Faithful to dotsplines.c:1650. |
| T4 | all cases conformant | All 5 corpus cases (PLINE/LINE × adjacent/multi-rank + 7-pt labeled `a->d[label=x]` over a 3-rank chain) are conformant to dot 15.0.0. **Zero quarantines** → no comparison pages required. | Pinned with AD-3 tolerances (LINE 0.06pt, PLINE 0.5pt); margins are 0. |

## Mission Summary (2026-06-17)

**Status: COMPLETE.** DOT-7 closed — regular (cross-rank) edges honor
`edgeType(g)`. `splines=line` and `splines=polyline` now produce straight /
polyline regular edges matching dot 15.0.0.

**Tasks: 4/4 complete** (T1, T2, T3, T4), one commit each.

**Result:** all 5 oracle cases conformant to dot 15.0.0 — PLINE adjacent +
multi-rank (via the already-ported `routePolylines`), LINE adjacent (box
straighten), LINE multi-rank + labeled (via the newly-ported `makeLineEdge`).

**Final gates:** `tsc --noEmit` 0; lizard clean on all changed files; vitest
**1852 passed / 0 failed**; 122 golden tests (115 goldens conformant —
the default `EDGETYPE_SPLINE` path is an unchanged pass-through).

**Quarantines:** none.

**Follow-ups (out of scope):** DOT-8 (`splines=ortho`/`curved`/`compound` —
ortho needs `lib/ortho`); multi-rank back-edge LINE uses the box-straighten
(still straight) rather than makeLineEdge — pin if a divergence is reported.
