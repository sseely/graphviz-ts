<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: cluster-expansion-recursion — expand single-node leaf clusters (defect C)

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

## Status
| Phase | Status |
|-------|--------|
| Instrument C expansion recursion vs port | [ ] |
| Fix recursion/removal | [ ] |
| Verify (1332 renders) + parity regen | [ ] |
