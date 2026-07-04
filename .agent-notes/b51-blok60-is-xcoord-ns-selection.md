# share-b51 blok_60 158px = x-coord NS degenerate selection (2371 class)

## Root cause CONFIRMED: degenerate x-coord network-simplex solution selection
- **Context**: root-causing share-b51 (diverged, maxΔ 158). Dominant divergence
  is node `blok_60` shifted 158px in x (center C=611.38 → port=453.38), same
  y/width; lone outlier (blok_58/59/61/62 match C exactly). blok_60 is a degree-2
  pass-through (`blok_59->blok_60->blok_61` only) inside `cluster_if_369`.
- **Cost-equality PROOF (this is the key result)**: blok_60's two edges go to
  blok_59 (center x=828) and blok_61 (center x=329). For two equal-weight edges
  the x-NS cost is `|x-828| + |x-329|`, which equals the span **499 for ANY x in
  [329,828]** (sum of distances to two points is constant between them).
  - C  x=611 → 217 + 282 = **499**
  - port x=453 → 375 + 124 = **499**
  IDENTICAL optimal cost. blok_60's x is genuinely DEGENERATE; C and the port each
  pick a different vertex of the optimal face [329,828]. NOT a wrong answer — a
  different optimal answer.
- **This is the [[2371-is-xcoord-ns-solution-selection]] class**, not a new bug.
  Per that note: both C and port run x-coord NS to optimality but select different
  optimal vertices, determined by aux-graph construction order
  (createAuxEdges / make_LR_constraints insertion order) and/or NS pivot sequence
  (enterEdge/leaveEdge). Matching C requires replicating that selection exactly —
  the deep, high-risk core (same as rank-NS pivot work).
- **Ruled out**: NOT a cluster-bound shift — only blok_60 moves; cluster_if_369
  and all its other nodes are correctly placed (a bound shift would move many
  nodes). NOT spline/label (node center itself moves). NOT font/A2 (whole-point,
  bbox matches). It is blok_60's INDIVIDUAL degenerate x within a correct cluster.
- **Secondary divergences** (pre-read: blok_70 30px, blok_20/23/47/48 ~27px,
  blok_78/79 26px) are very likely the same class (other degree-2 degenerate
  nodes); the spline piece-count diffs are downstream of the node x-shifts.

## Why blok_60 matters: a MINIMAL repro of the 2371 core
2371's divergence is a 30000-node mass effect — hard to instrument. blok_60 is a
SINGLE degree-2 node whose degenerate span [329,828] and the C-vs-port pick
(611 vs 453) are fully observable. It is the cleanest known entry point to
isolate the NS optimal-vertex-selection rule. Cracking blok_60 likely cracks 2371.

## ROOT CAUSE PINNED (paired C+port instrumentation, 2026-06-29)
Traced blok_60's x through the x-coord NS (rank2, balance=2) in BOTH C
(lib/common/ns.c) and port (ns.ts), gated XNSDBG + node name "blok_60":

| stage | C | port |
|-------|---|------|
| afterFeasibleTree | rank=88 low=549 lim=549 | rank=88 low=549 lim=549 |
| base optimum (after pivot loop) | 88 | 88 |
| **after LR_balance** | **463** | **305** |

- Feasible tree + base optimum + blok_60's tree position (low=lim=549) are
  IDENTICAL. The ENTIRE 158px divergence is inside **LR_balance** (ns.c:778 /
  lrBalance ns.ts:311). The 2371 note's "lrBalance == C verified" missed this.
- LR_balance walks `Tree_edge[i]` in order; for each cutvalue-0 edge it calls
  `enter_edge(e)`, takes `delta = SLACK(f)`, and reranks a subtree by `delta/2`.
- Logged EVERY rerank (i, e's lim, delta) in both. **First divergence is the
  FIRST rerank, i=48, on identical node state:**
  - C   : Tree_edge[48] = eLim(t=516,h=514), delta=43
  - port: Tree_edge[48] = eLim(t=459,h=442), delta=156
  DIFFERENT tree edge at the same list index → **the `Tree_edge` LIST ORDER
  differs between C and port.** (blok_60's lim matches, so it's not the lim
  numbering — it's the order edges sit in the Tree_edge list.)
- Consequence: LR_balance applies its balancing reranks in a different SEQUENCE,
  and since the optimum is degenerate (cost 499 for any x in [329,828]), the
  different sequence lands blok_60 (and the ~26-30px secondary nodes) on a
  different optimal vertex. blok_60: C +375→463, port +217→305.
- **The Tree_edge list is built by `feasibleTree`/tight_tree's edge-add
  traversal** (add_tree_edge order) and modified by pivot `exchangeTreeEdges`.
  The port's tight-tree edge-ADD ORDER diverges from C's `tight_tree`. THAT is
  the fix surface.

## Fix surface (mission): match C's tight_tree edge-add order
Replicate C's `feasible_tree`/`tight_tree` edge-add traversal so `Tree_edge`
list order matches C exactly (then LR_balance reranks in lockstep and selects
C's optimal vertex). Files: `ns-subtree.ts` (feasibleTree/tightTree),
`ns-core.ts` (Tree_edge list / add_tree_edge), possibly `ns-range.ts` (dfsRange).
HIGH regression risk: the x-NS tree construction runs for EVERY dot graph. Gate
with the full headless parity survey (XNS). This is the same core the 2371 mass
divergence needs — blok_60 is the minimal probe. Reproduce: XNSDBG instrument
ns.c rank2/LR_balance + ns.ts rank2/lrBalance (see git history of this branch's
session for the exact probes).

## Earlier framing (superseded by the pinned root cause above)
Paired C+port instrumentation of the x-coord NS for blok_60's aux node:
1. Dump blok_60's aux node rank (x) right after `rank(g,2,…)` in both — confirm
   611 vs 453 originates in the NS (expected; SVG already shows 453).
2. Dump the aux EDGES incident to blok_60's aux node + their insertion order in
   `createAuxEdges` (port `position.ts`) vs C `create_aux_edges` — the order
   drives which optimal vertex LR_balance lands on.
3. Dump the LR_balance pass (`lrBalance` ns.ts:311 vs `LR_balance` ns.c): which
   tree edge with cutvalue 0 is entered for blok_60, the slack `delta`, `half`,
   and the `nodeLim` direction test — this is where the 611-vs-453 pick is made.
HIGH regression risk (shared NS core touches every dot graph). Use the XNS survey
gate. Per [[conformant-is-the-bar]] this is a real tracked divergence, but the fix
is mission-level, not an ad-hoc edit.

## T0 FINDING (2026-06-29) — add-order divergence root-caused to labelVnode lw
Paired XNSDBG instrumentation of feasibleTree Tree_edge add-order (by GD_nlist
index, lim-independent), C ns.c vs port ns.ts, on share-b51 x-NS (balance=2).

**Add order is NOT a subtree-merge tie-break.** Build phase (283 subtrees, 297
tight_subtree_search edges, idx 0..296) is IDENTICAL C vs port. All 3 add-order
diffs are in the MERGE phase (idx>=297, inter_tree_edge):
- i=323 (27th merge): C edge (nlist 284->332), port edge (284->333)
- i=380: C (227->384), port (227->385)
- i=436: C (171->436), port (171->437)

`interTreeEdgeSearch` returns the first MIN-SLACK crossing edge; node 284's
out-list order is IDENTICAL [333,332] in both — so NOT createAuxEdges order. The
SLACKS differ: C slack(284->333)=427 > slack(284->332)=421 -> picks 332; port
slack(284->333)=420 < 421 -> picks 333. Root: node 333 (edge-label virtual node,
type=1) half-widths differ:
- C   : lw=7  rw=8   (lw = GD_nodesep(agroot)=7, rw = label dimen.x)
- port : lw=0  rw=7.786
minlen(4->333) = rw(tail)+lw(head)+nodesep = 1+lw(333)+7 = 15(C) vs 8(port);
slack(4->333)=0 in both -> rank(333)=rank(4)+minlen = 413+15=428(C) vs 413+8=421.
That rank-7 delta flips the min-slack pick. Same mechanism at nodes 385, 437.

**C rule:** `lib/dotgen/class2.c:label_vnode` sets `ND_lw(v)=GD_nodesep(agroot(v))`
(ROOT graph nodesep). Port `classify.ts:labelVnode` used `g.info.nodesep` — for a
label vnode created inside a cluster (cluster nodesep unset -> 0) this gave lw=0.

**Structured output for T1:**
{ divergentAddIndex: 323, cEdge: "(nlist284->nlist332)", portEdge: "(nlist284->nlist333)",
  cRule: "class2.c:label_vnode ND_lw(v)=GD_nodesep(agroot(v)) [root, not subgraph]",
  fixTarget: "src/layout/dot/classify.ts::labelVnode (lw = dotRoot(g).info.nodesep)" }

**FIX APPLIED & VERIFIED:** classify.ts labelVnode lw -> dotRoot(g).info.nodesep.
share-b51 blok_60 box now 395.38..539.38, matching C exactly (Δ0 on its coords;
the `points` string is character-identical). NOTE: the survey corpus verdict
named "conformant" is a deterministic ±0.01 numeric tolerance (compareSvg
'deterministic', test/golden/compare.ts), NOT literal byte equality — b51 as a
whole graph is a ±0.01 match. The subtree-merge files (ns-subtree/ns-core/
ns-range) were faithful; untouched.
