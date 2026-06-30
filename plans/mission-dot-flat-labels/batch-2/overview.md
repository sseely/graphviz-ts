# Batch 2 — make_flat_labeled_edge (non-adjacent)

Runs after T1 (the label vnode must exist before the edge can route around it
and copy its position to the label).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Port `make_flat_labeled_edge` + dispatch from `makeFlatEdge`; wire labeled flats into the live path; emit the label | opus | `src/layout/dot/splines-flat.ts`, `src/layout/dot/splines-flat-labeled.test.ts` (new) | T1 | [x] |

Done: spline case conformant to dot 15.0.0 (label `x` @ 117,-57.2 + 7-pt
spline); line case quarantined (`splines=line` unported) →
[comparisons/dot-flat-label-line.md](../comparisons/dot-flat-label-line.md),
`flatLabeledLinePoints` unit-tested. Impl in new `splines-flat-labeled.ts`
(splines-flat.ts at 500-line cap); live dispatch in `edge-route.ts`
(write-set extension, see decision-journal).

Gate per [../README.md](../README.md). One commit.
Commit: `feat(T2): port make_flat_labeled_edge + dispatch`.
