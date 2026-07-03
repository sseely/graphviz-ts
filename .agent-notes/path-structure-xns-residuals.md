<!-- SPDX-License-Identifier: EPL-2.0 -->

# T4 — graphs-b51 / 2475_2 x-NS residuals: CORRECTED to rank-axis (not x-only)

## Mechanism
**graphs-b51's dominant divergence (node `blok_16`, Δ1096.4) does NOT
originate in the x-coordinate network simplex (`rank(g,2,…)`) as the task
brief assumed — it originates one phase EARLIER, in the PRIMARY rank
(Y-axis) network simplex** (`rank(g, balance, …)` called from
`dot1_rank`/`collapse_cluster` for the LOCAL ranking of cluster subgraph
`cluster_if_40`). `blok_16` is a degree-2 pass-through real node
(`blok_9->blok_16->blok_10`, both edges weight 1) sitting in `cluster_if_40`
alongside a longer parallel branch through the nested cluster
`cluster_if_52` (`blok_9->blok_11->blok_12->{blok_14,blok_15}->blok_13->
blok_10`). Because `blok_16`'s in-weight equals its out-weight, its rank
is a genuine **network-simplex degenerate optimum**: any integer rank in
`[rank(blok_9)+2, rank(blok_10)-2]` (minlen doubled to 2 by
`edgelabel_ranks` — this graph has labeled T/F branch edges) gives the
IDENTICAL total weighted edge length. This is the SAME degeneracy shape
already root-caused for share-b51's `blok_60`
([[b51-blok60-is-xcoord-ns-selection]]) and for corpus 1447
([[path-structure-1447]]/T3) — a degree-N pass-through node between two
fixed anchors with balanced in/out weight — but it fires on the **rank1
axis**, not the x-coord (rank2) axis, because `cluster_if_40` itself
contains a nested cluster (`cluster_if_52`), so
`dotgen/rank.c:456`'s `rank(g, GD_n_cluster(g)==0 ? 1 : 0, maxiter)` passes
`balance=0` for `cluster_if_40`'s local ranking — meaning **`TB_balance`
(the explicit rank-degeneracy tie-break, ns.c:814, the Y-axis sibling of
`LR_balance`) never runs for this call**. With no explicit balance step,
`blok_16`'s final rank is decided by whatever `feasible_tree` + the main
simplex pivot loop (`leave_edge`/`enter_edge`) leave it at — i.e. the exact
same `Tree_edge`/feasible-tree STRUCTURAL divergence already pinned as the
root mechanism for the x-coord sub-class, just observed via a different
symptom (an extra/different main-loop pivot instead of a different
`LR_balance` sequence).

2475_2 is a **mix of both sub-classes**: most divergent nodes (the
`419_75664/419_75665/419_75659/419_75451` family) show identical `cy`
(rank) C vs port with only `cx` differing — pure x-coord-axis degeneracy,
same as 1447/blok_60. But `190_86339`/`190_86340` have their `cy` values
literally **swapped** between C and port (`cy=-706.8`↔`-634.8`) while
`190_86338`/`190_86341` (their neighbors) keep matching `cy` — a rank-axis
swap, the same sub-class as graphs-b51's `blok_16`.

## Origin
- C reference (rank-axis sub-class):
  `lib/dotgen/rank.c:456` (`rank(g, GD_n_cluster(g)==0?1:0, maxiter)` —
  the `balance` argument that gates `TB_balance`) and
  `lib/common/ns.c:1007-1018` (`rank2`'s `switch(balance)`: case 1 =
  `TB_balance`, case 2 = `LR_balance`, default = no balance step at all).
  `lib/dotgen/rank.c:328-344` (`collapse_cluster`→`dot1_rank(subg)`, the
  recursive per-cluster local ranking call where `cluster_if_40`'s 7-node/
  7-edge subgraph — `blok_9, blok_11, blok_16, blok_12, blok_10` + 2
  synthetic cluster-leader nodes for the collapsed `cluster_if_52` — is
  ranked with `balance=0`).
- Port: `src/layout/dot/ns.ts::rank2`/`rank2Balance` (faithfully implements
  the same balance switch — verified by reading, matches C exactly) calling
  `src/layout/dot/ns-subtree.ts::feasibleTree`/`tightSubtreeSearch`/
  `interTreeEdgeSearch` (the SAME shared core already implicated for the
  x-coord sub-class in `.agent-notes/b51-blok60-is-xcoord-ns-selection.md`'s
  "ROOT CAUSE PINNED" section — "the Tree_edge list is built by
  feasibleTree/tight_tree's edge-add traversal... THAT is the fix
  surface"). This confirms the fix surface named there is broader than
  scoped: it affects EVERY `rank2()` invocation (primary local-cluster
  ranking at balance 0/1, AND the x-coord aux-graph ranking at balance 2),
  not just the x-coord phase.
- x-coord sub-class (2475_2's `419_*`/1447): unchanged from
  [[b51-blok60-is-xcoord-ns-selection]] — `lib/common/ns.c:778 LR_balance`
  / port `ns.ts::lrBalance`.

## Causal chain
1. `cluster_if_40` contains nested cluster `cluster_if_52` →
   `GD_n_cluster(cluster_if_40) != 0` → local ranking call uses
   `balance=0` → C's `TB_balance` (Y-axis degeneracy tie-break) never runs
   for this ranking pass.
2. `blok_16` is a degree-2 pass-through node with in-weight==out-weight →
   its rank is degenerate (multiple ranks give equal total NS cost) —
   verified directly: `GVBINDIR=/tmp/ghl dot -v2` on graphs-b51 shows this
   exact 7-node/7-edge subgraph's `network simplex` call completing in
   **`0 iter`** (the main pivot loop finds NO improving pivot — the
   `feasible_tree`'s FIRST tree is already simplex-optimal in C).
3. Paired port-side XNSDBG instrumentation (temp, in `ns.ts::rank2`, fully
   reverted) of the SAME 7-node/7-edge local-ranking call shows the port's
   `feasibleTree()` initially lands `blok_16` at the SAME local rank as C
   (rank=2, matching `blok_11`), but the subsequent `rank2Loop` (main
   pivot loop) THEN performs a pivot — tree edge `blok_9->blok_16` (slack
   0) is replaced by a different non-tree edge (`<anon>->blok_12`) — moving
   `blok_16` to rank=8 (adjacent to `blok_10`, matching `blok_13`'s rank).
   This is only possible if the port's computed cutvalue for
   `blok_9->blok_16` was negative (triggering `leaveEdge`), where C's
   cutvalue for the analytically-identical tree state was ≥0 (no pivot
   fired) — i.e. the port's `feasible_tree` built a STRUCTURALLY different
   spanning tree than C's (different tree-edge SET, even though the
   resulting ranks coincided at that snapshot), so the derived cutvalues
   differ and an extra "improving" (but cost-neutral, since the whole
   configuration is degenerate) pivot fires that C's tree never needed.
4. Because `blok_16`'s box is exceptionally tall (613px — a huge
   multi-line label), whichever rank slot it lands in inherits that height,
   reshuffling the pixel Y of every node between `blok_9` and `blok_10`
   even though `blok_9`/`blok_10` themselves (and, per the degeneracy
   proof, the total NS cost) are unaffected — producing the observed
   1096px node-position delta and the `bbox width` delta (-304, an
   unrelated but co-located divergence: the SAME rank swap changes which
   ranks are "wide", shifting downstream x-NS corridor widths).
5. 2475_2 exhibits the sibling x-coord sub-class (`419_*` family, rank/`cy`
   matches, only `cx` differs — same mechanism as 1447/blok_60, `LR_balance`
   sequencing under `balance=2`) AND at least one confirmed rank-axis swap
   pair (`190_86339`/`190_86340`, `cy` literally swapped) — same mechanism
   as graphs-b51's `blok_16`, just at smaller magnitude (adjacent-rank swap
   vs a 3-rank jump).

## Ruled out
- **Pure x-coord-only divergence** (the task brief's assumption): RULED
  OUT for graphs-b51 by direct SVG evidence — `blok_16`'s `y`-center is
  -7358.0 in C but -6261.6 in the port (a genuine RANK change, not a pixel
  artifact), confirmed by checking rank-mate `blok_11`'s C-side center
  (-7358.0, exact match to `blok_16`'s C center → same rank in C) vs the
  port where `blok_16`'s center instead matches `blok_13`'s port center
  (-6261.6 both) → different rank-mate in the port. `blok_9`/`blok_10`
  (the fixed span endpoints) have IDENTICAL centers C vs port
  (-7738.0/-5897.4 both), confirming total rank-span is unchanged — only
  `blok_16`'s position WITHIN that span differs.
- **A genuine correctness bug (wrong, not merely different, answer)**:
  ruled out via the degree-2 symmetric-weight cost-invariance proof (any
  rank for `blok_16` in its valid range gives identical total weighted
  edge length — the classic degenerate-LP-vertex pattern already accepted
  for blok_60/1447/2371) plus the direct `dot -v2` "0 iter" evidence that
  C's answer is ALSO not distinguished by the simplex objective (no
  improving pivot exists from either configuration).
- **TB_balance least-populated-rank tie-break as the mechanism**: ruled
  out — `TB_balance` (`ns.c:814`) is the explicit Y-axis balance step, but
  it is GATED OFF (`balance=0`, not `1`) for `cluster_if_40`'s local
  ranking specifically because it contains a nested cluster
  (`rank.c:456`). Confirmed via `dot -v2` output showing `balance=0` for
  the 7-node/7-edge call (line `network simplex: 7 nodes 7 edges
  maxiter=2147483647 balance=0`). The divergence is therefore in the base
  feasible-tree/pivot-loop structure, not a balance-mode selection rule.
- **CLASSIFY_WEIGHT_TABLE / omega weighting bug**: not applicable to this
  sub-class — the primary rank NS operates directly on original-graph edge
  weights (default weight=1 for both `blok_9->blok_16` and
  `blok_16->blok_10`), not the x-coord aux-graph's omega-weighted virtual
  chain; T3's note already independently verified the omega table is
  faithful for the x-coord sub-class.
- **labelVnode lw/rw misport** (the specific bug fixed for share-b51's
  `blok_60`, `classify.ts::labelVnode`): does not apply here — that fix
  targets `lw`/`rw` used by the X-COORD aux-graph's `minlen` computation
  (`create_aux_edges`/`position.ts::createAuxEdges`), not primary-rank
  `ED_minlen`, which is set uniformly by `edgelabel_ranks`'s `*= 2`
  (verified: this doubling is unconditional/graph-wide, not per-node, so
  it cannot itself cause an asymmetry between `blok_9->blok_16` and
  `blok_16->blok_10`, both labeled/unlabeled edges alike get the same
  ×2 treatment applied to ALL out-edges of ALL nodes).
- **2475_2 as purely x-coord-only**: ruled out by direct evidence — nodes
  `190_86339`/`190_86340` have literally swapped `cy` values between C and
  port while their immediate neighbors (`86338`/`86341`) keep matching
  `cy`. (Most OTHER divergent nodes in 2475_2, e.g. the `419_75664` family,
  ARE pure x-coord-only — `cy` identical, only `cx` differs — so 2475_2 is
  a genuine mix, not misclassified wholesale.)
- **Budget**: 2475_2's rank-axis instance (`190_86339`/`86340`) was
  confirmed only via SVG geometry (cy swap), not via paired C/port
  `ns.ts` instrumentation like graphs-b51's `blok_16` (24592-line input,
  per the task's budget guard) — the classification below extrapolates
  from graphs-b51's fully-instrumented proof plus the matching geometric
  signature, not from a second independent from-scratch derivation.

## Fix target
```json
{
  "fixTarget": "src/layout/dot/ns-subtree.ts::feasibleTree/tightSubtreeSearch/interTreeEdgeSearch (Tree_edge/feasible-tree structural add-order, shared by ALL rank2() callers — both dot1_rank's per-cluster local ranking at balance 0/1 AND position.ts::createAuxEdges's x-coord ranking at balance 2)",
  "writeSet": [],
  "sharedMechanismWith": [
    "b51-blok60-is-xcoord-ns-selection (share-b51 blok_60, x-coord axis)",
    "path-structure-1447 (T3: 1447, x-coord axis, no clusters/labels)",
    "2371-is-xcoord-ns-solution-selection (mass x-coord axis divergence)",
    "graphs-b51 blok_16 (this note, PRIMARY RANK axis — new sub-class)",
    "2475_2 190_86339/190_86340 (this note, PRIMARY RANK axis, same sub-class as graphs-b51)"
  ],
  "expectedVerdictDelta": "graphs-b51: diverged (maxΔ1096.4) -> structural-match|conformant IF the shared feasibleTree fix lands the port's Tree_edge structure identically to C's for degenerate rank1 cases too; 2475_2: diverged (maxΔ85) -> structural-match|conformant for the same reason plus the pre-existing x-coord sub-class fix; note the rank-axis divergence ALSO explains graphs-b51's -304px bbox WIDTH delta (a co-located but distinct-looking symptom of the same rank swap, not a separate bug)",
  "classification": "tracked-deep"
}
```

**Why tracked-deep, not shallow-fixable**: no input misport (weight,
minlen, lw/rw, omega table) was found — every input to the primary-rank NS
for `blok_16` is faithful. The divergence is a structural difference in
which spanning tree `feasibleTree`'s `tight_subtree_search`/
`inter_tree_edge_search` (`ns-subtree.ts`) builds during the MERGE phase
(same phase already implicated by the T0 add-order dump in
[[b51-blok60-is-xcoord-ns-selection]] for the x-coord case) — fixing it
requires replicating C's `tight_tree` edge-add/merge traversal order
exactly, which is the same deep, corpus-wide-regression-risk core already
flagged there ("HIGH regression risk: the x-NS tree construction runs for
EVERY dot graph"). This note additionally establishes that the SAME core
runs for the PRIMARY ranking pass too (any graph with nested clusters and
a degenerate-weight pass-through node is exposed, not just x-coord-heavy
graphs), raising the blast radius/regression-risk assessment for that fix
mission — gate with the full headless parity survey, not a subset.

## Repro
```bash
# graphs-b51 (fast, 213-line input)
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/graphs/b51.gv -o /tmp/gb51.c.svg
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/graphs/b51.gv dot > /tmp/gb51.port.svg
node test/diagnostic/flat-geom-diff.mjs /tmp/gb51.c.svg /tmp/gb51.port.svg
# C-side rank-axis confirmation (verbose network simplex, no C edits):
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -v2 -Tsvg ~/git/graphviz/tests/graphs/b51.gv -o /tmp/gb51.c.v.svg 2>/tmp/gb51.c.v.err
grep 'network simplex' /tmp/gb51.c.v.err   # cluster_if_40's 7-node/7-edge call: balance=0, 0 iter

# 2475_2 (24592-line input, ~slow)
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/2475_2.dot -o /tmp/2475_2.c.svg
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/2475_2.dot dot > /tmp/2475_2.port.svg
node test/diagnostic/flat-geom-diff.mjs /tmp/2475_2.c.svg /tmp/2475_2.port.svg
```

## F3 outcome (2026-07-03): mechanism REDIAGNOSED — NOT ns-subtree.ts/ns.ts

**F3's task premise (Tree_edge structural build-order divergence inside
`feasibleTree`/`tightSubtreeSearch`/`interTreeEdgeSearch`) is DISPROVEN for
graphs-b51's `blok_16`.** Root cause is a different, more fundamental, and
much broader-blast-radius bug: **subgraph node ITERATION ORDER**, not the
network-simplex core.

### Mechanism
- Origin: `src/layout/dot/classify.ts:143` (`class1`'s `for (const n of
  g.nodes.values())`) and `src/layout/dot/decomp.ts:130` (`decompose`'s
  `for (const n of g.nodes.values())`) — both iterate a JS `Map` whose
  iteration order is **subgraph-LOCAL first-insertion order** (the order a
  node was first mentioned *within this specific subgraph's textual scope*,
  set by `builder.ts:206` `g.nodes.set(node.name, node)` during parsing).
- C reference: `lib/cgraph/node.c:43` `agfstnode`/`:50` `agnxtnode` iterate
  `g->n_seq`, a dict ordered by `agsubnodeseqcmpf`
  (`lib/cgraph/node.c:283-290`), which compares by **`AGSEQ(sn->node)`** — a
  **GLOBAL, ROOT-graph-wide** monotonic counter assigned once at node
  CREATION (`lib/cgraph/node.c:162` `agnextseq(g,AGNODE)`), independent of
  when/which subgraph later adds that node as a member
  (`lib/cgraph/node.c:254` `agsubnode`, called later, does NOT re-touch
  AGSEQ). C's `agfstnode(subgraph)` is therefore **global-creation-order**,
  not "subgraph-local first-mention order".
- Both `class1` (`lib/dotgen/class1.c:69` `for (n=agfstnode(g);...)`) and
  `decompose` (`lib/dotgen/decomp.c:117` same pattern) — and, by the same
  reasoning, every other C function using `agfstnode(subgraph)` — depend on
  this GLOBAL ordering. The port's `Graph.nodes` Map does not track AGSEQ at
  all; it only tracks per-subgraph insertion order.

### Causal chain (graphs-b51 concretely)
1. `blok_10` (member of `cluster_if_40`) is GLOBALLY first mentioned at
   b51.gv:25 (`blok_10 -> blok_7;`, inside the earlier-opened `cluster_if_28`
   scope) — BEFORE `cluster_if_40` even opens (line 33). Its true AGSEQ is
   therefore lower than `blok_9`'s/`blok_11`'s (first mentioned lines 32/33).
2. `blok_10` only becomes a MEMBER of `cluster_if_40` later, at line 34
   (`blok_13 -> blok_10;`, inside `cluster_if_40`'s braces) — so the port's
   `cluster_if_40.nodes` Map inserts it 4th (after blok_9, blok_11, blok_13),
   not 1st.
3. This wrong-order node list feeds `class1`'s edge-processing order
   (changing WHICH aux/interclust1 edges get created in what sequence) and
   `decompose`'s DFS root-visitation order (changing `GD_nlist` structure).
4. For `blok_16`'s degenerate configuration (`cutvalue(blok_9->blok_16) ==
   cutvalue(blok_16->blok_10) == -9`, a TRUE tie under the LP), `leaveEdge`'s
   strict `<` first-wins tie-break picks WHICHEVER of the two tied edges sits
   earlier in `Tree_edge` — and that list's construction order is itself a
   downstream consequence of steps 1-3. Wrong node order -> wrong tie winner
   -> `blok_9->blok_16` gets pivoted out instead of staying, moving `blok_16`
   to a different (but LP-equally-optimal) rank than C's.
5. **`ns-subtree.ts`/`ns.ts` were proven faithful, not the origin.** Verified
   by full hand-execution of `tight_subtree_search`/`inter_tree_edge_search`/
   `merge_trees`/`STheap`/`leave_edge`/`enter_edge`/`x_cutval`/`dfs_cutval`
   against `lib/common/ns.c` line-by-line (matching exactly), AND by an
   isolated 7-node/7-edge repro (`/tmp/f3-repro.gv`, same local topology,
   correct/simple node order) rendering BYTE-IDENTICAL to C
   (`flat-geom-diff.mjs`: "0 element(s) diverge; max coord delta = 0.00").
   The isolated repro's C run also performs the SAME 1-pivot (E2 leaves,
   `<slacknode>->blok_12` enters) that the port performs on the FULL b51.gv
   — proving the NS core's pivot selection is correct GIVEN correct input
   order; the full-graph divergence is entirely an UPSTREAM ordering defect.

### Direct confirming experiment (evidence, not guess)
Temporarily patched (env-gated, since reverted) `class1`
(`classify.ts`) AND `decompose` (`decomp.ts`) to iterate
`[...g.nodes.values()].sort((a,b)=>a.id-b.id)` (`.id` is assigned in global
first-mention order by `builder.ts:107`'s `NodeRegistry.ensure`, a workable
AGSEQ proxy for files with no explicit node ids). Re-rendering graphs-b51
with BOTH patches active: **0 element(s) diverge; max coord delta = 0.00**
(byte-exact match, including `blok_16` and every downstream edge). Patching
ONLY `class1` (not `decompose`) left `blok_16`'s divergence UNCHANGED
(1096.40) — `decompose` builds `GD_nlist` from its own independent
`agfstnode` call and silently re-introduces the wrong order even when
`class1`'s input ordering is fixed. This proves the defect is NOT confined
to one function; it is the SAME systemic `g.nodes.values()`-as-agfstnode
substitution error, repeated at (at least) two call sites in two different
files, and very likely also in `cluster.ts` (`markClusters`, `nodeInduce`,
`clusterLeader` all use `g.nodes.values()` too — not yet verified needed,
but structurally the same risk) and possibly `rank.ts`/`rank-dot2.ts`.

### Ruled out (this task)
- **`ns-subtree.ts` Tree_edge build/merge-phase add-order** (F3's original
  hypothesis, inherited from the b51-blok60/T4 notes): DISPROVEN. Full
  line-by-line C-vs-port comparison of `tight_subtree_search`,
  `find_tight_subtree`, `inter_tree_edge_search`, `merge_trees`, `STheap*`
  found no divergence; a hand-executed simulation of the port's own code on
  the exact 7-node/7-edge topology reproduced the port's ACTUAL observed
  Tree_edge sequence exactly, and matches C's behavior on an isolated
  same-topology repro exactly (byte-for-byte SVG match).
- **`ns.ts`'s main pivot loop (`leaveEdge`/`enterEdge`/`nsUpdate`/`x_cutval`/
  `dfs_cutval`/`dfs_range`)**: DISPROVEN as the origin by the same isolated
  byte-exact repro — these functions, GIVEN correctly-ordered input, select
  the identical entering/leaving edge pair as C.
  `classify.ts::interclust1`/`class1Edge`'s AUX-GRAPH TOPOLOGY construction
  (minlen/weight/edge-set, as opposed to node ITERATION order): verified
  faithful by hand-deriving C's `interclust1`/`class1`/`mark_clusters` byte
  values and matching the port's dumped 7-node/7-edge input exactly.
- **The earlier T4 note's "C shows 0 iter, balance=0, 7 nodes 7 edges" claim
  as applying to `cluster_if_40` specifically**: this b51.gv contains SIX
  separate 7-node/7-edge `balance=0` network-simplex calls (multiple
  similarly-shaped nested-IF blocks elsewhere in the CFG dump), and the
  "0 iter" log line the earlier note keyed off almost certainly belongs to a
  DIFFERENT one of the six, not `cluster_if_40`'s. The isolated repro proves
  C actually performs 1 iter (a real, LP-mandated pivot) for `cluster_if_40`
  specifically — the earlier attribution was a mismatched log-line read, not
  a wrong mechanism per se, just misassigned to the wrong call site.

### Fix target (NOT this task — write-set violation, HARD STOP)
```json
{
  "fixTarget": "src/layout/dot/classify.ts::class1 (line ~143) AND src/layout/dot/decomp.ts::decompose (line ~130) node-iteration order — both need agfstnode/AGSEQ-faithful ordering, not g.nodes.values() subgraph-local insertion order. cluster.ts (markClusters/nodeInduce/clusterLeader) is the same risk class, unverified.",
  "mechanismClass": "Graph.nodes Map lacks an AGSEQ-equivalent global ordering; every C-mirroring function that walks agfstnode(subgraph) is exposed",
  "possibleImplementation": "Add a stable node.seq field (assigned in NodeRegistry.ensure at first global creation, same counter already used for .id in this codebase — verify .id truly always equals first-global-mention order, incl. any node-deletion/rename paths) and sort/iterate subgraph member lists by it wherever agfstnode/agnxtnode semantics are mirrored; OR back Graph.nodes with an order-preserving-by-seq structure at insertion time instead of sorting per call (perf: this is a hot path, called from class1/class2/decompose/markClusters for every cluster in every graph)",
  "sharedMechanismWith": ["b51-blok60-is-xcoord-ns-selection (T0's 'merge phase add-order' finding may ALSO trace to this same node-order root, not the labelVnode fix alone — re-examine after the systemic fix lands)", "path-structure-1447", "2239-cluster-rank-axis", "2371-is-xcoord-ns-solution-selection"],
  "expectedVerdictDelta": "graphs-b51: diverged (maxΔ1096.4) -> CONFIRMED byte-exact (0 diverge) once class1+decompose (+ likely cluster.ts) are fixed together; likely resolves some/all of the wider XNS-residual family (2475_2, 1447, 2239, blok_60/share-b51) since they share the identical class1/decompose/cluster.ts node-order substrate",
  "classification": "tracked-deep, HIGH regression risk (touches class1, class2-adjacent decompose, and cluster machinery — core to every dot graph with subgraphs), requires a dedicated mission with full survey gate, NOT a bounded single-task fix"
}
```

## F7 outcome (2026-07-03): systemic fix landed — graphs-b51 byte-exact

**F3's fix target is now applied everywhere it belongs.** Added
`nodesInSeq(g)` (`src/layout/dot/decomp.ts`) — `[...g.nodes.values()].sort((a,b)
=> a.id - b.id)` — and converted every genuine `agfstnode(g)`/`agnxtnode`
mirror across `src/layout/dot/` from raw `g.nodes.values()` to it. 44 call
sites converted across 15 files. `.id` was verified to faithfully mirror
AGSEQ for both node-creation paths (`NodeRegistry.ensure` — parser, and
`agnode`/`freshNodeId` — layout-time/`cgraph-ops.ts`); virtual nodes (id=0,
`fastNode`-only) never enter any `g.nodes` Map, matching C (never
`agnode`'d, so `agfstnode` never returns them).

### Result
- **graphs-b51: 0 element(s) diverge, max coord delta = 0.00** (byte-exact;
  was maxΔ1096.4). Confirms F3's controlled/reverted experiment.
- **share-b51, windows-b51: unchanged conformant** (0 diverge, byte-exact).
- **1447: unchanged** (85 elements diverge, max 192.39/COUNT-MISMATCH,
  identical before/after F7) — confirms this is the SEPARATE x-coord-NS
  sub-class ([[b51-blok60-is-xcoord-ns-selection]]), not touched by node
  order.
- **2239: unchanged** (158 elements diverge, max 254.62, identical
  before/after F7) — separate mechanism, not resolved by this fix.
- **2475_2: unchanged** (18127 elements diverge, COUNT-MISMATCH signature,
  identical before/after F7) — this specific corpus file shows a much larger
  divergence class than the T4 note's original sample (maxΔ85); not caused
  or changed by F7, root cause not re-investigated here (out of scope).
- Full survey/gate: see commit message for the run recorded at commit time.

### Fallout bug found and fixed: `cloneNode` id assignment
Converting `dotInitNodeEdge(aux.auxg)`/`dotRank(aux.auxg)` (flat-adjacent
edge routing pipeline, `splines-flat.ts`) broke
`#1949 — aux clone inherits the graph fontsize default` (a 2-node aux-graph
regression: wrong node ended up wider, `graphHeight` 124 vs expected 142).
Root cause: `src/layout/dot/splines-clone.ts::cloneNode` assigned the CLONE
node `orign.id` (the ORIGINAL node's id) instead of minting a fresh id local
to the aux graph. C's `cloneNode` calls `agnode(g, agnameof(orign), 1)`
(`lib/dotgen/dotsplines.c:871`), which mints a fresh AGSEQ scoped to the aux
graph `g`'s own creation sequence — it does NOT carry `orign`'s AGSEQ across
graphs. Since the flat-adj pipeline clones `auxt`/`auxh` in an order
independent of the originals' relative id order (`splines-flat.ts:167-169`),
carrying `orign.id` verbatim made `nodesInSeq(auxg)` sort by the WRONG
(borrowed, original-graph) id ordering instead of the aux graph's own
creation order. Fixed by calling `agnode(g, orign.name, true)`
(`model/cgraph-ops.ts`, mirrors C's `agnode(g,...,1)` exactly) instead of
`new NodeClass(orign.id, ...)`. This was a pre-existing bug, invisible until
F7 introduced a consumer (`nodesInSeq`) that relies on `.id` faithfully
mirroring AGSEQ; it is now fixed at its origin (`cloneNode`), not papered
over by excluding `auxg` from the `nodesInSeq` conversion.

### Site audit table

Format: site → C counterpart → converted?/reason.

**Converted (agfstnode/agnxtnode mirror, order affects observable output or
node/edge identity):**

| Site | C counterpart |
|---|---|
| `decomp.ts::decompose` | `decomp.c:decompose` (agfstnode) |
| `classify.ts::class1` | `class1.c:class1` (agfstnode) |
| `classify.ts::class2ProcessNodes` | `class2.c:class2` (agfstnode) |
| `cluster.ts::interclexp` | `cluster.c:interclexp` (agfstnode(subg)) |
| `cluster.ts::pruneForeignClusterNodes` | `rank.c:node_induce` loop 1 (agfstnode) |
| `cluster.ts::markClusters` (2 loops) | `cluster.c:mark_clusters` (agfstnode(g), agfstnode(clust)) |
| `cluster.ts::buildSkeletonCounts` | `cluster.c:build_skeleton` (agfstnode(subg)) |
| `cluster.ts::markLowclustersZap`/`markLowclusterBasic` | `cluster.c:mark_lowclusters`/`mark_lowcluster_basic` (agfstnode) |
| `conc.ts::infuseAllNodes` | `conc.c:rebuild_vlists` (agfstnode) |
| `init.ts::dotInitNodeEdge` | `dotinit.c:dot_init_node_edge` (agfstnode ×2, merged) |
| `init.ts::removeFill` | `dotinit.c:removeFill` (agfstnode(sg)) |
| `ortho-adapter.ts::buildOrthoGraph` | `ortho.c:orthoEdges` gather loop (agfstnode) — **dedup keep-first is order-sensitive** |
| `pack-components.ts::projectOne` | `ccomps.c:projectG` (agfstnode(subg)) |
| `pack-components.ts::cccompsWithClusters` (2 loops) | `ccomps.c:deriveGraph`+`cccomps` (agfstnode(g)) — **component `_cc_N` numbering is order-sensitive** |
| `mincross-build.ts::doOrderingForNodes`/`doOrdering` | `mincross.c:do_ordering_for_nodes`/`do_ordering` (agfstnode) |
| `rank-dot2.ts::d2unionAll` | `rank.c:union_all` (agfstnode) — **returned leader identity is order-sensitive** |
| `rank-dot2.ts::csProcessClusterNodes` | `rank.c:compile_samerank` cluster loop (agfstnode) |
| `rank-dot2.ts::compileNodes` (2 loops) | `rank.c:compile_nodes` (agfstnode) — **Xg node creation order, feeds NS** |
| `rank-dot2.ts::compileEdges` | `rank.c:compile_edges` (agfstnode) |
| `rank-dot2.ts::ccStrongCluster` | `rank.c:compile_clusters` (agfstnode) |
| `rank-dot2.ts::setMinMax2` | `rank.c:setMinMax` (agfstnode) — **leader tie-break is order-sensitive** |
| `rank-dot2.ts::readoutApplyMinrk`/`readoutShiftAll`/`readoutScanNodes` | `rank.c:readout_levels` (agfstnode ×3) |
| `sameport.ts::dotSameports` | `sameport.c:dot_sameports` (agfstnode) |
| `rank.ts::cleanup1VirtA`/`cleanup1VirtB` | `rank.c:cleanup1` (agfstnode ×2) |
| `rank.ts::edgelabelRanks` | `rank.c:edgelabel_ranks` (agfstnode) |
| `rank.ts::collapseRankset` | `rank.c:collapse_rankset` (agfstnode(subg)) — **UF representative identity is order-sensitive** |
| `rank.ts::induceClusterEdges` | `rank.c:node_induce` loop 2 (agfstnode) — **`clust.edges` push order is order-sensitive** |
| `rank.ts::nodeInduce` | `rank.c:node_induce` (agfstnode(clust)) |
| `rank.ts::dotScanRanks` | `rank.c:dot_scan_ranks` (agfstnode) — **leader tie-break is order-sensitive** |
| `rank.ts::clusterLeader` | `rank.c:cluster_leader` loop 2 (agfstnode(clust)) |
| `rank.ts::minmaxEdges2` | `rank.c:minmax_edges2` (agfstnode) |
| `rank.ts::expandRanksets` (main loop only) | `rank.c:expand_ranksets` (agfstnode) |
| `splines.ts::edgeNormalize` | `dotsplines.c:edge_normalize` (agfstnode) |
| `splines.ts::resetRW` | `dotsplines.c:resetRW` (agfstnode) |
| `splines-label.ts::placeHeadLabels`/`placeTailLabels` | `dotsplines.c:440-458` port-label loop (agfstnode) |
| `straight-edges.ts::findAllCycles` | `routespl.c:find_all_cycles` (agfstnode) — **DFS-start order feeds shortest-cycle tie-break** |

**Left unconverted (reasoned, not guessed):**

| Site | Reason |
|---|---|
| `edge-route.ts::orderedDotEdges` | Collected then `Array.sort(edgeRouteCmp)` with a total-order comparator (unique `Edge.seq`/AGSEQ tiebreak) — any initial order converges to the same result (documented in-file already). |
| `mincross-build.ts::allocateRanksCount` | Pure per-rank histogram (`cn[r]++`), commutative; C's `agfstnode` loop has the same order-independent effect (already documented in-file). |
| `mincross-build.ts::markOccupiedRanks` | Pure boolean-range OR/union, commutative; same reasoning. |
| `pack-components.ts::cccompsWithClusters` cluster-chain loop (`cl.nodes.values()`) | Different algorithm than C's `deriveClusters` (chained `ufUnionName` vs `dnodeSet` mapping) but produces the same order-independent equivalence classes. |
| `pack-components.ts::witnessCoord` | Port-only (no C counterpart) — picks any positioned node for a uniform rigid-shift delta; choice of node is immaterial. |
| `rank-dot2.ts` `Xg.nodes.values()` loops (`breakCycles`, `dfscc`/`connectComponents`, `readoutLevels` cleanup) | `Xg` is a flat, single-scope synthetic graph — every node is created exactly once via `makeXnode`, itself now driven by `nodesInSeq(g)` upstream, so `Xg.nodes` Map order already equals AGSEQ-equivalent order (documented in-file). |
| `rank.ts::expandRanksets` existence check (`.next().value`) | Used only for a null/existence test ("does g have any nodes"); no node identity is read from it. |
| `splines.ts::collectRankEdges` fallback branch | Documented defensive fallback, unreachable in normal C flow (a laid-out dot graph always has a rank table by this point). |
| `edge-order.ts` | Comment only — no `g.nodes` loop present (already routes rank-major). |
| `classify.ts::class2WeightClasses` | Already refactored to a single `g.edges` pass (commutative per-edge counter increments), no `g.nodes` loop present. |

### Ruled out (this task)
- **`.id` not mirroring AGSEQ, ripple beyond creation sites**: mostly ruled
  out — `NodeRegistry.ensure` (parser) and `agnode`/`freshNodeId`
  (`cgraph-ops.ts`, layout-time) both mint a global, monotonic,
  root-graph-scoped id at first creation, matching `agnextseq`. Virtual
  nodes (id=0) never enter any `g.nodes` Map (`fastNode` only touches
  `g.info.nlist`), matching C (never `agnode`'d). **One violation found and
  fixed**: `splines-clone.ts::cloneNode` copied `orign.id` instead of
  minting a fresh id — confined to that one function, fixed at its origin
  (see "Fallout bug" above), did not ripple further.
- **2475_2/1447/2239 residuals resolving as a side effect of F7**: ruled out
  — all three show byte-identical port output before and after F7 (verified
  via `git stash`/`git stash pop` A/B comparison), confirming they are
  driven by the separate x-coord-NS mechanism
  ([[b51-blok60-is-xcoord-ns-selection]]), not node iteration order.
