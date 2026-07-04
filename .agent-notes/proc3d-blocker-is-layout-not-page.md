# proc3d divergence: NOT page= pagination — it's a layout bb gap

## Observation: page= is a no-op for SVG; proc3d residual is a ~201pt layout y-extent divergence
- **Context**: After porting orientation=land (feature/orientation-land),
  proc3d stayed diverged (maxDelta 217). The mission notes / memory labeled the
  residual "page= pagination". Instructed to port page= pagination next.
- **Finding**: Instrumented via controlled experiments on the working oracle
  (homebrew dot 15.0.0, which reproduces the 15.1.0 numbers for this graph):
  - Removing `page="8.5,11"` from proc3d yields **conformant** SVG in BOTH
    native dot AND the port (transform unchanged: scale 0.274767 rotate(-90)
    translate(-2616.4 756.97)). So `page=` changes nothing for `-Tsvg`.
  - Root cause in C: the SVG **device** features (gvrender_core_svg.c:810) set
    `default_margin={0,0}`, `default_pagesize={0,0}`, and flags WITHOUT
    `GVDEVICE_DOES_PAGES`. In `init_job_pagination` (emit.c:1208) the user-page
    branch requires `graph_sets_pageSize && (flags & GVDEVICE_DOES_PAGES)` —
    false for SVG — so it falls to the else branch where `pageSize = imageSize`.
    `center=true` likewise nets zero (needs pageSize > imageSize). page=/center=
    only matter for paged devices (PS/PDF/printf-style), never SVG.
  - The REAL divergence: port layout bb.ur.y = 551.97 vs native 752.97 — a clean
    **201.0-point** shortfall in the y (rank) extent. This propagates to:
    Z (size= fit) 0.274398 vs 0.274767, width 154pt vs 209pt, translate y
    555.97 vs 756.97. Native bb="0,0,2612.4,752.97"; clusters occupy the
    y-band 121.98..440.73 in native. The graph has 6 clusters, ranksep=1.0,
    style="setlinewidth(8)"; no root graph label ("gryphon" is cluster_0's
    label). The 201pt lives outside the cluster band (rank spacing / cluster
    vertical placement).
- **Impact**: "port page= pagination" is mis-scoped — there is nothing to port
  for SVG. proc3d (and likely b69, also diverged under landscape) needs a
  LAYOUT investigation of the ~201pt y-extent gap, not an emit/pagination
  feature. Do not build a pagination path for SVG.
- **Confidence**: High (conformant with/without page= in both engines;
  C device-features confirm no DOES_PAGES).

## RESOLUTION (2026-06-24): root cause = ranksep/nodesep attrs ignored
- The 201pt y-gap was rank separation: native rank gap 113 = node_h(41) +
  ranksep(72 = `ranksep=1.0`); port gap 77 = 41 + 36 (the 0.5in DEFAULT). The
  port's `dotGraphInit` (init.ts) parsed `rankdir` but never `ranksep`/`nodesep`
  — `dotInitSubg` only applied the hardcoded 36/18 defaults, so BOTH attrs were
  silently ignored.
- Fix: ported `input.c:665-681` into `dotGraphInit` (`parseSepAttrs`): nodesep
  via `lateDouble(...,0.25,0.02)`, ranksep via parseFloat + MIN_RANKSEP clamp +
  `equally`→exact_ranksep, both ×POINTS(72). Defaults round to 18/36 so the
  ~740 non-setting graphs stay conformant.
- Result: proc3d diverged→structural (maxDelta 217→3.55); 17 verdict
  improvements corpus-wide (conformant 325→334), 0 regressions. Exactly the 54
  graphs that set nodesep/ranksep changed.
- RESIDUAL (separate, pre-existing, NOT ranksep): proc3d still has a ~3.5pt
  X-EXTENT gap (port bb.ur.x 2615.93 vs native 2612.4). The y-axis is now
  conformant (raw proc3d translate(4 756.97) matches). The x residual is a
  within-rank / cluster-x spacing issue — future work, keeps proc3d at
  structural-match.
- Cluster ranksep propagation (initSubg GD_ranksep(sg)=GD_ranksep(g),
  dotinit.c:343) was NOT ported; root-only parsing sufficed for proc3d.

## Observation: proc3d residual (~3.5pt) is an x-coordinate-NS micro-drift
- **Context**: after the ranksep fix, proc3d stays structural-match with
  maxDelta 3.55 — a small x-extent gap (port bb.ur.x 2615.93 vs native 2612.4;
  raw width 2624 vs 2620). y-axis is conformant.
- **Finding (systematic bisection, all on /tmp/proc3d.raw.gv = rotation/size
  stripped)**: node x-positions drift right in ~1pt steps accumulating to
  ~3.53pt left→right; fractional parts diverge (native x≡.11, port x≡.63).
  Ruled OUT as causes (each verified):
  - clusters — drift persists with all `subgraph cluster_N` groupings removed
    (native bb unchanged 2612.4, port still 2624).
  - penwidth — removing `style="setlinewidth(8)"` changes nothing.
  - node sizing — node widths identical (49.75pt both, native -Tplain == port
    polygon span).
  - simple wide ranks — `a->{k0..k19}` fan-outs are conformant port/native
    at every width; 2/3/4-cluster minimal graphs conformant too.
  So it is pure x-coordinate network-simplex POSITIONING, triggered only by
  proc3d's full cross-connected multi-rank constraint graph. No minimal repro.
- **Impact**: fixing it means editing the x-coord NS / mkNConstraintG /
  medianpos path with NO minimal repro and high regression risk to every
  multi-rank + cluster graph that currently passes, for 3.5pt (0.13%) on one
  graph already at structural-match. Deferred as low-value / high-risk.
  Branch fix/proc3d-x-extent was investigation-only (no code change).
- **Confidence**: High on the diagnosis (cause class isolated by elimination);
  the exact NS input that differs is not yet pinned (would need port-vs-C
  instrumentation of the x-NS separation constraints / iteration).

## RESOLUTION of the x-residual: node-label TEXT MEASUREMENT (font metrics)
Instrumented the x-NS against the C (built dot 15.1.0~dev with plugins flattened
into /tmp/gvplugins; rpaths patched onto build/cmd/dot/dot; XNS_DUMP env-guarded
fprintf in set_xcoords + make_aux_edge; matching console.error in the port's
setXcoordsFromRank + makeAuxEdge). Findings, top-down:
- Raw NS x-coords differ port-vs-C by small integers (1-2), non-uniform within a
  rank → not normalization, not a global shift.
- Aux constraint graph is structurally identical: 277 edges both; all 35
  real-node separation edges conformant. lrBalance (ns.ts) is a faithful
  port of C LR_balance (delta>>1 == delta/2, correct rounding both branches).
- Exactly 3 constraint edges differ by +1 (292/303/305 → 293/304/306). They
  trace to 5 nodes whose lw/rw is a CONSTANT +0.5304 larger in the port.
- Those nodes are NORMAL real nodes (type=0, lbl=1, ht=57.98) — proc3d's
  shape=ellipse "file" nodes with 2-line labels "<id>\n<unix path>".
- Isolated repro: a lone node with label "93736-32246\n/home/ek/work/src/lefty/
  lefty.c": box width C=192.00 vs port=192.75 (+0.75); ellipse rx C=130.11 vs
  port=130.64 (+0.53 = 0.75/√2 via ellipse fit). Per-line: the ID line
  "93736-32246" measures 96 in BOTH; the PATH line measures C=192 vs port=192.75.
- ROOT CAUSE: the port measures the 31-char Times-Roman-14 path string ~0.75pt
  (+0.43%) wider than native C's FreeType/libgd metrics. That sub-pixel font
  delta → ellipse half-width +0.53 → 3 ROUND() boundaries tip in the x-NS
  separation minlens → network simplex selects a 1-2 unit different (still
  optimal) vertex → ~3.5pt accumulated x-extent on proc3d.
- This is a TEXT-METRICS FIDELITY limit (port's width model vs C's), not a
  layout-logic bug. Explains why it only hits wide-label graphs and resists
  minimal repro (short labels don't tip ROUND). Fixing = improving the port's
  font metric tables to conformant C for all glyph strings — large blast radius
  (every label), high risk, sub-pixel reward. Recommend NOT chasing for proc3d.
  All instrumentation reverted; build dot left runnable via GVBINDIR=/tmp/gvplugins.
