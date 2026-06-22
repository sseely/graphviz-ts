<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: cluster-edge-routing — cluster-aware faithful edge routing (defect D)

> **Now a sub-reference of the unified `plans/cluster-subsystem/` mission.**
> Defect D cannot merge alone — the membership fix it depends on is load-bearing
> and exposes other defects; everything lands together under cluster-subsystem.

## Type: fix (investigation-led)

Spun out of `cluster-membership-fix` Batch 2 (2026-06-22). Fixes **graphs/b53.gv**
and **2825.dot** (and likely other cluster graphs once they reach edge routing).

## Why this exists

After `cluster-membership-fix` Batch 1 (defects A+B), b53 passes layout and
position but crashes in **edge routing**: `maximalBbox` (edge-route-faithful.ts:133)
derefs `ctx.g.info.rank[vn.info.rank]` where `vn.info.rank = -183` — a corrupt,
deterministic rank on the **edge-chain virtual node for the intra-cluster_node_43
edge `node_45(r0) → node_50(r2)`** (it should be rank 1; it has a valid coord
y=245.125 and order 8 but a garbage rank).

The faithful edge router was never built for clusters — its own header states:
> *Cluster bounds (`cl_bound`) in maximal_bbox are not ported; no batch-2/3 test
> graph has clusters.*  (`edge-route-faithful.ts`)

b53 is the first cluster graph to reach this router (A+B advance it past
position). Two things are likely wrong: (1) intra-cluster multi-rank edge-chain
vnodes get a corrupt/unassigned rank under cluster-expanded ranking; (2)
`maximal_bbox` omits the C `cl_bound` cluster-bounds branch.

## Objective

`graphs/b53.gv` renders to SVG via `renderSvg(_, 'dot')`, faithfully to native C,
with the full vitest suite green (0 regressions).

## Cases
- **graphs/b53.gv** — primary (overlapping clusters, cross-cluster `dir=back` edges).
- Re-survey the corpus after the fix: other cluster graphs may now reach routing.

## First steps (investigation)
1. Trace the `node_45 → node_50` chain vnode's `info.rank` across phases
   (rank → mincross/expand_cluster → merge_ranks → routing) and find where it
   becomes `-183` (vs C's 1). Instrument native C edge routing for that edge.
2. Determine whether the corrupt rank originates in cluster expansion/merge or in
   the router itself. Fix at the source — do NOT guard `maximalBbox`.
3. Port the `cl_bound` branch of C `maximal_bbox` if b53 needs it.

## C reference
`lib/dotgen/dotsplines.c:maximal_bbox` (cl_bound branch), `make_regular_edge`;
`lib/dotgen/cluster.c:expand_cluster`/`merge_ranks` (chain vnode ranks).

## Method
Per CLAUDE.md "the C is sacred": instrument native C
(`gvplugin_dot_layout` → `/tmp/gvplugins`), diff intermediate state, revert C
instrumentation + rebuild before finishing. ADR-1 faithful (no guards), ADR-4
("stops crashing + faithful" = success even if `diverged`), ADR-5 (parity regen +
0 regression gate). See `plans/cluster-membership-derisk/{findings,fix-plan}.md`.

## Resolution (2026-06-22)

**The brief mis-scoped this as an edge-routing defect.** The corrupt vnode rank
(-468.875, a leftover x-position scratch from `make_LR_constraints`) was a
*symptom*: the real cause is in the **rank phase**. The port's `nodeInduce`
(rank.c:node_induce) was missing C's **first loop**, which agdeletes from a
cluster any node already claimed by an earlier sibling cluster (`ND_ranktype !=
0`, or contained in another of `par`'s clusters). The port only `continue`d,
keeping the foreign node, so the cluster's internal `dot1Rank` re-ranked it.

b53: `node_49` is owned by `cluster_node_43` (ranked there, rank 2) but is also
listed in `cluster_node_52` via `node_49 -> node_53`. The port let cluster_52
re-rank node_49 to 0 → cluster ranks collapsed (7 ranks vs C's 13, clusters not
stacked) → a cross-cluster chain vnode landed at `rank[1]` index 8 with `n=8`
(beyond the live count), so `set_xcoords` never restored its rank → routing
crash.

**Fix:** `pruneForeignClusterNodes` (ported C node_induce first loop, reusing
`agDeleteFromCluster` from defect C) — drops foreign nodes + their incident edges
before `dot1Rank(cluster)`. After the fix b53's rank structure is **byte-identical
to C** (all 13 ranks, exact per-rank `n` and membership). No `cl_bound` port was
needed — the corrupt rank was upstream, not in `maximal_bbox`.

## Status
| Phase | Status |
|-------|--------|
| Investigate corrupt chain-vnode rank | [x] traced to rank phase (node_induce missing foreign-node prune), not routing |
| Fix + cl_bound port | [x] `pruneForeignClusterNodes` in rank.ts/cluster.ts; cl_bound NOT needed |
| Verify (b53 renders) + parity regen | [x] b53 ranks match C exactly; parity errored 8→5, timeout 8→6, 0 per-id regressions; suite 2260 |
