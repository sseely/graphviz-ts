# Decision Journal — dot-edgetype

| Time | Task | Decision | Rationale |
|------|------|----------|-----------|
| plan | — | Execution plan: Batch 1 sequential (T1→T2→T3→T4); routers share files so no parallelism. | parallelism.md autonomous-mode: log plan, proceed. |
| T2 | computeSpline decline path | `computeSpline` (pathplan fitter) is UNREACHABLE for regular `splines=line/polyline` edges. | Throw-instrumented `computeSpline`, rendered 5-case corpus (line/poly × adjacent/multi/labeled) — none threw. Confirms DOT-1b retired the regular fitter; T3 need not touch `edge-route-poly.ts`. |
| T2 | wiring verified | Multi-rank `a->c` diverges by type: SPLINE curves, PLINE emits collinear straight segments, LINE collapses to a vertical 4-pt line; default SPLINE byte-identical (1847 pass, 115 goldens). | Box-straighten already yields a straight multi-rank LINE; T3 reconciles port-to-port endpoints vs C `makeLineEdge` against the oracle. |
