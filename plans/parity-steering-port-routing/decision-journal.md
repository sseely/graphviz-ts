# Decision Journal — steering-port routing

Append-only. One row per non-trivial judgment call.

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| — | 2026-06-14 | Mission authored from the parity-edge-ports T6b post-mortem while context was warm. Core reframing: the faithful `routesplines` pipeline is ALREADY ported (`splines-routespl.ts`, `splines-path-begin/end.ts`, `splines-clip.ts`, `pathplan/route.ts`+`shortest.ts`) and proven via neato/pack/ortho — dot just bypasses it. So this is an INTEGRATION mission, not a from-scratch port. Batch 1 is a recon spike (SR1) because the dot orchestrator landscape (`routeOneEdge` vs `makeRegularEdge` vs `splines-flat.ts`) and the `beginPath` input contract need verification before task-level detail in batches 2–4 can be trusted. | Avoids over-specifying tasks against an unverified integration seam; de-risks the high-blast-radius core-router change. | Batches 2–4 task files are overview-level pending SR1; SR1 finalizes them. |
| — | 2026-06-14 | BASELINE NOT YET CAPTURED. First execution step: record real `npx vitest run` passed-count and golden count here before any change (do not trust README numbers). | Mission planned before branch cut. | Capture at SR1 start. |
