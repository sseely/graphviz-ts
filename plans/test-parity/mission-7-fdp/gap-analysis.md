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
- comp.c/clusteredges.c: generalized components, cluster edge
  routing (dist.c is empty at the tag).

## Verified parameters and control flow (T1 completion, 2026-06-10)

- fdpParms defaults (common/globals.c @15.0.0): useGrid=1, useNew=1,
  numIters=-1, unscaled=50, C=0.0, Tfact=1.0, K=-1.0, T0=-1.0.
  fdp_initParams: maxiter=600, K=0.3, seed=1, smode=INIT_RANDOM,
  Cell=3K=0.9, pass1=300. xparams: T0=T_T0/2, numIters=300,
  loopcnt=300, C stays 1.5 (static xParams; T_C=0 never overrides).
- **Overlap pass:** DFLT_overlap="9:prism". Oracle experiments:
  `-Goverlap=9:` is conformant to default on ALL 6 inputs →
  prism NEVER runs (no prism/delaunay/sparse port needed).
  `-Goverlap=true` changes ALL 6 outputs → x_layout force expansion
  IS load-bearing everywhere. Guard the prism fallback with a throw.
- All fdp math is double (no float32 discipline, unlike neato).
- srand48(1) at every initPositions (per component & cluster level).
- rand() fallback (dist2==0) unreachable for these inputs → throwing
  guard instead of macOS-rand emulation.
- Derived graph = agopen(Agstrictdirected); agedge(NULL name) dedups
  on strict digraphs (cgraph/edge.c:262) → derived multi-edges merge,
  ED_count tracks multiplicity. Edge direction canonicalized by C
  POINTER order (`hd > tl`) → model as creation order (ND_id).
- Grid walk = dtwalk over Dtoset: ascending (i,j); per-cell node
  lists prepend → float accumulation order fixed by both.
- normalize() no-op without "normalize" attr; sepFactor default
  doAdd (4,4)pt → PS2INCH'd in x_layout.
- Oracle == installed 15.0.0 (`fdp -V`); plain output captures in
  /tmp/*.plain, spec extraction in /tmp/fdp-spec/.

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

## Plan (revised at T1 completion — see task files)

- T2 ([T2-flat-fdp.md](T2-flat-fdp.md)): rewrite src/layout/fdp/ to
  the C architecture — fdp.h model, grid, tlayout, xlayout,
  findCComp, layout.c flat path (deriveGraph runs unconditionally;
  disconnected packing happens INSIDE layout() via putGraphs on
  derived components), pipeline tail reusing M6 spline machinery.
  Targets 4 goldens: fdp-simple, fdp-edge-both, fdp-large,
  fdp-disconnected.
- T3 ([T3-clusters.md](T3-clusters.md)): cluster scheme — ports
  (getEdgeList/genPorts/expandCluster), recursion, finalCC borders,
  evalPositions, cluster emission. Targets fdp-cluster,
  fdp-nested-cluster.
- T-final: full suite, baseline-after-m7.md, README tick, merge.

Old T4/T5 folded in: component packing proved inseparable from
layout() (T2), and the pipeline tail is part of the engine wiring.
