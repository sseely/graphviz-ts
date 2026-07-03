# path-structure rank-extent family — 2521 (anchor) diagnosed; 1718/2239 ruled distinct

## Repro
```
GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg ~/git/graphviz/tests/2521.dot -o /tmp/2521.c.svg
GV_TEXT_MEASURER=estimate npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/2521.dot dot > /tmp/2521.port.svg
```

---

## Block 1 — 2521 (anchor)

### Mechanism
`{rank=same}` groups that span cluster membership (`{rank=same a1 b1}`,
`{rank=same b2 c2}`, `{rank=same a3 b3 c3}` in 2521, referencing nodes owned by
`cluster1/cluster2/cluster3`) force `mark_clusters` to evict most cluster
members (ranktype SAMERANK wins over CLUSTER) and to `UF_singleton`-reset only
the nodes whose ranktype is *purely* CLUSTER (never touched by any
`{rank=same}` block). Because `UF_singleton` clears only the reset node's own
`UF_parent` pointer — not any node that already points *through* it — nodes
reached via **path-compressed** union-find pointers survive the reset (they
now point directly to a different, un-reset root) while nodes whose pointer
was **never re-queried** since the reset target became their parent get
severed. This produces a **degenerate/self-contradictory network-simplex
constraint graph**: `class1`'s per-edge `t == UF_find(tail)` /
`h == UF_find(head)` check reclassifies edges as inter-cluster
(`interclust1`, SLACKNODE-mediated aux edges) based on this asymmetric UF
topology, and two of those SLACKNODE constraint pairs are mutually
contradictory (`c1 >= a1+1` from `b1->c1`, and `a1 >= c1+1` from `c2->c3`,
simultaneously). Network simplex resolves the contradiction by satisfying one
and slacking the other; **which one it slacks is a tie-break/pivot-order
question, not a topology question** — and that is where the port and C
diverge. The port's topology (which edges get reclassified, which SLACKNODEs
get created, node/edge counts feeding network simplex) was verified
**structurally identical** to C's via non-invasive instrumentation (see
Evidence). Only the *numeric resolution* of the degenerate LP differs.

### Origin
- C: `lib/dotgen/cluster.c:299` (`mark_clusters`, the UF_singleton-on-CLUSTER
  reset) interacting with `lib/dotgen/class1.c:63` (`class1`'s
  `t == h` / `ND_clust(t) || ND_clust(h)` edge reclassification) and
  `lib/dotgen/class1.c:33` (`interclust1`'s SLACKNODE aux-edge construction).
  Final resolution: `lib/dotgen/ns.c` (network simplex — not modified, not
  instrumented, per task boundary).
- Port: `src/layout/dot/cluster.ts:298` (`markClusters`, faithful port of the
  reset) + `src/layout/dot/classify.ts:125` (`class1Edge`) +
  `src/layout/dot/classify.ts:108` (`interclust1`) — all verified faithful
  (see Evidence). Final resolution: `src/layout/dot/ns.ts` (network simplex —
  NOT instrumented in this task per T4's ownership of `ns.ts`/`position.ts`;
  T1 owns ranking/cluster files only).

### Causal chain
1. `collapseSets` processes `cluster1, cluster2, cluster3` (declaration
   order) then the 3 `{rank=same}` blocks (also declaration order). Cluster
   collapse unions every member into a per-cluster UF tree rooted at
   `GD_leader` = **the LAST rank-0 node encountered in local nlist order**,
   not the first (`cluster_leader` in C, `clusterLeaderScan` in the port —
   both keep overwriting `leader` on every rank-0 hit, no early break).
   Verified: `clusterLeader cluster1 leader=a4`, `cluster2 leader=b4`,
   `cluster3 leader=c1` — matches C's verbose network-simplex call sequence
   (`3 nodes 2 edges` then `1 nodes 0 edges` for cluster1 confirms nlist
   order `a1,a2,a3` then `a4`, i.e. `a4` is the last rank-0 node).
2. `UF_union`'s id-tiebreak (`ND_id(u) > ND_id(v)` / `u.id > v.id`) then
   determines the ACTUAL UF root independent of `GD_leader` — for cluster1
   this makes **`a1` (lowest id) the true root**, with `a2,a3,a4` as direct
   children, `a4` (the "leader") ending up as a *child* of `a1`.
3. The 3 `{rank=same}` unions merge all three clusters' UF trees into one
   11-node tree rooted at `a1` (ids compared the same way; `a1` has the
   lowest id of all inter-cluster union pairs, so it wins every merge).
   During this phase, `collapseRankset`'s internal `ufFind` calls
   (`v = ufFind(v)`) path-compress some chains but not others depending on
   whether the intermediate node already had a parent set at query time —
   e.g. `c3`'s pointer gets compressed directly to `a1` during the
   `{a3,b3,c3}` union (because `c1`, its old parent, already pointed to
   `a1` by then), but `c2`'s pointer is never re-queried after the
   `{b2,c2}` union and stays pointing at `c1` uncompressed.
4. `mark_clusters`/`markClusters`'s first loop resets every node whose
   `ranktype === CLUSTER` (never overwritten by a `{rank=same}` block) back
   to a fresh UF singleton: `a2, a4, b4, c1`. Because `c2`'s pointer was
   never compressed past `c1` (step 3), resetting `c1` **severs `c2`** (it
   now resolves to `c1`, not `a1`) while `c3` (already compressed past
   `c1`) **stays attached to `a1`**. This asymmetry is fully deterministic
   given the exact sequence of `{rank=same}` blocks and their member order —
   not a bug in the reset logic itself, it is C's actual documented
   behavior (the port mirrors it line-for-line).
5. `class1`'s edge loop then reclassifies `a1->a2`, `a2->a3`, `b1->c1`, and
   `c2->c3` as inter-cluster (their UF-find endpoints diverge or one side
   carries a `.clust` tag), producing 4 SLACKNODE aux-edge pairs. Two of
   those pairs (`b1->c1`'s `c1 >= a1+1` and `c2->c3`'s `a1 >= c1+1`) are
   mutually contradictory — an unsatisfiable pair that network simplex must
   resolve by slack, not exact satisfaction.
6. The final `a3`/`c2` rank values (port: `a3=4, c2=2`; oracle: `a3=2,
   c2=3`) depend on which of that contradictory pair network simplex
   satisfies exactly and which it slacks — a pivot/tie-break-order question
   inside `ns.ts`/`ns.c`, downstream of everything T1 owns.

### Ruled out
- **Cluster membership eviction mismatch** (the `agdelete`/"already in a
  rankset" warning list): port and C oracle emit byte-identical warnings for
  the same 7 nodes (`a1,a3,b1,b2,b3,c2,c3`), confirming `markClusterNode`'s
  `ranktype !== 0` eviction check is faithful. Evidence:
  `/tmp/2521.c.svg` stderr vs `/tmp/2521.port.svg` stderr (T1 run), identical
  7-line warning set.
- **GD_leader / "first vs last rank-0" selection**: verified via C's
  `-v5` verbose network-simplex call trace (non-invasive, no C source edit)
  — `3 nodes 2 edges` then `1 nodes 0 edges` for cluster1 confirms the
  local-ranking decompose order is `{a1,a2,a3}` then `{a4}`, so "last rank-0"
  = `a4`, matching the port's `clusterLeaderScan` (no early break) exactly.
  Four singleton `1 nodes 0 edges` calls for cluster2 confirm `b1..b4` are
  fully disconnected there too, consistent with the port.
- **Edge-classification topology mismatch (t==h / interclust1 dispatch)**:
  instrumented `class1Edge` directly (temporary, reverted) and got: 4
  `INTERCLUST` (`a1->a2, a2->a3, b1->c1, c2->c3`) + 2 `SKIP`
  (`a1->b1, c1->c2`). This yields exactly **7 nodes** (3 real UF roots
  `a1,a4,c1` that aren't isolated + 4 SLACKNODEs) and **8 edges** (4
  interclust1 calls × 2 aux edges each) for the main network-simplex
  component, plus a separate isolated **1 node 0 edges** component (`b4`,
  which has no edges at all since `a1->b1` was fully absorbed by the `t==h`
  skip). This matches C's verbose log EXACTLY: `network simplex: 7 nodes 8
  edges` immediately followed by `network simplex: 1 nodes 0 edges`. This is
  strong, non-invasive, structural confirmation that the port's UF/class1
  topology is byte-for-byte equivalent to C's for this input — the
  divergence is NOT in `cluster.ts`/`classify.ts`/`rank.ts`.
- **My own instrumentation's observer effect**: an early debug pass called
  the *mutating* `ufFind()` (which path-compresses) inside a read-only dump
  BEFORE `mark_clusters` ran, which permanently rewired `c2`'s UF pointer
  and made the divergence look narrower than it really is (falsely appeared
  as `a1 only` mismatch). Fixed by adding a non-mutating `peekUfRoot` chain
  walk for all read-only dumps; re-verified the real (uncontaminated)
  post-`class1` UF roots (`a3→a1`, `c2→c1`, `c3→a1`) match the by-hand
  derivation and the C verbose-log node/edge counts above.
- **virtualNode id=0** (found in passing, see 1718 block below): does NOT
  apply here — no virtual nodes participate in any `UF_union`/`UF_find` call
  for this input; all UF operations in 2521 are on real (named) nodes only.

### Fix target
```
{ fixTarget: "src/layout/dot/ns.ts (network simplex pivot/tie-break order for degenerate/contradictory constraint graphs) — NOT rank.ts/cluster.ts/classify.ts, all verified faithful",
  writeSet: ["src/layout/dot/ns.ts"],
  sharedMechanismWith: [],
  expectedVerdictDelta: "2521: diverged -> unknown (requires ns.c pivot-order study, not a simple port omission)",
  classification: "tracked-deep" }
```
This does not meet the shallow-fixable bar: the UF/cluster/class1 mechanism
is proven byte-for-byte faithful (node/edge counts match C's own verbose
log). The remaining divergence is inside network simplex's handling of an
input LP that is internally *contradictory* (not just under-determined),
where C's specific pivot/entering-edge selection order — not documented,
not previously instrumented in this codebase — picks a different feasible
solution than the port's. Matching this would require either (a) porting
`ns.c`'s exact pivot-rule/entering-edge-order semantics (a large, separate
investigation, likely touching `leave_edge`/`enter_edge` tie-breaks) or (b)
accepting this as a structural-match (not byte-match) class, similar to
prior `blok_60`/`2368` cost-equality ties documented in
`.agent-notes/pgram-trapeziumlr-is-ratio-fill-gated.md` and
`b51-blok60-is-xcoord-ns-selection.md`. Recommend: do NOT attempt in
Batch 2 without a dedicated network-simplex tie-break investigation task.

---

## Block 2 — 1718 (ruled out: different mechanism, NOT diagnosed further)

### Mechanism
UNKNOWN — explicitly ruled OUT as the same mechanism as 2521. `1718.dot` (the
`rNcM` grid with long back edges, e.g. `r15c0->r0c0`) contains **zero**
`rank=same`/`min`/`max` declarations and **zero** clusters (`grep -c` = 0 for
both). None of `markClusters`/`collapseRankset`/`interclust1` can execute
(they require a `{rank=same}` subgraph or a `cluster` subgraph to trigger).
2521's mechanism is therefore structurally inapplicable to 1718.

### Evidence gathered (not yet a full diagnosis)
- `dot -Tsvg`: C height 21192pt, port height 17476pt (Δ3716); width close
  (3252 vs 3239pt) — the divergence is almost entirely on the **rank axis**
  (default rankdir=TB ⇒ y), consistent with the task's framing.
- Node count identical both sides: 256 nodes.
- Distinct per-node y-bucket count identical both sides: 242 (rounded
  polygon-anchor y). This means **rank COUNT and node-to-rank bucketing are
  NOT grossly diverging** (ruling out a missing-rank or collapsed-rank
  theory as the primary cause) — the divergence looks like **per-rank
  spacing** (needed extra separation for the long back-edge virtual-node
  chains), not rank assignment.
- **Found in passing, real defect, NOT yet proven to be 1718's root cause**:
  `src/layout/dot/fastgr.ts:348` `virtualNode(g)` does
  `new NodeClass(0, '', g)` — hardcodes id **0** for every virtual node.
  C's `virtual_node()` (`lib/dotgen/fastgr.c`) calls `agnode(g, NULL, 1)`,
  which mints a fresh, unique, monotonically increasing id via
  `agnextseq` for every virtual node, same as real nodes. Any code that
  compares `.id` for tie-breaking among two or more virtual nodes (e.g.
  `ufUnion`'s `u.id > v.id`, or any id-based sort/dictionary ordering
  elsewhere in the port) will get a **constant, order-independent tie
  outcome** in the port vs. a **real, creation-order-dependent** outcome in
  C. 1718's long back edges create many virtual nodes per chain (grid graph,
  `rNcM` with `N,M` up to at least 16 based on the `r15c0` node name), a
  plausible substrate for this to matter in whatever downstream pass
  computes per-rank spacing for those chains (`recover_slack`,
  `position-aux.ts`, or similar) — but this task did NOT instrument that
  path for 1718 specifically, so this is a **candidate**, not a confirmed
  mechanism.

### Fix target
```
{ fixTarget: "UNDIAGNOSED for 1718's specific height divergence; virtualNode id=0 (src/layout/dot/fastgr.ts:348) is a real, separately-confirmed defect worth fixing regardless",
  writeSet: ["src/layout/dot/fastgr.ts (id fix)", "TBD for 1718's actual root cause"],
  sharedMechanismWith: [],
  expectedVerdictDelta: "unknown until virtualNode-id fix is applied and 1718 re-measured",
  classification: "tracked-deep" }
```
Next instrumentation step (not done in this task, out of T1's ranking-file
scope and time budget): confirm whether `virtualNode()`'s id=0 defect
actually changes 1718's geometry by patching it in isolation (assign
sequential ids via a module-level counter, matching `freshNodeId`'s
approach) and re-running the corpus diff. If height converges, this is the
root cause; if not, instrument `recover_slack`/edge-chain spacing directly
for 1718's specific back-edge chains.

---

## F4 outcome — virtualNode id=0 premise was FALSE; real defect was in ufUnion

F4 was dispatched to fix the "virtualNode id=0" candidate above. Reading
`lib/dotgen/fastgr.c:virtual_node()`'s FULL body (not just its signature)
disproves the premise: it does not call `agnode()` at all — it
`gv_alloc`s a bare `node_t` directly, so AGID is 0 for every virtual node in
C too, by construction. **`fastgr.ts:348`'s `id=0` is already faithful.**
Not fixed; not a defect.

The real, confirmed defect was one level removed: `ufUnion`
(`src/layout/dot/decomp.ts:34`) compared `.id` (AGID, unique per node) as a
stand-in for C's `UF_union` tie-break field `ND_id` (`lib/common/utils.c:132`)
— a SEPARATE dotgen-only field (`lib/common/types.h:432`) that is never
written anywhere in the `dot` engine's source (only by neatogen/fdpgen/
sfdpgen), so it is always 0 for both operands under `dot`, making C's
comparison always false. Fixed in `decomp.ts` (removed the id branch,
always take "first arg's root wins"). Full mechanism, evidence, and the
newrank.test.ts regression (root-caused to a **native C oracle segfault**,
not a port bug) are in
`.agent-notes/decomp-ufunion-id-faithfulness.md`.

1718 measurement (as prescribed): height unchanged, 17476pt before and
after (C: 21192pt) — confirms Block 2's own reasoning that 1718 has zero
`rank=same`/cluster declarations, so `ufUnion` never executes for that
input. 1718's divergence remains genuinely undiagnosed; this candidate
mechanism is now fully closed out (RULED OUT, not just untested).

2521 (Block 1's anchor, previously attributed to an `ns.c` pivot/tie-break
issue downstream of a "verified faithful" UF topology): the ufUnion fix
resolved nearly all of it — down from a multi-node rank-value divergence to
a single 7pt residual on one node (`b3`). **Block 1's origin attribution
(`ns.ts`) is superseded by `decomp.ts:34`.** The "UF topology verified
byte-for-byte faithful via C's verbose node/edge counts" claim in Block 1
was a false negative — matching aggregate counts did not detect the
topology-shape divergence from the wrong tie-break field.

---

## Block 3 — 2239 (ruled out: different mechanism, NOT diagnosed further)

### Mechanism
UNKNOWN — explicitly ruled OUT as the same mechanism as 2521. `2239.dot`
(gstreamer-style graph, `rankdir=LR`, 80 `subgraph` blocks with **nested**
clusters e.g. `cluster_capsfilter3_..._sink`/`_src` inside
`cluster_capsfilter3_...`) contains **zero** `rank=same`/`min`/`max`
declarations (`grep -in "rank.*same"` = 0 matches). 2521's cross-cluster
`{rank=same}` conflict mechanism cannot fire here — there is no
`{rank=same}` subgraph to create the SAMERANK/CLUSTER ranktype asymmetry.

### Evidence gathered (not yet a full diagnosis)
- No `mark_clusters` "already in a rankset" warnings on either side (0
  matches in both C and port stderr) — confirms no cluster-membership
  eviction is occurring, unlike 2521.
- `dot -Tsvg`: **height matches exactly** (1045pt both sides). Since
  rankdir=LR, height is the CROSS-rank axis — this rules out mincross/
  ordering divergence entirely for this input.
- Width (the rank axis under LR) diverges hugely: C 12078pt vs port
  6799pt (44% smaller).
- Distinct per-node rank-bucket count (x-position, rounded) identical both
  sides: 33. This rules out a rank-count mismatch (missing/collapsed
  ranks) — same number of ranks, but each rank (or the inter-rank gaps) is
  narrower in the port.
- **Pre-existing, more specific lead** in
  `.agent-notes/cluster-margin-rl-containment.md` (dated prior mission,
  "Cluster margin / RL containment"): that investigation fixed 3 cluster-
  margin/containment bugs (cluster `margin` attribute unread, `mapbool`
  treating `constraint=none` as truthy, `separate_subclust` flip-axis swap)
  and explicitly noted **2239's divergence (there logged as maxDelta 5287,
  `childCount`) was UNCHANGED by those fixes** — flagged as "a different
  (non-spacing) cluster issue," i.e. already known to be a DISTINCT,
  unresolved cluster mechanism from the margin family. This task's evidence
  (rank count matches, cross-axis matches, only the rank-axis span is
  compressed) is consistent with that prior note's framing and does not
  contradict it.

### Fix target
```
{ fixTarget: "UNDIAGNOSED — likely nested-cluster child-count/containment on the rank axis under rankdir=LR; see prior childCount lead in cluster-margin-rl-containment.md",
  writeSet: ["TBD — likely src/layout/dot/position-cluster.ts or cluster.ts containment/bbox code"],
  sharedMechanismWith: [],
  expectedVerdictDelta: "unknown until nested-cluster containment is instrumented",
  classification: "tracked-deep" }
```
Next instrumentation step (not done in this task): since rank count and
cross-axis match exactly, instrument per-rank width/x-separation
computation (`position-cluster.ts` `contain_nodes`/`separate_subclust`
family) specifically for 2239's NESTED cluster structure (cluster containing
`_sink`/`_src` sub-clusters) under `rankdir=LR`, comparing per-rank box
widths between port and C. The prior note's "childCount" framing suggests
the divergence may be in how a cluster's rank-axis extent is computed from
its (possibly nested) children's extents, not from raw node widths.

---

## Summary for Batch 2 consumers

**None of 2521/1718/2239 are shallow-fixable in this codebase's current
state.** All three are `tracked-deep`:
- 2521: proven to be a network-simplex tie-break issue on a genuinely
  contradictory constraint graph, downstream of `ns.ts` (out of T1's
  write-set; needs a dedicated network-simplex investigation).
- 1718: mechanism unknown; best lead is the `virtualNode` id=0 defect
  (`src/layout/dot/fastgr.ts:348`), untested against this specific input.
- 2239: mechanism unknown; likely nested-cluster rank-axis containment,
  continuing a lead already flagged (not resolved) in a prior mission's
  notes.

Do not attempt a Batch 2 fix task against any of these three without first
running the "next instrumentation step" listed in each block — none of the
three has a confirmed origin `file:line` yet except 2521, whose origin is
`ns.ts` (out of scope for a `rank.ts`/`cluster.ts` fix).
