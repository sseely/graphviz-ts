# Decision Journal — dot-edgetype

| Time | Task | Decision | Rationale |
|------|------|----------|-----------|
| plan | — | Execution plan: Batch 1 sequential (T1→T2→T3→T4); routers share files so no parallelism. | parallelism.md autonomous-mode: log plan, proceed. |
| T2 | computeSpline decline path | `computeSpline` (pathplan fitter) is UNREACHABLE for regular `splines=line/polyline` edges. | Throw-instrumented `computeSpline`, rendered 5-case corpus (line/poly × adjacent/multi/labeled) — none threw. Confirms DOT-1b retired the regular fitter; T3 need not touch `edge-route-poly.ts`. |
| T2 | wiring verified | Multi-rank `a->c` diverges by type: SPLINE curves, PLINE emits collinear straight segments, LINE collapses to a vertical 4-pt line; default SPLINE byte-identical (1847 pass, 115 goldens). | Box-straighten already yields a straight multi-rank LINE; T3 reconciles port-to-port endpoints vs C `makeLineEdge` against the oracle. |
| T3 | makeLineEdge byte-exact | Multi-rank LINE now **byte-identical** to dot 15.0.0: TB a->c, TB deep a->d, LR a->c all match exactly (box-straighten was ~0.2pt off; makeLineEdge center+port endpoints are exact). | Confirms AD-2 — porting makeLineEdge, not relying on box-straighten, was correct. |
| T3 | back-edge LINE scope | makeLineEdge dispatched on the forward multi-rank path only; multi-rank back-edge LINE uses the box-straighten (still straight). | Forward path is the common case; T4 pins/quarantines back-edge LINE if it diverges. |
| T3 | labeled delr==2 | `a->c[label=x]` over a->b->c (delr=2 + EDGE_LABEL) declines makeLineEdge per C guard → box path. 7-pt label branch needs delr>=3 + label; T4 exercises it. | Faithful to dotsplines.c:1650. |
