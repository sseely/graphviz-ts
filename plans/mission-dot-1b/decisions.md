# Architecture Decisions — DOT-1b (retire the fitter)

## AD-1: Adjacent-back-edge faithful routing via synthetic forward view

**Context:** `routeRegularEdgeFaithful` declines back edges; adjacent back edges
(b→a, 1 rank) currently fall through to the fitter (`straightEdgeSplineWithRank`
via `routeForwardEdge`, or `routeEdgeRaw` via `routeBackEdge` chain<2).
**Decision:** Route them as the forward edge with swapped ends (C `makefwdedge`):
build a synthetic forward view → `routeRegularEdgeFaithful` → `clipAndInstall`,
letting the existing `swapSpline` pass un-flip orientation. Generalize the
existing `makeBackFwdEdge` (DOT-1 T4) into an exported `makeFwdEdge`.
**Consequences:** Reuses proven faithful primitives; the orientation un-flip is
already a pipeline pass. Must verify `swapSpline` runs for these edges.

## AD-2: Parallel/opposing groups mirror C `make_regular_edge` (shared base)

**Context:** In DOT-1, reversing a shared *forward* base did NOT reproduce dot's
opposing `b→a` geometry (-35.8→-60.7); the reversal-mechanism interaction
(`clipAndInstall` swapEnds vs `splines.ts` swapSpline) was never resolved.
**Decision (Scott, overriding the per-member recommendation):** Faithfully mirror
C's `make_regular_edge` cnt>1 path — route ONE shared base for `fe`, shift
interior control points by Multisep per member, `makefwdedge` for BWDEDGE
members, `clip_and_install` each. Faithfully port `makefwdedge` and reproduce how
C's `clip_and_install` + swapEnds yields the opposing geometry. T2 measures this
recipe before T3 implements it.
**Consequences:** Stays true to the C source. Requires understanding the
swapEnds/swapSpline interaction that DOT-1 left unresolved — hence the T2
measure-first step. Higher implementation risk than a rewrite, lower divergence
risk.

## AD-3: Deletion gated on byte-exact parity (safety invariant)

**Context:** The targets are *existing* goldens — they cannot be quarantined or
regenerated.
**Decision:** Delete a fitter path ONLY after its faithful replacement reproduces
every affected golden byte-for-byte (0.01pt). If a faithful port cannot reach
byte-exact, STOP and keep that fitter path rather than regress — partial deletion
is acceptable, regression is not.
**Consequences:** Guarantees zero golden churn. Worst case DOT-1b deletes less
than 100% and a residual is re-scoped (as T6 was in DOT-1).
