# Architecture decisions — flatedge-box-x

## AD-1 — Match C exactly
Context: faithful TS port; `~/git/graphviz` (tag 15.1.0) is the spec.
Decision: port the exact C FLATEDGE box-x reference (side-effect order,
`file:line` JSDoc); no optimization/simplification/reordering.
Consequences: byte/structural parity with the oracle.

## AD-2 — Diagnose before fixing
Context: divergences are usually "my port differs from C here," found by dumping
C's actual values (memory `instrument-c-before-quarantine`).
Decision: Batch 1 instruments native C `beginpath`/`endpath` (FLATEDGE) for
`1:se->6:sw`'s tail/head end boxes and pins the exact port line + correct
x-reference BEFORE editing `src/`.
Consequences: T2 fixes exactly the named line.

## AD-3 — Oracle-pinned, curated gate untouched
Context: 128 curated goldens are the conformantness backstop.
Decision: verify per-input vs the native oracle; judge by per-id verdict deltas
(0 regressions); never modify `suite.test.ts`/`manifest.json` or regenerate refs.
Consequences: a fix that regresses any id or changes any golden is rejected.

## AD-4 — Scope discipline (STOP guard)
Context: the begin/endpath box helpers are shared by regular + flat edges.
Decision: this mission fixes ONLY the begin/endpath FLATEDGE box-x. NOT the
adjacent `make_flat_adj_edges` path (follow-on #2). If the x-reference cannot be
corrected without touching regular-edge box construction, STOP and report.
Consequences: bounded mission; honest partial delivery acceptable.

## AD-5 — FLATEDGE-gating (mission-critical)
Context: the same begin/endpath helpers (`splines-path-begin.ts`,
`splines-path-end.ts`) serve regular edges, whose goldens must stay conformant.
Decision: the box-x change MUST be gated to the flat-edge path (et === FLATEDGE
or the `makeFlatEnd` call site), never altering the regular-edge box-x. A
regular-edge golden changing is a STOP signal (the gating failed).
Consequences: the fix is a FLATEDGE-only branch; regular edges are untouched.
