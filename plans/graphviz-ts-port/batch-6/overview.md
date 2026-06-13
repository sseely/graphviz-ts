# Batch 6 — GVC Orchestration

## Summary

Batch 6 ports `lib/gvc/` — the central orchestration layer that ties together
the plugin registry, per-job render state, and the output device loop. Three
tasks cover the three separable concerns: context + registry (T25), job
lifecycle + text-layout selection (T26), and the device render loop (T27).

T25 must land first because T26 and T27 both import from `src/gvc/context.ts`.
Once T25 is committed, T26 and T27 have no write-set overlap and run in
parallel.

This batch does not implement any renderer; it implements the infrastructure
that renderer tasks in Batch 7 plug into.

## Dependencies

Batch 6 requires Batch 5c (Common Layer — Splines & Emit) to be complete.
`src/gvc/context.ts` imports `Graph`, `Node`, `Edge` from `src/model/`,
`LayoutEngine` from `src/layout/`, `TextMeasurer` from `src/common/text.ts`,
and `RendererPlugin` is defined here for the first time.

## Task Table

| ID | Description | ‖/→ | Writes | Depends On |
|----|-------------|-----|--------|------------|
| T25 | GVC context and engine registry | → | src/gvc/context.ts, src/gvc/context.test.ts | Batch 5c | [x] |
| T26 | Text layout selection + job lifecycle | ‖ after T25 | src/gvc/job.ts, src/gvc/textlayout.ts, src/gvc/job.test.ts | T25 | [x] |
| T27 | SVG device infrastructure | ‖ after T25 | src/gvc/device.ts, src/gvc/device.test.ts | T25 | [x] |
