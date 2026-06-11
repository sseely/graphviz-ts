# Mission 8 — sfdp gap analysis (T1 recon, 2026-06-10)

Baseline at mission start: 1001 passed / 5 failed (sfdp only).
Spec read at the 15.0.0 tag (extractions in /tmp/sfdp-spec/); oracle =
installed 15.0.0 binary. Read
`.agent-notes/fdp-fma-oracle-2026-06.md` first (fma contraction,
full-precision C oracle probe, cgraph adjacency ordering).

## Verified pipeline (sfdpinit.c:226 sfdp_layout)

1. `sfdp_init_graph`: EDGETYPE_LINE; neato_init_node per node.
2. `tuneControl`: seed from "start" (default 123), K=-1 (auto),
   p=-AUTOP→-1, levels=INT_MAX, smoothing=NONE,
   **tscheme=QUAD_TREE_NORMAL** (attr default overrides ctrl_new's
   HYBRID), do_shrinking=true, rotation=0.
3. `graphAdjustMode(g, &am, "prism0")` → AM_PRISM value **0**
   scaling **-4** → ctrl.overlap=0, initial_scaling=-4; sep=sepFactor
   → pad=(4/72, 4/72) inches via getSizes.
4. `ccomps` (sfdp-disconnected: 3); per component:
   `sfdpLayout(sg, ctrl, pad)` = makeMatrix → getSizes → getPos →
   `multilevel_spring_electrical_embedding`; then **spline_edges(g)**
   (the SHIFTING wrapper — M6 splineEdgesShifted).
5. ncc>1: `packSubgraphs(ncc, ccs, g, pinfo)` with l_node, CL_OFFSET,
   **doSplines=true**.
6. `dotneato_postprocess`.

## THE BIG ONE: prism never triangulates here

`remove_overlap(..., ntry=ctrl->overlap=0, initial_scaling=-4, ...)`
(overlap.c:486): with initial_scaling<0 it computes avg label size,
calls `scale_to_edge_length(dim, A, x, 4×avg_label_size)` — a uniform
scale — then **`if (!ntry) return;`**. "prism0" means ZERO smoother
iterations: NO GTS, NO Delaunay, NO OverlapSmoother, NO rbtree scan.
(The binary links GTS, but that code is unreachable at value 0.)
Oracle hint confirmed: verbose prints only the scaling line
("avg edge len=… avg_label-size=…") and no "overlap removal" lines.

## multilevel_spring_electrical_embedding (spring_electrical.c:1073)

- A = get_real_adjacency_matrix_symmetrized (or remove_diagonal).
- `Multilevel_new`: coarsen while nc ≤ 0.75·n and nc ≥ minsize=4;
  matching = `maximal_independent_edge_set_heavest_edge_pernode_
  supernodes_first` over a **gv_permutation(m)** random node order;
  P/R via from_coordinate_arrays, cA = R·A·P (multiply3),
  R /= degree, remove_diagonal.
- p: power_law_graph(A)? -1.8 : **-1** (ring graphs → -1).
- Coarsest→finest: `spring_electrical_embedding` (NORMAL scheme;
  slow/fast variants unreachable at defaults), then
  `prolongate` (multiply_dense + interpolate_coord + drand jitter
  ±0.5·0.001K), random_start=false, K×=0.75, adaptive_cooling=false,
  step=0.1 per level.
- `post_process_smoothing` = no-op for SMOOTHING_NONE.
- `pcp_rotate` (principal-axis rotation), no user rotation.
- remove_overlap → scaling only (above).

## spring_electrical_embedding (per level)

- A = SparseMatrix_symmetrize(A, true) (pattern-sym check).
- USE_QT iff n ≥ 45 (only sfdp-large; also its level-1 coarse graph
  if ≥45). oned_optimizer tunes max_qtree_level per iteration;
  QuadTree_get_supernodes per node.
- random_start: **srand(seed=123); x[i]=drand() for 2n values** —
  drand = rand()/RAND_MAX.
- K = average_edge_length(A, 2, x) when K<0; KP=pow(K,2);
  CRK=pow(C,1)/K, C=0.2.
- loop: per node i: attractive over CSR row (CRK·dist), repulsive
  all-pairs KP/pow(dist,2) (dist cropped at MINDIST) or supernode
  sum; normalize force; x += step·f. Fnorm-adaptive step
  (×0.9 / ×0.99/0.9); terminate when step ≤ 0.001 or 500 iters.

## RNG model (CRITICAL)

ALL randomness is the libc `rand()` stream:
- macOS rand() = Park–Miller minstd: `seed = seed·16807 mod 2³¹−1`,
  RAND_MAX = 2³¹−1 (verified empirically: srand(123) → 2067261,
  384717275, 2017463455, …).
- `drand()` = rand()/RAND_MAX (sparse/general.c:24).
- `gv_permutation` (Multilevel matching) = Fisher–Yates with
  `gv_random(bound)` = rand() with discard-threshold rejection
  (util/random.c).
- ORDER: Multilevel_new (permutation draws) runs BEFORE
  srand(123) in the embedding — the coarsening consumes the stream
  wherever it stands (process start = seed 1; for components 2..k of
  sfdp-disconnected it continues from the previous component's
  state). One GLOBAL mutable stream, srand resets it.

## Numerics risks

- FMA contraction (mission 7 finding): audit `_spring_electrical_
  embedding`, `_QuadTree_get_supernodes`, distance() etc. in the
  dylib; apply src/common/fma.ts at the contracted sites.
- pow(dist, 2.) and pow(K, 2.): clang may emit fmul (exact); V8
  Math.pow may differ — use the C probe to decide x·x vs pow.
- qsort in SparseMatrix? (from_coordinate_arrays sorts? check) and
  comp_scan_points — unreachable (overlap graph not built).
- SparseMatrix_multiply ja ordering: mask-accumulator append order —
  port exactly, row results are NOT sorted.

## Port inventory (≈2200 lines TS)

| Task | Files | C origin |
|---|---|---|
| T2 | src/common/crand.ts; src/layout/sfdp/sparse-matrix.ts | Apple libc rand; util/random.c; sparse/SparseMatrix.c (subset: new/from_coordinate_arrays/from_coordinate_format/add_entry/symmetrize/is_symmetric/get_real_adjacency_matrix_symmetrized/remove_diagonal/has_diagonal/transpose/multiply/multiply3/multiply_dense/divide_row_by_degree/copy/decompose_to_supervariables) |
| T3 | src/layout/sfdp/multilevel.ts, spring-electrical.ts | sfdpgen/Multilevel.c, spring_electrical.c (embedding NORMAL + driver; slow/fast guarded), overlap.c:scale_to_edge_length + remove_overlap(ntry=0 path) |
| T4 | src/layout/sfdp/quadtree.ts | sparse/QuadTree.c (new_from_point_list/add/get_supernodes) |
| T5 | src/layout/sfdp/index.ts, init.ts + tests | sfdpinit.c, neatogen/adjust.c:makeMatrix/getSizes; reuse ccomps/packSubgraphs/splineEdgesShifted/postprocess tail |

Validation levers: full-precision C probe (gvLayout 'sfdp');
`-Glevels=1` disables multilevel (direct srand(123) embedding —
first bisection point); `-Gquadtree=none` forces the slow variant
(differential); `-Gstart=N` seed variation; sfdp-simple (n=10, no
QT, levels: 10→cannot coarsen below minsize 4? verify) end-to-end.
