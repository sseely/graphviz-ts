# Batch 2 — Degenerate labeled-flat wiring

Only after Batch 1: the port's internal x-frame now matches C, so spline-less
edge labels land where C's do. Wire the three coupled changes that make C draw
(or suppress) a degenerate labeled flat leg by its label's clip overlap.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T6 | map_edge already skips no-spline labels (verify); make_flat_labeled handled-on-degenerate; drop routeLoneEdge skip + corridor label-guard; edge_in_box emit gate | orchestrator | `src/layout/dot/splines-flat-labeled.ts`, `src/layout/dot/edge-route.ts`, `src/render/svg.ts` | Batch 1 | [x] |

**T6 result:** `mapEdge` no-spline early return verified (postproc.ts:136).
`makeFlatLabeledEdge` returns handled (true) on the degenerate route (label set,
no spline) AND now forward-normalizes a backward (tail right of head by node
order) flat edge via the makefwdedge pattern — C `make_flat_edge` does this
before `make_flat_labeled_edge`; without it the channel inverts and the
non-degenerate `256->316` leg routed empty. `routeLoneEdge` band-aid skip
removed + `label===undefined` guard added to the non-adjacent corridor.
`svg.ts:edgeHasDrawableContent` now applies a faithful `overlap_label` test to
the (set) main label vs `job.bb` (the spline/xlabel/head/tail triggers kept as
HEAD-state to avoid suppressing on-canvas content — a spl.bb overlap test
regressed neato/circo).

**Outcome:** 2368_1 + 1624 conformant; 2368 childCount divergence RESOLVED
(11 edges, 9 paths, all 22 labels — was 6 edges). Survey GATE PASS, 0
regressions. 2368 retains a SEPARATE pre-existing ~5pt flat-label-rank vspace +
~1pt x-NS-tiebreak residual (was masked by the childCount diff; documented in
`.agent-notes/2368-residual-flat-label-ranksep.md`) — out of the
degenerate-label scope, so 2368 stays diverged (maxΔ ~5, firstDiff now a coord).

Single task (three files kept mutually consistent — parallelism.md: a logical
unit). Detail in `T6-wiring.md`.
