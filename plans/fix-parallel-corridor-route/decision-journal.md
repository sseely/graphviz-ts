<!-- SPDX-License-Identifier: EPL-2.0 -->

# Decision journal

Appended during execution. One row per non-trivial judgment call. T0.3 must
record the GO/STOP decision and the confirmed Batch-1 write-set here before any
`src/` edit.

| Date | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-25 | T0.1 | Refine ADR-3: C does NOT route per-edge from offset ports | Instrumented C `make_regular_edge`/`routesplines_`: C routes the cnt-group ONCE through the rank-box corridor from un-offset node ports, then shifts only interior points for copies (endpoints fixed). The "per-edge offset endpoints" framing was inaccurate (also disproven for NaN). Nodes are byte-identical → pure routing divergence. |
| 2026-06-25 | T0.3 | **GO** — fix contained to `baseSplineForGroup` (`splines-route.ts`) | Root cause: parallel/opposing group routes its base from the unresolved first virtual segment (`edges[0]`, head=vnode); `routeRegularEdgeFaithful` accepts the adjacent-looking segment and short-circuits the multi-rank chain router → 4-pt straight base to the vnode instead of the corridor route to the real head. Probe: `routeMultiRankEdgeFaithful(resolveOrigEdge(edges[0]))` yields 7pts(repro)/10pts(ldbxtried) matching C. No `src/pathplan/` change. |
| 2026-06-25 | T0.3 | Confirmed Batch-1 write-set; T1.3/T1.4 → N/A | Fix = resolve the representative to its original in `baseSplineForGroup` before routing. T1.1 (goldens) needed; T1.2 writes `src/layout/dot/splines-route.ts` (and `edge-route-faithful.ts` only if a guard refinement proves necessary). `straight-edges.ts` (T1.3) and box builders (T1.4) are correct/unaffected → mark N/A. Residual ADR-3 shared-router risk → 0-regression survey gate. |
| 2026-06-25 | T1.2 | Fix landed in `splines-route.ts` (`baseSplineForGroup` resolveOrigEdge + `groupRealHead` clip); `edge-route-faithful.ts` NOT needed | `routeRegularEdgeFaithful` already declines on the resolved original; only the dispatch resolution + the head-clip target needed changing. min-repro `a->b` ×3 and ldbxtried `n0->n2` ×3 now route the corridor (byte-exact / structural ~1px). |
| 2026-06-25 | T1.2 | OBSERVED shared-state side effect: lone `n0->n1` regressed (corridor→straight) | Routing the n0->n2 group via the chain router now calls `recoverSlack`, mutating shared chain vnode coords; the lone multi-rank `n0->n1` (routed later) is perturbed. ADR-3 risk realized. Survey is the arbiter of whether this is a net verdict regression; investigate if survey:gate fails. Goldens held pending survey. |
