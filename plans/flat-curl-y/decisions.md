# Architecture decisions — flat-curl-y

## AD-1 — Match C exactly
Context: faithful TS port; `~/git/graphviz` (tag 15.1.0) is the spec.
Decision: port the exact C flat-curl box-Y/spline geometry (side-effect order,
`file:line` JSDoc); no optimization/simplification/reordering.
Consequences: byte/structural parity with the oracle.

## AD-2 — Diagnose before fixing
Context: divergences are usually "my port differs from C here," found by dumping
C's actual values (memory `instrument-c-before-quarantine`).
Decision: Batch 1 instruments native C `make_flat_edge` (non-adjacent) AND
`make_flat_adj_edges` (adjacent), dumping curl boxes + routed splines for both
paths BEFORE editing `src/`.
Consequences: T3 fixes exactly the named cause(s).

## AD-3 — Oracle-pinned, curated gate untouched
Context: 128 curated goldens are the conformantness backstop.
Decision: verify per-input vs the native oracle; judge by per-id verdict deltas
(0 regressions); never modify `suite.test.ts`/`manifest.json` or regenerate refs.
Consequences: a fix that regresses any id or changes any golden is rejected.

## AD-4 — Scope discipline (STOP guard)
Context: #241_0's residual spans two flat code paths; this is the 4th mission
on it. Prior missions correctly STOPPED rather than over-reach.
Decision: if the two paths have INDEPENDENT deep causes, fix the more isolated
one and DEFER the other (one path per mission). STOP if neither is isolable.
Consequences: bounded mission; honest partial delivery acceptable.

## AD-5 — Compare final coords, not internal (anti-frame-artifact)
Context: the flatedge-box-x mission burned two diagnosis passes on a +27
internal-frame box-x offset that compensates at emit (final X matches). Memory
`flat-edge-241-is-y-only`.
Decision: a divergence is only real if FINAL SVG coords differ. Dump `ND_coord`
to rule out compensating internal-frame offsets before naming any root cause.
Consequences: no time spent "fixing" no-ops; the flat-edge X (which matches) is
not touched — only the Y/curl geometry.
