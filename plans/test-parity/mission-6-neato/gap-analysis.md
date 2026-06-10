# Mission 6 — neato gap analysis (T1 recon, 2026-06-10)

Baseline at mission start: 1004 passed / 18 failed. 7 neato goldens.

## Oracle facts (installed graphviz == 15.0.0, byte-reproduces refs)

`neato -v` on neato-simple: `model 0 smart_init 0 stresswt 2
iterations 200 tol 0.000100`, then "Solving model: 3.261 1.469 0.933
0.378 0.129 0.111 0.110" — stress majorization (MODE_MAJOR default),
MODEL_SHORTPATH, 200 max iterations, Epsilon 1e-4, random initial
placement with srand48(1) (no `start` attr → setSeed returns dflt
INIT_RANDOM with seed=1; checkStart always calls srand48(seed)).

Per-iteration stress values give an exact convergence fingerprint to
verify against.

## Our state

- neato output collapses to a vertical line (x=0, y=k*45): the
  initial placement is degenerate and/or the solver is simplified.
- src/layout/neato/stress.ts is 420 lines vs C stress.c's 1129 —
  a reduced port (no CMajEnv conjugate-gradient kernel structure).
- src/common/random.ts does NOT exist (D3 not yet implemented);
  initCoords takes an injected rng.

## C call path to replicate exactly (all inches space)

neato_layout → neatoLayout(per component) → majorization():
checkStart (srand48(1)) → makeGraphData (scan_graph_mode: edge
dist from len attr ED_dist; model dists via bfs (MODEL_SHORTPATH))
→ stress_majorization_kD_mkernel(gp, nv, coords, nodes, dim=2,
opts=exp2, model, maxi=200):
- compute full distance matrix (bfs for unit lens / dijkstra),
- add 1e-6*(drand48()-0.5) jitter per dij entry (line 910),
- initLayout: coords[d][i] = drand48() (x then y per node, line 154),
- majorization loop with conjugate-gradient per axis, Epsilon 1e-4.
Then adjustNodes (overlap: default none for plain graphs), then
spline_edges + dotneato_postprocess (mission-4 wrapper).

## Tasks

- T2: src/common/random.ts — exact drand48/srand48 (48-bit LCG,
  a=0x5DEECE66D c=0xB; double via BigInt) + unit tests against known
  glibc/macOS sequence values. Forbid Math.random in layout code.
- T3: align the stress pipeline with C stress.c step-for-step
  (distance matrix incl. the 1e-6 jitter draw ORDER, initLayout draw
  order, CG kernel, convergence test), wire mode/model dispatch and
  MaxIter/Epsilon defaults; verify per-iteration stress fingerprint
  against the oracle.
- T4: pipeline tail: spline_edges wrapper + postprocess for neato,
  component packing (l_node) for neato-disconnected, cluster bbs for
  neato-cluster (clusters in neato are drawn from node extents —
  check C compute_bb/dclust handling).
- T5: verify 7 goldens; re-baseline; merge.
