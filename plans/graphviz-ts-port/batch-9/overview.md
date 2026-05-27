# Batch 9 — neato Family Layout Engines

## Summary

Batch 9 ports the neato, fdp, and sfdp layout engines. These three engines
share a deep dependency on lib/neatogen: all three use the APSP routines,
VPSC overlap removal, and neato spline routing. fdp adds cluster-hierarchy
force-directed layout on top. sfdp adds multilevel coarsening via lib/sparse
(T16, Batch 4).

The batch is organized to maximize parallelism in the independent algorithmic
components, then sequence the initialization and entry-point tasks that wire
them together.

**Five tasks run in parallel first (T40–T44):** These are self-contained
algorithm ports with non-overlapping write-sets. None depends on the others.

**T45 depends on T40–T44:** neato init wires together APSP, stress
majorization, SGD, VPSC overlap removal, and spline routing into the
`neatoLayout` entry point.

**T46 depends on T43–T45:** fdp init imports the VPSC overlap module (T43)
and the neato spline module (T44), plus the neato init infrastructure (T45).

**T47 depends on T40 and T16 (sparse from Batch 4):** sfdp requires the
APSP Dijkstra solver for distance matrix construction and the sparse matrix
infrastructure for multilevel coarsening.

Two numerical precision issues span multiple tasks:

**Kahan summation (T41):** The C stress majorization code accumulates the
Laplacian diagonal using `DegType = long double`. TypeScript has no `long
double`. T41 must use Kahan summation for diagonal accumulation — this is
not optional and is a stop condition if violated.

**MT19937 seed (T42):** The SGD Fisher-Yates shuffle uses MT19937 (ported
in T7). SGD seeds from `GraphInfo.seed` (equivalent to `GD_seed(g)`). The
seed must flow from the `start` graph attribute through neato init (T45)
into the SGD entry point. `Math.random()` is forbidden anywhere in T42.

**SFDP control struct save/restore (T47):** `multilevel_spring_electrical_embedding`
saves `ctrl0 = *ctrl` on entry and restores `*ctrl = ctrl0` before return.
The function mutates `ctrl.K`, `ctrl.step`, `ctrl.random_start`, and
`ctrl.adaptive_cooling` during execution. The restoration makes repeated
calls idempotent. This must be preserved exactly.

## Dependencies

- Requires: Batches 1–7 complete (type model, util, CDT, geometry, common,
  GVC orchestration, renderers)
- Does NOT require Batch 8 (dot) — neato, fdp, sfdp do not depend on dotgen
- T47 additionally requires: T16 (lib/sparse port) from Batch 4
- Parallel within batch: T40 ‖ T41 ‖ T42 ‖ T43 ‖ T44
- T45 → depends on T40, T41, T42, T43, T44
- T46 → depends on T43, T44, T45
- T47 → depends on T40, T16 (Batch 4)

## Task Table

| ID  | Description                          | ‖/→ | Writes                                                                                                      | Depends On          |
|-----|--------------------------------------|-----|-------------------------------------------------------------------------------------------------------------|---------------------|
| T40 | All-pairs shortest path (APSP)       | ‖   | src/layout/neato/dijkstra.ts, src/layout/neato/bfs.ts, src/layout/neato/apsp.test.ts                       | —                   |
| T41 | Stress majorization                  | ‖   | src/layout/neato/stress.ts, src/layout/neato/conjgrad.ts, src/layout/neato/stress.test.ts                  | —                   |
| T42 | SGD layout                           | ‖   | src/layout/neato/sgd.ts, src/layout/neato/sgd.test.ts                                                      | —                   |
| T43 | VPSC overlap removal                 | ‖   | src/layout/neato/overlap.ts, src/layout/neato/overlap.test.ts                                               | —                   |
| T44 | neato spline routing                 | ‖   | src/layout/neato/splines.ts, src/layout/neato/splines.test.ts                                               | —                   |
| T45 | neato init and entry point           | →   | src/layout/neato/init.ts, src/layout/neato/index.ts, src/layout/neato/neato.test.ts                        | T40, T41, T42, T43, T44 |
| T46 | fdp layout engine                    | →   | src/layout/fdp/init.ts, src/layout/fdp/grid.ts, src/layout/fdp/clusteredges.ts, src/layout/fdp/comp.ts, src/layout/fdp/index.ts, src/layout/fdp/fdp.test.ts | T43, T44, T45 |
| T47 | sfdp layout engine                   | →   | src/layout/sfdp/init.ts, src/layout/sfdp/hierarchy.ts, src/layout/sfdp/spring.ts, src/layout/sfdp/smoother.ts, src/layout/sfdp/index.ts, src/layout/sfdp/sfdp.test.ts | T40, T16 (Batch 4) |
