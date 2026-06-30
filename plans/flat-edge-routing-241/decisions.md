# Architecture decisions — flat-edge-routing-241

## AD-1 — Match C exactly
Context: faithful TS port; `~/git/graphviz` (tag 15.1.0) is the spec.
Decision: port the exact C `make_flat_edge` branch (side-effect order, box
geometry, `file:line` JSDoc); no optimization/simplification/reordering.
Consequences: byte/structural parity with the oracle.

## AD-2 — Diagnose before fixing
Context: divergences are usually "my port differs from C here," found by dumping
C's actual intermediate values (memory `instrument-c-before-quarantine`).
Decision: Batch 1 instruments native C `make_flat_edge`/`make_flat_bottom_edges`
/`makeFlatEnd`/`makeBottomFlatEnd` for #241_0 and dumps the flat boxes + routed
splines BEFORE editing `src/`.
Consequences: T2 fixes exactly the named branch; no speculative edits.

## AD-3 — Oracle-pinned, curated gate untouched
Context: 128 curated goldens are the conformantness backstop; bucket counts
re-bucket misleadingly (memory `bucket-fix-rebucketing`).
Decision: verify per-input vs the native oracle; judge by per-id verdict deltas
(0 regressions); never modify `suite.test.ts`/`manifest.json` or regenerate refs.
Consequences: a fix that regresses any id or changes any golden is rejected.

## AD-4 — Scope discipline (STOP guard)
Context: flat-edge routing has several coupled sub-cases (adjacent vs
non-adjacent, top vs bottom, labeled). The compass-port mission STOPPED at this
boundary rather than start a routing rewrite.
Decision: if T1 shows the divergence is NOT an isolated box/curl branch but a
deep multi-cause flat-routing rewrite, STOP and report as a follow-on. Do NOT
expand into a general flat-routing rewrite.
Consequences: bounded mission; honest partial delivery is acceptable.

## AD-5 — File-size: extract helpers, don't bloat
Context: `src/layout/dot/splines-flat.ts` is at 481/500 lines; the lizard cap
is 500/file, 30/fn, CCN 10.
Decision: if the fix would push the file over the cap, extract flat-box helpers
to a NEW `src/layout/dot/splines-flat-boxes.ts` (cohesive: box construction for
make_flat_edge) rather than bloat the file or split a function unnaturally.
Consequences: the fix write-set may include a new file; declare it in T2.
