# Architecture Decisions

## AD-1: faithful port of the reorder algorithm

**Context:** `fixLabelOrder` (`mincross.c:246`) detects interval-order
conflicts among a rank's flat-label vnodes and, if any backedge exists,
topologically reorders each connected component.

**Decision:** Port exactly — pairwise interval edges (`hi(v) ≤ lo(n)` →
v→n backedge; `hi(n) ≤ lo(v)` → n→v), the `haveBackedge` early-out,
`getComp` (DFS over in+out edges, counting backedges), `topsort` (repeated
source removal), `ordercmpf` (sort the captured order indices), and the
final `ND_order` + `rk.v[]` reassignment. No simplification.

**Consequences:** Matches C behavior bit-for-bit on the rare trigger.

## AD-2: model the per-rank aux graph as a lightweight TS structure

**Context:** C builds an `Agstrictdirected` graph `lg`/`sg` per rank. The
TS `Graph` class is heavy and carries layout state.

**Decision:** Represent the aux graph with a small local type — label-aux
nodes `{ lo, hi, np: Node, idx, x, out: Node[], in: Node[] }` and helpers
operating on arrays/sets. Mirror the C control flow (agnode/agedge/
agdelnode/agfstout/agdegree) with plain array ops.

**Consequences:** Avoids `Graph`/Agraph overhead; keeps the port
self-contained in `label-order.ts`. Strict (dedup) edges as C's
`Agstrictdirected`.

## AD-3: identify label vnodes via posAlg; lo/hi from out-edge heads

**Context:** C `checkLabelOrder` selects `ND_alg(u)`-marked nodes; lo/hi =
`ND_order(aghead(ND_out(u).list[0/1]))`. TS `flatNode` sets
`vn.info.posAlg = e` and creates 2 out-edges (vn→tail, vn→head).

**Decision:** A label vnode is `u.info.posAlg !== undefined`. `lo/hi` =
the `.info.order` of the heads of `u`'s first two out-edges, swapped so
`lo ≤ hi`.

**Consequences:** No new node field needed.

## AD-4: recResetVlists wiring is best-effort (cluster-only)

**Context:** C calls `rec_reset_vlists(g)` after `checkLabelOrder`; it
fixes cluster rank pointers and is a no-op without `GD_rankleader`
(clusters). The TS `recResetVlists(ctx, g)` needs a `MincrossContext` not
currently threaded to position-phase `flatEdges`.

**Decision:** Wire `recResetVlists` only if the ctx is readily available at
the `flatEdges` call site. If plumbing it exceeds the write-set, port the
reorder without it and document the gap (cluster + reorder is vanishingly
rare). Do NOT balloon the change — STOP and surface instead.

**Consequences:** The core reorder lands regardless; cluster vlist reset
may be a documented follow-up.

## AD-5: testing — deterministic unit test only

**Context:** The reorder triggers for 0/300 corpus graphs; the one known
trigger (`tests/2471.dot`) is a 35k-line HTML/cluster graph the TS port
can't render. No clean e2e oracle pin exists.

**Decision:** Correctness gate = a deterministic unit test of
`fixLabelOrder`/`checkLabelOrder` (construct vnodes with conflicting
intervals → assert the rank is reordered to interval order; non-conflicting
→ unchanged). The full golden suite must stay byte-identical (the reorder
fires for no golden).

**Consequences:** Verifies the algorithm without a realistic triggering
graph. Documented low practical impact.

## AD-6: rollback / compatibility

Reversible — revert the merge. No data/API/schema change. Additive: a rare
infeasible-order case gets corrected; all current output unchanged.
