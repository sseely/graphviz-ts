<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: 2371 divergence is x-coord network-simplex solution selection

- **Context**: 2371.dot (issue #2371 — historically a label R-tree area-overflow
  CRASH fix; the divergence is unrelated to that). 46929 lines, undirected
  graph{} of 30000 `point` nodes with explicit pos= (dot IGNORES pos and lays
  out its own 571825pt-wide graph) + 16925 labeled edges. Native 73s, port >180s.
  Parity diverged maxΔ 12524, firstDiffPath an edge path @d.
- **Finding**: the divergence is **x-coordinate assignment**, NOT spline routing
  or labels. Evidence (native vs port, K=1000 sub-graph):
  - dy = 0.0 for EVERY node → ranks/y-coords exact.
  - mincross node order exact: r2378st has the same in-rank ordinal (616) in both.
  - x diverges up to thousands of px (r844 by -7540, maxdx 2275-3613 on repro).
  - Spacing signature: native packs runs of nodes at 51px (= min node sep) with
    big gaps between; port spreads the slack evenly. Same ORDER, different x.
  - 3653/16925 edges differ in spline piece-count — DOWNSTREAM of nodes landing
    at different x (different routing corridors), not a fitter bug.
- **Verified faithful (ruled out as causes)**: omega/virtual_weight table
  [[1,1,1],[1,2,2],[1,2,4]] + epClass match C (mincross.c:1709 C_EE/SS/VS/VV =
  1/2/2/4); LR_balance (ns.ts:lrBalance == ns.c:778); nsiter2 both INT_MAX-uncapped
  for 2371 (no nslimit attr); ranks; mincross order.
- **Tested + reverted (NOT a contributor)**: classify.ts:75 `weight_class ?? 2`
  (C calloc-0 ⇒ should be `?? 0`/SINGLETON; the increment path uses `?? 0`). It's
  a genuine calloc-zero-vs-undefined faithfulness smell BUT changing it had ZERO
  effect on the 2371 repro (no node hits the unset default). Worth fixing
  separately + full-survey-verifying; not a 2371 contributor.
- **Root cause**: the x-coord LP has MULTIPLE optima (same ω-weighted cost,
  different x). Both C and the port run x-coord NS uncapped to optimality but
  select different vertices of the optimal face — determined by aux-graph
  construction order (create_aux_edges / make_LR_constraints edge insertion
  order) and/or the NS pivot sequence (enter_edge/leave_edge/init_cutvalues).
  Matching C requires replicating that selection exactly — the deep, high-risk
  core (same class as the rank-NS pivot work; see [[ns-hotpath-ninfo-slowmode]],
  [[2471-blocker-is-cluster-ranking]]).
- **Fast repro toolkit** (scratchpad, also reproducible):
  - `extract.mjs K` → `2371_kK.dot` = first K rows + red mid--mid edges among
    them (self-consistent sub-graph). K=1000 ⇒ 1.25s, maxdx 2275; K=4000 ⇒ 20s.
  - `2371_k1000v.dot` = mids made visible (strip style=invis; invis doesn't
    affect layout) so node x is observable. maxdx 3613 @ r4197mid, 1.25s.
  - `cmp.sh <name>` renders native (headless oracle) + port and reports max
    node dx/dy.
- **Side find**: two orphaned native `dot -Tsvg 1864.dot` processes had been
  pegging 2 CPU cores for 11-14h — the real driver of this session's "thermal"
  bench inflation (contention, not heat). Killed.
- **Confidence**: High on the diagnosis (x-coord NS solution selection);
  the specific pivot/order contributor is not yet isolated.

## UPDATE: root is mincross combination effect, not single-component layout

DUMP_AUX instrumentation (per-rank virtual-node order, C position.c+mincross.c,
port position.ts+mincross-order.ts — ALL REVERTED, oracle rebuilt clean) on the
K=400 sub-graph proved:
- Proper-graph TOPOLOGY identical (n + virtual COUNT per rank match); only the
  virtual ORDER positions differ. First global divergence rank R4: one virtual at
  order 10(C) vs 11(port), cascades.
- Divergence present from build_ranks (initial order), not just iterative
  median/transpose — but only in a few components at init.
- DECISIVE: split K=400 into its 15 connected components (union-find over edges;
  216 isolated rows + comps of size 2/3/4/8/14/14/122). EVERY component rendered
  ALONE matches C exactly (maxdx=0), including the 122-row one. Subsets match too
  (122+all-small ✓, 8+14+14+all-small ✓, big-3 ✓). Only the FULL set of 15
  combined diverges (maxdx 651). So it's a mincross ordering tie-break that flips
  only when many disconnected components interleave in the shared rank structure
  at scale — NOT a single-component bug, NOT x-coord NS, NOT decompose.
- Fast repro: scratchpad/combo_all.dot (552 nodes, 0.38s, maxdx 651). Tooling:
  comps.mjs (union-find splitter), combine.mjs (recombine), cmp.sh.
- NEXT (deep): dump per-mincross-iteration order on combo_all, find the first
  iteration/transpose/median tie-break where C and port pick differently among
  equal-crossing options. Candidate sites: build_ranks BFS source/component
  iteration order; mincross_step transpose tie-break (reorder on equal crossings);
  medians/wmedian tie-break. This is the classic mincross tie-break-matching
  problem — deep, but now isolated to a 0.38s repro.

## UPDATE 2: root is multi-component mincross context (construction order MATCHES)

Deeper DUMP_AUX instrumentation (named per-rank order at build_ranks entry +
create_aux_edges; GD_nlist order at build_ranks entry — all in C
position.c/mincross.c + port position.ts/mincross-order.ts/mincross-build.ts;
ALL REVERTED, oracle rebuilt clean):
- GD_nlist order at build_ranks entry: **IDENTICAL** (1033 nodes, 0 diff) →
  graph CONSTRUCTION order (class1/class2/decompose/nlist) is NOT the bug.
- build_ranks source iteration (buildRanksSources/FindStart) + BFS
  (buildRanksBfs FIFO + enqueueNeighbors): faithful to C.
- combo_all final global named order diverges in 8 of 21 ranks, a few nodes
  each (R2 5/217, R4 8/27, R10 16/29, R12 24/43...). All swapped nodes are
  MID nodes of ONE component (the size-122 blob, union-find root 8718).
- DECISIVE: that 122-component rendered ALONE has IDENTICAL mincross order in C
  and port (0/21 rank diffs). Combined with the other 14 components it diverges.
  So the bug is in MULTI-COMPONENT mincross context: a component's mincross
  result depends on the others. dot_mincross processes components via the
  GD_comp loop (init_mccomp per comp → mincross → merge2). merge2 does NOT
  re-interleave (just finalizes GD_rank[r].av + sets ND_order). So the divergence
  enters via init_mccomp's per-component rank-window setup and/or a global op
  inside the per-component mincross (the build_ranks-end `transpose(dot_root)`,
  or ncross/medians reading cross-component rank context).
- RULED OUT (all faithful/identical): x-coord NS, omega/balance/itercap,
  ranks/y, single-component mincross, decompose topology, nlist construction.
- NEXT (concrete, deep): instrument init_mccomp (C mincross.c:413) + the port's
  per-component setup — dump each component's GD_rank window offset + the
  build_ranks-end transpose effect — on combo_all, to find where the 122-comp's
  order first diverges under multi-component context. The port already has a
  `setMincrossTrace` hook (mincross-order.ts:28) for per-iter crossing
  trajectory diffing — usable here. This is the classic mincross tie-break
  matching problem; a clean faithful fix is not guaranteed.
- Repro: scratchpad/combo_all.dot (552 nodes, 0.38s, maxdx 651). Component
  splitter comps.mjs / recombiner combine.mjs / cmp.sh harness all in scratchpad.

## UPDATE 3: narrowed to flat-edge handling in mincross (install matches!)

Exhaustive staged DUMP_AUX instrumentation on combo_all (all reverted, oracle
rebuilt clean) — each stage keyed by per-rank named order or absolute install
position:
- ZERO crossings everywhere: C `dot -v` shows cur_cross=0/best_cross=0 for all
  236 mincross calls. So mincross_step is a no-op and the build_ranks-end
  `transpose` (gated `ncross()>0`) never runs. Order is decided WITHOUT crossing
  minimization.
- `decompose`: IDENTICAL (199 components, same order, same per-component node
  order). Construction/component extraction is NOT the bug.
- `build_ranks` install: IDENTICAL — dumped every install_in_rank as
  `INST <name> r<rank> abs<physical-pos>`: 1428 installs, 0 diff. BFS install
  places every node at the same absolute position in C and port.
- BUT order at `dot_position` ENTRY (`__MC__`, right after dot_mincross, after
  set_ycoords) DIVERGES (8 of 21 ranks). And it stays diverged at create_aux_edges.
- So the reorder happens BETWEEN build_ranks install and end of dot_mincross —
  i.e. in the flat-edge handling (`flat_breakcycles` → `flat_reorder`), the only
  node-reorderer that runs at 0 crossings. (merge2/cleanup2 are faithful;
  set_ycoords doesn't reorder.)
- `flat_reorder` / `postorder` / `constraining_flat_edge` are all structurally
  FAITHFUL to C (verified line-by-line). The diverging nodes (r2119mid, r4850mid,
  r6670mid…) have NO flat edges themselves — they're reordered via flat_reorder's
  temprank append path when OTHER R2 nodes have flat edges. So the bug is in the
  INPUT to flat_reorder: the constraining-flat-edge SET or the flat_out/flat_in
  list ORDER, as produced by flat-edge construction + `flat_breakcycles`
  (flat_rev / flat_search / the FLATORDER edges).
- DISCREPANCY SPOTTED (not yet proven causal): port `placeInRankSlot` sets
  `ND_order = vStart + n` (ABSOLUTE) while C install_in_rank sets `ND_order = i`
  (window-RELATIVE). merge2 overwrites order later so likely benign, but worth
  ruling out — flat_reorder's `base_order = ND_order(v[0])` and the
  `ND_order(aghead) < ND_order(agtail)` flat-LR test read ND_order mid-stream.
- NEXT (concrete): dump the per-rank constraining-flat-edge set (tail→head pairs)
  + flat_out/flat_in list order at flat_reorder entry on combo_all, C vs port, for
  rank R2's component; and dump flat_breakcycles' flat_rev/delete decisions. The
  first differing flat edge is the root. Also test the ND_order absolute-vs-window
  fix in placeInRankSlot. Repro: scratchpad/combo_all.dot (0.38s).

## UPDATE 4: median int/float rounding bug FOUND+FIXED; 2371 residual is deeper

Correction to UPDATE 2/3: combo_all is NOT 0-crossings everywhere — that was a
sampling error (first 20 verbose lines). C `dot -v` shows components with up to
477 crossings and 30 pass-1 iterations. So the diverging component (m8718, the
122-mid blob) DOES run mincross_step (median+reorder+transpose). The R2 reorder
swaps r2119mid/r4850mid differently.

ROUNDING BUG FOUND (per user hint "watch for int/float"): C `median`
(mincross.c:1650,1663) operates on an int[] (VAL = MC_SCALE*ND_order+port.order,
MC_SCALE=256), so:
- n==2 case `(list[0]+list[1])/2` is INTEGER division
- equal-span case `(list[lm]+list[rm])/2` is INTEGER division (and the port was
  MISSING this special case entirely)
The port's computeMedian did FLOAT division in both → x.5 mvals that perturb the
reorder sort. FIXED (mincross-order.ts:computeMedian) with Math.trunc + the
lspan==rspan special case. Faithful to C. 58 mincross unit tests pass.

BUT: the fix is a NO-OP on combo_all (maxdx 651 unchanged) — 2371's diverging
reorder ties don't hit the n==2/equal-span cases (they hit the weighted-median
path, which is double in both and already matches). So the median fix is a real
faithfulness improvement (validated corpus-wide via survey) but NOT 2371's driver.

VERIFIED FAITHFUL (entire mincross_step): mincross_step (reverse parity, bounds,
direction), medians, reorder (bubble-pass p1>p2||(p1>=p2&&reverse)), transpose
(integer crossing deltas, shouldSwap, p.x tiebreak), exchange, ncross. Line 1276
int division is the cluster-flip path (GD_flip, no clusters here → dead).

2371 RESIDUAL (empirical, not yet pinned to a line): each component renders
IDENTICALLY alone; combined, the high-crossing component's mincross keeps a
DIFFERENT pass — C retains pass-1 build order (out-edge sources), port retains
pass-0 (in-edge sources). Install positions for BOTH passes are conformant
C vs port; the divergence is in which pass's post-mincross_step order is saved/
restored (save_best/restore_best vs ncross during multi-component processing).
This is the deepest mincross convergence layer — a genuine tie/convergence-path
difference, NOT int/float. Next: dump cur/best at each save_best decision per
component, C vs port, to find the first differing save/restore.

## RESOLVED: ncross NaN in multi-component rcross (root cause of BOTH 2371 + 2669)

The 2371 residual (and 2669, maxΔ378) is the same bug: the port's `ncross`
returns NaN for components c>0, so `cur <= best` is always false (NaN compares
false), `save_best` never fires, best stays MAX_SAFE_INTEGER, and the per-
component mincross order is never optimized → diverges from C.

Pinned via the existing `setMincrossTrace` hook vs C `dot -v` on 2669 (small
8-component repro): trajectories match until a component prints
`cur_cross NaN best_cross 9007199254740991`.

Root: `rcross` (mincross-cross.ts) builds `Count = new Array(rootRank[r+1].n+1)`
— sized to the component's rank count during per-component processing — then
indexes it by `e.head.info.order`. But this port stores ND_order ABSOLUTE
(placeInRankSlot = vStart + n) where C stores it window-RELATIVE
(install_in_rank: ND_order = GD_rank[r].n). For component c>0 the absolute head
order exceeds the component-sized Count array → Count[inv] undefined → NaN.
(Confirmed: probe showed `inv=17 Count.len=11`.)

FIX (mincross-cross.ts:rcross/rcrossCount/rcrossRegister): subtract the head
rank's window offset `gRank[r+1].vStart` so Count is indexed by the relative
order, matching C. Same vStart-window compensation pattern the port already
uses elsewhere (rankGet); rcross was the one site missed.

RESULT: 2669 maxΔ 378→0 (exact). 2371 combo_all 651→0, k1000v 3613→0 (exact).
All 2417 tests pass, typecheck clean, 58 mincross tests pass. Survey validating
corpus-wide (expected to fix many multi-component graphs).

NOTE: the median int/float fix (committed 89756df) was a real C-faithfulness fix
but a RED HERRING for 2371/2669 — the NaN is the actual driver. Both kept.
