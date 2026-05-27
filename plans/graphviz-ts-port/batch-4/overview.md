# Batch 4 — Geometry Primitives

## Summary

Batch 4 ports four self-contained geometry and sparse-math libraries that sit
below `lib/common` in the dependency graph. All four can be implemented
independently; none imports from the others. They are the foundational
primitives consumed by the layout engines and the common layer.

- **T14 — pathplan**: visibility-graph shortest-path and Bezier spline fitting.
  Critical: C returns pointers into module-global buffers; TS returns owned
  arrays (AD-3).
- **T15 — xdot**: xdot operation string parser and serializer. Coordinates are
  in PostScript Y-up space; the Y-flip is deferred to the renderer (Batch 7).
- **T16 — sparse**: CSR/COO sparse matrix and QuadTree for Barnes-Hut SFDP.
  Float64Array for all numeric vectors.
- **T17 — ortho**: orthogonal edge router via Seidel trapezoidation. SEED=173
  must be hard-coded; it is not a parameter.

All four tasks are fully independent (non-overlapping write-sets) and run in
parallel.

## Dependencies

- Requires: Batch 1 (scaffold + type model) and Batch 2 (util, CDT) complete
- Parallel within batch: T14 ‖ T15 ‖ T16 ‖ T17
- Blocks: Batch 5a (T18, T19), Batch 5c (T23)

## Task Table

| ID  | Description                          | ‖/→ | Writes                                                                | Depends On |
|-----|--------------------------------------|-----|-----------------------------------------------------------------------|------------|
| T14 | lib/pathplan port                    | ‖   | src/pathplan/index.ts, src/pathplan/pathplan.test.ts                 | —          |
| T15 | lib/xdot port                        | ‖   | src/xdot/index.ts, src/xdot/xdot.test.ts                             | —          |
| T16 | lib/sparse port (SparseMatrix + QuadTree) | ‖ | src/sparse/SparseMatrix.ts, src/sparse/QuadTree.ts, src/sparse/index.ts, src/sparse/sparse.test.ts | — |
| T17 | lib/ortho port                       | ‖   | src/ortho/index.ts, src/ortho/ortho.test.ts                           | —          |
