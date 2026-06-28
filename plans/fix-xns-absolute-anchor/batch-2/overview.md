# Batch 2 — Degenerate labeled-flat wiring

Only after Batch 1: the port's internal x-frame now matches C, so spline-less
edge labels land where C's do. Wire the three coupled changes that make C draw
(or suppress) a degenerate labeled flat leg by its label's clip overlap.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T6 | map_edge already skips no-spline labels (verify); make_flat_labeled handled-on-degenerate; drop routeLoneEdge skip + corridor label-guard; edge_in_box emit gate | debugger | `src/layout/dot/splines-flat-labeled.ts`, `src/layout/dot/edge-route.ts`, `src/render/svg.ts` | Batch 1 | [ ] |

Single task (three files kept mutually consistent — parallelism.md: a logical
unit). Detail in `T6-wiring.md`.
