# T2 — Rewrite fdp core: derived graphs, tlayout, xlayout, flat pipeline

## Context
graphviz-ts is a faithful TS port of C graphviz. The current
`src/layout/fdp/` is a loose approximation (Math.random, no derived
graphs, no x_layout, no ×72 conversion) and must be rewritten to the C
architecture. **Read the C spec at the 15.0.0 tag only**
(`git -C ~/git/graphviz show 15.0.0:lib/fdpgen/<f>`; extracted copies
in `/tmp/fdp-spec/`): post-tag commits add an Mlimit branch and ULP
float reorderings that the refs (15.0.0 output) do not have.

Recon facts (verified against the installed 15.0.0 oracle):
- Default `overlap` for fdp is `"9:prism"` (xlayout.c DFLT_overlap):
  up to 9 tries of force-based `x_layout`, prism only if overlaps
  remain. **Prism never runs for any of the 6 golden inputs**
  (`-Goverlap=9:` output is byte-identical to default) — do NOT port
  prism/removeOverlapAs; throw/STOP comment if the fallback is reached.
- The x_layout force-expansion pass IS load-bearing for all 6 tests
  (`-Goverlap=true` changes every output).
- fdpParms defaults (common/globals.c @15.0.0): useGrid=1, useNew=1,
  numIters=-1, unscaled=50, C=0.0, Tfact=1.0, K=-1.0, T0=-1.0.
  fdp_initParams: maxiter=600, K=0.3 (DFLT_K), seed=1, smode=
  INIT_RANDOM, Cell=3·K, pass1 = unscaled·maxIters/100 = 300.
  xparams: T0=cool(pass1)=T_T0/2, numIters=maxIters−pass1=300,
  loopcnt=numIters (since numIters=-1). xParams.C stays 1.5 (static;
  only overwritten when xpms->C > 0; T_C=0.0 default).
- All math is double (no float32 discipline here, unlike neato).
- RNG: srand48(1) at start of EVERY initPositions call (per component,
  per cluster level); exact drand48 already in src/common/random.ts.
- `rand()` fallback in doRep/applyAttr only fires when dist2==0
  (coincident nodes) — not reachable for these inputs with continuous
  drand48 positions; implement as a throwing guard + journal note.
- C derived graph is `agopen("derived", Agstrictdirected)`; agedge
  with NULL name on a strict digraph dedups (edge.c:262) — duplicate
  real edges merge into one derived edge (ED_count tracks multiplicity).
- C canonicalizes derived edge direction by POINTER comparison
  (`if (hd > tl)` layout.c:466) — model as creation order (ND_id):
  edge always goes earlier-created → later-created node.
- Grid repulsion walk: dtwalk over Dtoset = cells visited in ascending
  (i,j) order (ijcmpf); node lists within a cell are PREPENDED (reverse
  insertion order). Float accumulation order must match.
- normalize() (neatogen/adjust.c:722) is a NO-OP unless the
  "normalize" attr is set — port the attr check + translate/rotate.
- sepFactor (neatogen/adjust.c:1046) default: doAdd, (4,4) points →
  x_layout converts PS2INCH.

## Task
Rewrite `src/layout/fdp/` following C file boundaries:

- `fdp-model.ts` — fdp.h: `gdata` (ports, bb, nports, level, parent),
  `dndata` (deg, wdeg, dn, disp), bport type, DNODE/PARENT/IS_PORT
  accessors. Derived graphs/nodes can be plain TS objects mirroring
  the C fields (they never render).
- `grid.ts` — grid.c: cell map keyed (i,j), walk in ascending (i,j)
  order, per-cell node lists in prepend order, findGrid neighbors.
- `tlayout.ts` — tlayout.c: fdp_initParams, init_params/reset, cool,
  doRep/applyRep/applyAttr (useNew branchs), doNeighbor/gridRepulse,
  updatePos (port-ellipse boundary), adjust/gAdjust, initPositions
  (bbox of pinned, Wd/Ht ellipse math, srand48(seed), port placement,
  neighbor-average placement, drand48 rect/ellipse placement),
  fdp_tLayout.
- `xlayout.ts` — xlayout.c: WD2/HT2/RAD with X_marg, overlap,
  cntOverlaps, doRep/applyRep/applyAttr (x-variants), adjust,
  x_layout (tries loop, K += K per try, X_ov/X_nonov), fdp_xLayout
  (overlap-attr parse "n:mode"; throw if removeOverlapAs would run
  with a real mode). Port sepFactor (+parseFactor) — put it in
  src/layout/neato/ or src/common/ (journal entry if common/).
- `comp.ts` — comp.c findCComp: port/pinned component merge + DFS in
  agfstedge order, remaining components, node-induced subgraphs.
- `layout.ts` — layout.c: mkDeriveNode, deriveGraph (cluster dnodes
  via do_graph_label first, attr copies overlap/sep/K, edge dedup +
  ED_count/addEdge, WDEG/DEG), layout() recursion skeleton (cluster
  branch may STOP-stub until T3), finalCC (margin, label width
  adjust, border, PS2INCH translate), evalPositions, setClustNodes
  (no-op for inputs without cluster edges — guard + comment), setBB,
  mkClusters, chkPos, fdpLayout.
- `index.ts` — fdp_layout pipeline: setEdgeType(LINE),
  mkClusters/initParams/init_node_edge (fdpinit.c port in `init.ts`:
  common_init_node, ND_pos calloc, gv_nodesize, ED_factor/ED_dist
  with len attr default K, initialPositions from pos attr,
  neato_nlist + ND_id), fdpLayout, neato_set_aspect, fdpSplines
  (EDGETYPE_LINE → reuse M6 spline_edges1 path), gv_postprocess
  equivalent (reuse the M6 tail: addClusters/computeSubgraphBB/
  placeGraphLabel pattern as neato does).
- Rewrite `fdp.test.ts` / `fdp-pipeline.test.ts` against the new API
  (D5: old tests encode the non-C behavior). Keep coverage ≥90% for
  the new files.

fdp-disconnected exercises putGraphs on derived components INSIDE
layout() (pack.fixed=null, l_node mode, margin CL_OFFSET/2=4 from
getPackInfo in init_info) — reuse the M4 polyomino packer; the
derived component subgraphs must expose what packGraphs needs.

## Write-set
`src/layout/fdp/*` (delete forces.ts; only src/index.ts imports
`fdpEngine` externally). `src/common/*`, `src/layout/pack/*`,
`src/layout/neato/*` allowed with decision-journal entry.

## Read-set
- /tmp/fdp-spec/{fdp.h,grid.c,tlayout.c,xlayout.c,layout.c,comp.c,
  fdpinit.c} (== 15.0.0 tag)
- 15.0.0 lib/neatogen/adjust.c:691-763 (normalize), 1000-1063
  (parseFactor/sepFactor); lib/pack/pack.c (putGraphs — already
  ported M4: src/layout/pack/)
- src/layout/neato/index.ts (M6 pipeline tail pattern),
  src/layout/neato/splines.ts (splineEdgesShifted, EDGETYPE_LINE),
  src/common/random.ts (drand48), src/layout/pack/index.ts
- Oracle: `fdp -Tplain`, `-Gmaxiter=N`, `-Goverlap=true` (tlayout
  only), `-Gstart=N` (seed variation), `/tmp/*.plain` captures

## Acceptance criteria
- Given fdp-simple with `-Gmaxiter=0` oracle comparison, when our
  initPositions runs (probe script), then all 6 node positions match
  the oracle plain output to 1e-6 inches (validates drand48 ellipse).
- Given fdp-simple/fdp-edge-both/fdp-large/fdp-disconnected, when
  rendered via renderSvg, then golden suite tests pass (0.5pt tol).
- Given the full suite, then no previously-passing test fails and
  failure count ≤ mission-start count.

## Quality bar
`npx tsc --noEmit` clean; `npx vitest run` per gates; functions ≤30
lines / CCN ≤10 where the C allows (note deviations); SPDX headers;
every symbol gets `@see` to its 15.0.0 C origin (file:function).

## Observability / Rollback
N/A (pure layout). Reversible (git revert).

## Commit
`feat(fdp): port fdpgen core — derived graphs, tlayout, xlayout` (one
commit; body notes prism-not-ported and rand()-guard decisions)
