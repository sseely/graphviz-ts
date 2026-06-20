# Decision Journal — nonadjacent-flat-5ne8nw

Appended during execution (per `~/.claude/rules/autonomous-execution.md`).
One writer per row.

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| scope | 2026-06-20 | Follow-up to `aux-back-edge-curl`, scoped from a SIGNIFICANT pre-mission diagnostic pass (findings-diagnosis.md), not a guess. Target: the last `#241_0` residual, `5:ne->8:nw` (a non-adjacent flat). PROVEN root cause: the port's box channel = C's modulo a uniform +27 internal x-translation, yet the port spline is an EXACT MIRROR of C's (knot head-side x≈531 vs C tail-side x≈405). Since a shortest-path-funnel + bezier fit is translation-invariant, the port's `routeSplines` violates translation-EQUIVARIANCE → a bug in a sub-step (funnel vs fit vs constraint vectors vs absolute bound), unit-testable on a pure box channel with no graph. Batch 1 = bisect funnel-vs-fit + pin the line + RED equivariance test (AD-1). Batch 2 = minimal equivariance fix + full-corpus regression (AD-4, the crux — `routeSplines` is the SHARED box-channel fitter, highest blast radius of the saga). | The fitter is shared by every box-channel edge → diagnosis-first + the unit-testable equivariance property de-risk the highest-blast-radius change of the saga. Instrumented C (rebuilt + restored) gave ground truth before scoping (memory `instrument-c-before-quarantine`). | no |
