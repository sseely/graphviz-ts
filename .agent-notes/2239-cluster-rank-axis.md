# D6 — 2239 nested-cluster rank-axis compression under rankdir=LR

## Repro
```
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/2239.dot -o /tmp/2239.c.svg
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/2239.dot dot > /tmp/2239.port.svg
```
C width 12078pt, port width 6799pt (height matches exactly, 1045pt both sides).

## Mechanism
The port's cluster rank-axis width comes from `dotComputeBb`
(`position-bbox.ts:79-80`, mirroring `dot_compute_bb` in
`lib/dotgen/position.c:869-870`): a cluster's box width is
`ND_rank(GD_rn) - ND_rank(GD_ln)`, read from the two SLACKNODE sentinel
nodes (`ln`/`rn`) *after* the position-pass network simplex has solved for
them but *before* `set_xcoords` resets `ND_rank` back to the rank index
(`set_xcoords` only touches nodes actually seated in a rank row; `ln`/`rn`
are never seated in a rank row, so they keep the solved coordinate
permanently). I verified — via direct runtime instrumentation of the
port's aux-edge-construction functions (`containNodes`, `containClustnodes`
compaction edge, `keepoutOthernodes`, `containSubclust`, `separateSubclust`
in `position-cluster.ts`) and line-by-line comparison against
`lib/dotgen/position.c` — that the CONSTRAINT GRAPH (which aux edges get
created, their weights, minlens, and construction order) is **structurally
identical** to C for the diverging cluster (`cluster_dtlsdec1_0x5641244e6cb0`)
and its tight-matching siblings (`cluster_srtpdec1_0x5641244e6b50`,
`cluster_dtlssrtpdemux1_0x7f06bc006d80`). Given that identical constraint
set, the port's network simplex converges `dtlsdec1`'s `ln`/`rn` to the
provably tight/minimal feasible width (158pt — matches independent
hand-computation: `margin+halfwidth` on each side + adjacent-rank node gap),
while C outputs 4507pt for the *same* cluster despite an aggressive
weight-128 "compaction edge" (`contain_clustnodes`,
`lib/dotgen/position.c:364`) that should pull `ln`→`rn` to minlen=1. A
weight-128 edge left with 4507pt of unclosed slack while a mathematically
reachable 158pt solution exists is not a topology gap — it means C's
network simplex terminates at a **different, non-minimal but still
feasible** optimum than the port's. I traced this to `LR_balance`
(`lib/common/ns.c:778`, dispatched from `dot_position`'s
`rank(g, 2, nsiter2(g))` call — `balance=2` is literally "LR balance"):
for every **zero-cutvalue (degenerate) tree edge**, `LR_balance` finds a
replacement entering edge via `enter_edge`, and if that edge's slack is
large, *deliberately redistributes half the slack* onto the tree edge
instead of leaving it tight — an intentional visual-balancing
post-process, not a bug. The port's `lrBalance` (`ns.ts:312`) is a
faithful line-for-line port of this logic (`edgeCv(e) !== 0 → skip`,
`delta = nsSlack(f)`, `delta <= 1 → skip`, `half = delta >> 1`,
`nodeLim` tie-break — all match C's `ED_cutvalue`/`SLACK`/`ND_lim`
semantics). What is **not** guaranteed identical between the two
implementations is *which* tree edges end up with `cutvalue === 0` and
*which* entering edge `enter_edge`'s DFS finds on a slack tie
(`enterEdge`/`dfsEnterInedge`/`dfsEnterOutedge` in `ns.ts:176-204`, mirror
of `enter_edge`/`dfs_enter_inedge`/`dfs_enter_outedge` in `ns.c`) — both
depend on the full spanning-tree state built by `feasible_tree`/`exchange`
over the ENTIRE aux graph (tens of thousands of nodes/edges across ~90
clusters in this real-world file), which is a `<` (not `<=`) tie-break on
minimum slack (`ns.ts:171`, `s < best.slack`) whose winner depends on
edge-list iteration order — itself a product of the cumulative
construction order of the whole aux graph, not just this one cluster's
local edges.

## Origin
- C: `lib/common/ns.c:778` (`LR_balance`) and its dependencies
  `enter_edge`/`dfs_enter_inedge`/`dfs_enter_outedge`
  (`lib/common/ns.c`, called via `rank(g, 2, nsiter2(g))` from
  `lib/dotgen/position.c:142`). Constraint construction that FEEDS this
  solve (verified faithful, NOT the origin):
  `lib/dotgen/position.c:354-368` (`contain_clustnodes`),
  `lib/dotgen/position.c:392-424` (`keepout_othernodes`),
  `lib/dotgen/position.c:431-484` (`contain_subclust`/`separate_subclust`),
  `lib/dotgen/position.c:869-870` (`dot_compute_bb`, reads the result).
- Port: `src/layout/dot/ns.ts:312` (`lrBalance`) and
  `src/layout/dot/ns.ts:199-204` (`enterEdge`) /
  `src/layout/dot/ns.ts:176-196` (`dfsEnterInedge`/`dfsEnterOutedge`), all
  called via `rank(...)`'s `balance === 2` dispatch (`ns.ts:461`).
  Constraint construction (verified faithful, NOT the origin):
  `src/layout/dot/position-cluster.ts` (`containNodes`, `containClustnodes`,
  `keepoutOthernodes`, `containSubclust`, `separateSubclust`) and
  `src/layout/dot/position-bbox.ts:72-86` (`dotComputeBb`).

## Causal chain
1. `dotPosition` builds ONE global aux constraint graph for the whole tree
   (not per-cluster) via `createAuxEdges`/`posClusters`, then solves it
   once with `rank(g, 2, nsiter2(g))` (balance mode 2 = LR_balance).
2. For `cluster_dtlsdec1`, the constraint set is: `containNodes` binds
   `ln`→sink-node and src-node→`rn` (weight 0, tight minimum), the
   `contain_clustnodes` compaction edge binds `ln`→`rn` directly
   (weight 128, minlen 1 — an aggressive "pull tight" edge),
   `keepoutOthernodes` binds neighboring same-rank nodes away from `ln`/`rn`
   (weight 0), `containSubclust` binds `ln`/`rn` inside the parent
   `dtlssrtpdec2`'s `ln`/`rn` (weight 0), `separateSubclust` binds
   `dtlsdec1`'s `rn` a fixed margin from sibling `srtpdec1`'s... wait,
   `srtpdec1.rn`→`dtlsdec1.ln` (weight 0, `separateClustPair`). All of
   this is confirmed byte-identical in port vs. C by cross-reading the
   C source function-by-function.
3. Given that constraint set, the true minimum feasible width for
   `dtlsdec1`'s `ln`↔`rn` is ~158pt (confirmed: the port converges there,
   and it independently satisfies every logged constraint by hand
   computation).
4. C's actual output is 4507pt — 28x wider, despite the weight-128
   compaction edge that should aggressively minimize this specific gap.
   Real member-node positions (`dtlsdec1_sink`, `dtlsdec1_src`) match
   between C and port exactly (same rank, confirmed by cross-referencing
   which OTHER real nodes at the same rank column sit at the identical
   x-coordinate in both C and the port's rank-14..24 dump) — so this is
   not a ranking divergence, only a `ln`/`rn` sentinel-position
   divergence.
5. `LR_balance` is the only stage that can WIDEN an already-tight,
   fully-constrained pair like this: it looks for tree edges with
   `cutvalue === 0` (structurally "free"/degenerate in the current
   spanning tree — i.e. removing them and re-optimizing changes nothing)
   and redistributes slack from a replacement entering edge onto them.
   If `dtlsdec1`'s `ln→rn` compaction edge (or an edge on its tree path)
   ends up as a zero-cutvalue tree edge in C's spanning tree — plausible
   given the LP has multiple equal-cost optima across this large
   degenerate graph — `LR_balance` will deliberately stretch it.
6. Whether a given edge is zero-cutvalue, and which entering edge
   `enter_edge`'s `<`-tie-break DFS picks as the replacement, is a
   function of the ENTIRE aux graph's spanning-tree construction order
   (`feasible_tree`/`exchange`, both in `ns.c`/`ns.ts`, upstream of
   `LR_balance`) — sensitive to edge-list iteration order across all
   ~90 clusters' worth of aux edges, not just `dtlsdec1`'s own. The port
   and C reach different spanning trees / different balance outcomes for
   this specific cluster in this specific large real-world graph, even
   though every constraint-generating function I checked is faithful.

## Ruled out
- **Rank assignment (rank.c-level) divergence**: node-to-rank bucket count
  matches exactly (33 x-buckets, from prior Block 3 evidence); directly
  confirmed for `dtlsdec1` specifically — its `sink`/`src` nodes share
  identical rank columns with `rtpfunnel1_sink`/`srtpdec1`'s sink nodes in
  BOTH C (x=4733.8/4820.8) and the port's rank-20/22 membership dump
  (`rk.n=4` at r=20 including `srtpdec1_..._rtp_sink`, `dtlsdec1_..._sink`).
  Same set of nodes, same rank, both sides.
- **Aux-edge constraint construction gap** (missing/extra `contain_nodes`,
  `keepout_othernodes`, `contain_subclust`, or `separate_subclust` edge):
  instrumented every function that touches a cluster's `ln`/`rn`
  (env-gated `cldbg2239` in `position-cluster.ts`/`position-bbox.ts`,
  fully reverted) for `dtlsdec1` + its tight-matching siblings + parent;
  every edge, weight, minlen, and recursion order matches the C source
  read line-by-line. The resulting minimum-feasible width computed from
  those exact constraints (158pt) is exactly what the port outputs —
  proving the port's own constraint set is internally consistent and not
  under-constrained.
- **`make_lrvn`'s label-height edge** (the one conditional edge inside
  `make_lrvn` that adds `ln↔rn` length for wide cluster labels): both C
  and port skip this branch under `rankdir=LR` (`GD_flip(agroot(g))` /
  `root.info.flip` true), confirmed by code inspection — not a factor
  here.
- **"childCount" symptom from prior mission note**
  (`.agent-notes/cluster-margin-rl-containment.md`): consistent with, not
  contradicting, this finding — a 28x cluster-width difference plausibly
  changes cluster-label word-wrap line counts (more `<text>` children in
  the wider C box), which would surface as a `childCount` diff in a
  DOM-structural comparator. That is a downstream symptom of this width
  mechanism, not a separate defect.
- **`LR_balance`/`enterEdge` port-fidelity as a literal bug**: read both
  `lrBalance` (`ns.ts:312`) and `enterEdge`/`dfsEnterInedge`/
  `dfsEnterOutedge` (`ns.ts:176-204`) against `lib/common/ns.c` line by
  line — cutvalue-zero check, slack computation, `delta<=1` skip,
  `delta>>1` vs C's `delta/2` (equivalent for the guaranteed-positive
  `delta` here), and `nodeLim` tie-break direction all match. This rules
  out a literal porting mistake in the balance/enter-edge code itself —
  the divergence is in the SPANNING-TREE STATE these functions operate
  on (built earlier by `feasible_tree`/`exchange`), not in their own
  logic.
- **Minimal hand-crafted repro**: not constructed. Given the mechanism
  traces cleanly to a `LR_balance`/`enter_edge` tie-break dependent on
  the FULL aux-graph's cumulative construction order across ~90 clusters,
  a small hand-crafted 2-3-cluster repro is unlikely to reproduce the
  specific tie condition (the same class was already shown in the 2521
  investigation to require the graph's *actual* scale/topology to
  manifest — small repros there converged identically). Time-boxed:
  not attempted further in this task.

## Fix target
```
{ fixTarget: "src/layout/dot/ns.ts (network simplex feasible_tree/exchange
    spanning-tree construction order feeding LR_balance/enter_edge tie-break)
    — NOT position-cluster.ts/position-bbox.ts/cluster.ts, all verified
    faithful constraint-graph construction",
  writeSet: ["src/layout/dot/ns.ts"],
  sharedMechanismWith: ["path-structure-rank-extent.md Block 1 (2521) — same
    network-simplex degenerate-LP/pivot-order class, there manifesting in
    rank.c's primary rank solve, here in position.c's cluster-position
    LR_balance post-process"],
  expectedVerdictDelta: "2239: diverged (maxDelta ~5287, width 6799 vs
    12078) -> unknown without a dedicated ns.c feasible_tree/exchange
    construction-order study; NOT a simple port omission",
  classification: "tracked-deep" }
```
This does not meet the shallow-fixable bar. Every constraint-generating
function outside `ns.ts` (contain_nodes, contain_clustnodes,
keepout_othernodes, contain_subclust, separate_subclust, dot_compute_bb,
make_lrvn) is proven byte-for-byte faithful to C via direct runtime
instrumentation plus source cross-read. `lrBalance`/`enterEdge` themselves
are also proven faithful line-by-line. The remaining divergence is in the
SPANNING-TREE STATE (`feasible_tree`/`exchange` in `ns.c`/`ns.ts`) that
those functions consume — for a real-world ~90-cluster aux graph with many
degenerate (zero-cutvalue) tree edges, tiny order-of-construction
differences elsewhere in the SAME global aux graph can steer which tree
edges end up degenerate and which entering edge wins a slack tie,
producing a materially different (but equally "correct" by LP-feasibility
standards) `LR_balance` outcome for an unrelated cluster far away in the
graph. Fixing this would require porting `ns.c`'s exact
`feasible_tree`/`exchange`/`enter_edge` node-and-edge iteration order at a
level of fidelity beyond function-signature matching (down to internal
list/array traversal order across the whole aux graph), a large dedicated
investigation — not a Batch 2 task. Recommend treating this as the same
tracked-deep bucket as 2521, and prioritizing a combined ns.c
pivot-order/spanning-tree-order investigation if this class is worth
pursuing (it appears to be the dominant remaining unexplained divergence
across at least 2521, 2239, and plausibly blok_60/2368 per prior notes).

## Re-verification (2026-07-06)
2239 height byte-matches (1045); WIDTH is ~half — oracle 12078 vs port 6799
(maxΔ 5279, the whole rank-axis extent since rankdir=LR makes x the rank axis).
Confirmed the compression is pure rank-x POSITIONING, not node sizing: 94/95
node box widths byte-match (the one "diff" is the graph outer polygon). Distinct
rank-x levels differ (oracle 69 vs port 71) and the x-gaps are non-uniformly
compressed (some match exactly — 114/66/87/187 — others halve: 299->172,
240->113, 246->199), with port gap=1 near-overlaps. So nodes land in different
ranks / cluster rank-axis spacing differs — the D6 "LR_balance slack over
feasible-tree state" tracked-deep finding. Core rank-assignment / cluster-rank
divergence, not a node-size or margin surface fix. Would need to instrument the
rank network-simplex feasible tree vs C for this cluster-nested LR graph.

## Re-verification #2 (2026-07-06, C harness) — NARROWED to edge-label rank gap
Built a C harness (scratchpad/2239/h.c, dumps ND_rank/ND_order/ND_coord/GD_bb;
see [[c-harness-raw-intermediate-dump]]) + port RANKDBG dump (dotLayoutPipeline
& dotLayoutComponent, post-dotPosition). Result over all 94 nodes:
- **Rank assignment is CORRECT**: rankDiff=0 (every node's ND_rank matches C).
- Node widths match (prior check). So NOT rank-assignment, NOT node sizing.
- The rank AXIS is x post-flip (C) = y pre-flip (port). Comparing rank-axis
  gaps: MOST match exactly (87.0, 253.5, 317.6, ...) — but exactly TWO gaps
  diverge 10×: rank 18→20 and 22→24 are ~2444 in C vs ~253 in the port. That
  ~2×2191 accounts for the bulk of the 5279 width shortfall (plus smaller
  0→2/2→4/4→6 diffs ~30-130).
- Those gaps sit at virtual half-ranks (19, 23). The C SVG renders multi-line
  edge labels there (Bitstream Vera Sans, e.g. x≈4107/4575 between rank-18 x2289
  and rank-20 x4733). So C reserves rank-separation space for the edge labels;
  the port reserves ~253 (near-minimal) — it is NOT accounting for these edge
  labels in the LR rank separation (10× under-reserve = structural, not a
  font-metric delta).

MECHANISM (localized, real bug): LR edge-label rank separation — dot inserts a
label virtual node on a half-rank and sizes the rank gap to fit it; the port
under-reserves for the multi-line \l labels on these edges. Next: compare the
port's make_label_edge / edge-label virtual-node insertion + its
rank-separation contribution (dot_position with GD_has_labels) against C for a
rank-18→20 labelled edge. Not attempted as a fix yet — focused LR-label
subsystem work.

## MAJOR FIX (2026-07-06) — LR cluster-label rank reservation
C harness (scratchpad/2239/hc.c, dumps GD_ht1/ht2/GD_border per cluster)
pinpointed the source: **cluster_dtlsdec1** (ranks 20-22) has a PEM-certificate
label → GD_border[RIGHT].y=4507.4, GD_ht1/ht2≈2210. C's set_ycoords reserves
that rank-axis room via `if (lbl && GD_flip) adjustRanks` → adjustSimple. The
port computed the SAME border (4507.4) but adjustRanksLabel bailed on
`if (!g.info.flip) return` — a CLUSTER subgraph's info.flip is never propagated
(undefined; only the root's is set), and C's adjustRanks does NOT gate on flip
(the outer `lbl && GD_flip` guard already ensures a flipped drawing; a non-flip
cluster has border[LEFT/RIGHT]=0 so `if(!lht)return` covers it). Fix: removed
the `if (!g.info.flip) return` guard (position-ycoords.ts adjustRanksLabel).
2239 width 6799 → 12078 (byte-match); maxΔ 5279 → 28.57. TDD:
cluster-label-flip-rank.test.ts (native-pinned 168x218). LESSON: subgraph
info.flip is NOT propagated — gate flip-dependent cluster logic on the ROOT's
flip (or don't gate, matching C).

## Residual (OPEN) — one edge's routing + label y (maxΔ 28.57)
After the width fix, 2239's sole residual is ONE edge (g[150]): its spline
takes a gentler curve than C's (C detours up to y≈-1173), its arrowhead is
~5.7pt off, and its edge-label sits at y=-510 vs C's -539 (Δ28.57). A distinct
edge-routing/label-placement mechanism (possibly the edge routing around the
now-reserved cluster-label space); 2239 stays diverged until it's resolved.
