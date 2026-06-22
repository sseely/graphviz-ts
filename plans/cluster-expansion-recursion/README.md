<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: cluster-expansion-recursion — expand single-node leaf clusters (defect C)

> **Now a sub-reference of the unified `plans/cluster-subsystem/` mission.**
> Defect C lands together with membership (A/B), edge routing (D), and position
> (D2) — they are interdependent and gate merge on parity 0-regression.

## Type: fix (investigation-led)

Spun out of `cluster-membership-fix` Batch 2 (2026-06-22). Fixes **1332.dot**.

## Why this exists

After `cluster-membership-fix` Batch 1 (defects A+B), 1332's missing-`info.rank`
clusters drop from a large subtree to **3**, all single-node "label-wrapper" leaf
clusters:

```
clusterc4046  min12 max12  1 node (c4046)  parent cluster_6754
clusterc6378  min18 max18  1 node (c6378)  parent cluster_6754
clusterc6755  min33 max33  1 node (c6755)  parent root
```

A cluster's `info.rank` table is allocated **only inside `expandCluster`**
(`cluster.ts:204` → `allocateRanks`). These three clusters are **never
expanded**, so they have no rank table; the intercluster virtual chain through
them then breaks and `mapPathLongSingle` (cluster-path.ts:154) null-walks
(symptom — do not guard it).

The cluster-expansion driver is `mincrossClust` (mincross.ts:273, calls
`expandCluster`). C's `mincross_clust` recurses over `GD_clust` and has a
degenerate-cluster removal step (`mincross.c:340 --GD_n_cluster`) and recursion
(`mincross.c:545`). The port diverges somewhere in that recursion/removal for
single-node leaf clusters.

## Objective

`1332.dot` renders to SVG via `renderSvg(_, 'dot')`, faithfully to native C, the
3 leaf clusters get `info.rank`, full vitest suite green (0 regressions).

## Cases
- **1332.dot** — primary (deeply nested clusters, `compound=true`, `rankdir=LR`,
  many single-node label-wrapper clusters).

## First steps (investigation)
1. Instrument native C `mincross_clust`/`expand_cluster` + the cluster removal at
   `mincross.c:340` on 1332; dump which clusters are expanded and the recursion
   order. Diff against the port's `mincrossClust`.
2. Find why `clusterc4046/c6378/c6755` are expanded in C but skipped in the port
   (degenerate-cluster removal? recursion bound? single-node special case?).
3. Fix the recursion/removal faithfully so every cluster C expands is expanded.

## C reference
`lib/dotgen/mincross.c:mincross_clust` (recursion ~545, cluster removal ~340),
`expand_cluster`; `lib/dotgen/cluster.c:expand_cluster`/`build_ranks`.

## Method
Per CLAUDE.md "the C is sacred": instrument native C, diff intermediate state,
revert C instrumentation + rebuild before finishing. ADR-1 faithful (no guards),
ADR-4, ADR-5 (parity regen + 0 regression). See
`plans/cluster-membership-derisk/{findings,fix-plan}.md`.

## Investigation findings (2026-06-22, C-instrumented)

Native C `expand_cluster` (instrumented) on 1332: **66 clusters expanded,
including all 3 targets** — `clusterc4046`, `clusterc6378`, `clusterc6755` (each
`nNodes=1, nClust=0`). So C *does* expand single-node leaf clusters.

Port `expandCluster` on 1332: **68 expands, but none of the 3 targets.** The 3
appear in the post-layout cluster tree as children of `cluster_6754` (positions
23–24 of its 24 children) yet are never expanded → no `info.rank` → the
intercluster virtual chain breaks → `mapPathLongSingle` null-walk.

Tried + rejected: making `mincrossClust`'s recursion **re-read `n_cluster` each
iteration** (matching C `mincross.c:545`, since recursive expansion can append
clusters mid-loop). Did **not** fix it — the 3 clusters are still not recursed.
So they are absent from the parent's `clust`/`n_cluster` *at mincross time* (a
registration/re-parenting timing issue), not merely appended-during-loop.

Next step: instrument the **port's** cluster registration — `makeNewCluster`
(rank.ts:207, via `collapseCluster`) and any re-parenting — to find when
`clusterc4046/c6378/c6755` enter `cluster_6754.info.clust` and why that is after
`mincrossClust(cluster_6754)` recurses (or under a different parent). Compare the
registration order/parent to C. The `nodes.size===0` bail in `collapseCluster`
(rank.ts:303) and first-cluster-wins interaction (defect A) are prime suspects:
if a leaf cluster's only node is claimed by a sibling first, the leaf may be
mis-registered. NOTE: native `agnnodes` for these is 1 in C, so C keeps them.

## Status
| Phase | Status |
|-------|--------|
| Instrument C expansion recursion vs port | [x] C expands all 3; port expands none |
| Root-cause port registration/re-parenting timing | [ ] |
| Fix recursion/removal | [ ] |
| Verify (1332 renders) + parity regen | [ ] |
