# Mission 7 — fdp gap analysis (T1 recon, 2026-06-10)

Baseline at mission start: 1013 passed / 11 failed (fdp 6, sfdp 5).

## Our state

Our fdp (src/layout/fdp/, 8 files) produces positions confined to a
unit square (|pos| < 0.6 inches for fdp-simple) and copies pos into
coord without the x72 conversion — a simplified force model, not the
C algorithm. The oracle places the same graph across ~2 inches.

## C spec (READ AT THE 15.0.0 TAG — see decision journal: post-tag
Mlimit + ULP churn in exactly these files)

`git -C ~/git/graphviz show 15.0.0:lib/fdpgen/<file>`:

- layout.c (1078 lines): fdp_layout → layout(g) recursive cluster
  scheme — clusters laid out bottom-up as "derived graphs" with port
  nodes, then expanded (xLayout) and packed into parents.
- tlayout.c (602 lines): fdp_tLayout — grid-accelerated
  Fruchterman-Reingold: parms K/C/Tfact/maxIters/T0, seed mode
  (smode/seed for the RNG — uses srand48/drand48 like neato),
  cooling schedule, grid (grid.c) for repulsion locality, port
  boundary handling (T_Wd/T_Ht).
- xlayout.c: overlap expansion (use the 15.0.0 doRep WITHOUT the
  Mlimit branch).
- dist.c/comp.c/clusteredges.c: distance init, components, cluster
  edge routing.
- fdp defaults printed by the oracle: useGrid=1, useNew=1,
  numIters=600(?), K from... (verify with `fdp -v -v` next session).

## Oracle workflow (proven in mission 6)

Installed graphviz == 15.0.0 byte-reproduces refs. Use:
- `fdp -Tplain` for final inch positions,
- `fdp -Gmaxiter=N` bisection for divergence isolation,
- `-Gnotranslate=true` to see pre-shift coords,
- verbose traces for parameter fingerprints.

## Inherited infrastructure (mission 6)

src/common/random.ts (exact drand48), float32 matrix-ops discipline,
splineEdgesShifted, polyomino packing with spline-aware shifts,
cluster bb/label machinery, effective-polygon shape_info.

## Plan

- T2: port fdp_tLayout + grid.c + parameter resolution (tlayout
  parms; seed handling; the adjust/cooling loop) for the FLAT
  (cluster-free) case; validate fdp-simple/edge-both/large against
  the oracle by maxiter bisection.
- T3: cluster scheme from layout.c (derived graphs, ports, xLayout
  WITHOUT Mlimit) for fdp-cluster/nested-cluster.
- T4: components (fdp-disconnected packs like neato); pipeline tail
  (splineEdgesShifted, clusters, translate).
- T5: verify 6 goldens; re-baseline; merge.
