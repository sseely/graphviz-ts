# T3 — Multilevel coarsening + spring-electrical embedding

## Context
See gap-analysis.md §multilevel/§embedding/§numerics. This is the
numeric heart; validate with the full-precision C probe
(`gvLayout(gvc, g, "sfdp")` + ND_pos %.17g) at `-Glevels=1` first
(no coarsening → srand(123) → embedding directly), then with
multilevel on.

## Task
- `src/layout/sfdp/multilevel.ts`: Multilevel_init/new/establish/
  coarsen/coarsen_internal, maximal_independent_edge_set_heavest_
  edge_pernode_supernodes_first (gvPermutation order, supernode
  pre-clustering via decompose_to_supervariables, MAX_CLUSTER_SIZE=4
  — check Multilevel.h), get_coarsest. minsize=4,
  min_coarsen_factor=0.75.
- `src/layout/sfdp/spring-electrical.ts`: control struct + defaults
  (ctrl_new + tuneControl resolution), oned_optimizer,
  average_edge_length, update_step, distance/distance_cropped
  (MINDIST — value from sparse/general.h), spring_electrical_embedding
  (NORMAL; USE_QT branch behind T4's QuadTree — land T3 with the
  n<45 path and a guard), power_law_graph, pcp_rotate, rotate,
  interpolate_coord, prolongate,
  multilevel_spring_electrical_embedding (edge-label scheme path
  guarded — no inputs use it), scale_to_edge_length +
  remove_overlap ntry=0 path (@see neatogen/overlap.c:486).
- FMA audit: otool -tv the dylib for _spring_electrical_embedding /
  _average_edge_length / _distance; apply fma()/fms() to match;
  decide pow(dist,2) vs dist*dist from the disassembly (fmul ⇒ x·x).
- Acceptance: with levels=1, our positions for sfdp-simple match the
  C probe ≤1e-12; with defaults, sfdp-simple/medium/weighted match
  ≤1e-9 (post-pcp_rotate, post-scaling).

## Write-set
src/layout/sfdp/* (+ src/common/fma.ts reuse). Suite must stay green
(engine not yet rewired, or rewired behind passing goldens).

## Commit
`feat(sfdp): port multilevel coarsening and spring-electrical core`
