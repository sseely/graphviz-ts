<!-- SPDX-License-Identifier: EPL-2.0 -->
# Fix-plan — scoped fix mission outline (P3)

This is the outline for a follow-on **fix mission** (`cluster-membership-fix`).
It is informed by validated experiments; no production fixes were committed here.

## Recommendation: one mission, two batches (B2 gated)

A+B are validated regression-clean and share one file; C needs one more
investigation step. Author one mission; if Batch 2 (C) exceeds its
investigation budget, spin C into its own mission.

## Batch 1 — A (membership) + B (skeleton count) → b53 + 1767

### T1 — `markClusters` prune foreign nodes (defect A)
- **Write-set:** `src/layout/dot/cluster.ts`, `src/layout/dot/cluster.test.ts` (new)
- **Change:** in `markClusters`, iterate a snapshot and, when
  `(n.info.ranktype ?? 0) !== 0`, remove `n` from the cluster's node set
  (mirror C `agdelete(clust, n)`; check whether incident-edge cleanup is also
  needed as C's agdelete does) before `continue`.
- **C ref:** `lib/dotgen/cluster.c:mark_clusters` (the `agdelete` branch).
- **AC:** `graphs/b53.gv` renders (was `containNodesRank` crash); cluster node
  sets match C owned-only (`cluster_1={f}` etc. for 1767); full suite 0 regr.

### T2 — `buildSkeletonEdgeCounts` fixed-`rl` (defect B)
- **Write-set:** `src/layout/dot/cluster.ts`, `cluster.test.ts`
- **Change:** compute `rl = subg.info.rankleader![v.info.rank]` once; bump
  `rl.out[0].count` `(hi-lo)` times. (Carried from `errored-cluster` deferral.)
- **C ref:** `lib/dotgen/cluster.c:build_skeleton` count loop.
- **AC:** `1767.dot` renders with T1 applied; full suite 0 regr.

> T1+T2 both touch `cluster.ts`; do them as one logical unit (or sequential
> with the suite between). Experimentally validated together: 2250 pass.

## Batch 1 outcome (executed 2026-06-22)

A+B implemented in `cluster.ts` (markClusters agdelete + buildSkeletonEdgeCounts
fixed-rl) with tests in `cluster.test.ts`. **1767.dot renders** (cluster sets
owned-only, matching native C); full suite **2253 pass, 0 regressions**. Commit
`c923f1a`.

**Correction:** the derisk validated b53 via *layout only* (`dotLayoutEntry`).
With A+B, b53 now passes layout but crashes in the **edge-routing** phase —
`maximalBbox` (edge-route-faithful.ts:133) reads `ranks[r].ht1` where `ranks[r]`
is undefined (a vnode whose rank is outside the root rank array). This is a
**separate pre-existing defect D**, exposed because A+B advance b53 past
position. So Batch 1 (A+B) fully fixes **1767 only**; b53 needs +D, 1332 needs +C.

## Batch 2 — C (leaf-cluster rank, 1332) + D (edge-route ht1, b53)  [GATED]

### T4 — defect D: edge-route corrupt vnode rank (b53)  [DEEPER THAN ESTIMATED]
- **Symptom:** `maximalBbox` (edge-route-faithful.ts:133) derefs
  `ctx.g.info.rank[vn.info.rank]` where `vn.info.rank = -183` (corrupt, not just
  out-of-range; deterministic). The vnode is the **edge-chain virtual node for
  the intra-cluster_node_43 edge `node_45(r0)→node_50(r2)`** (should be rank 1).
  It has a valid coord (y=245.125) and order (8) but a garbage rank.
- **Root finding:** `edge-route-faithful.ts` explicitly does **not** port cluster
  handling — its own header says *"Cluster bounds (cl_bound) in maximal_bbox are
  not ported; no batch-2/3 test graph has clusters."* b53 is the first cluster
  graph to reach this faithful router (A+B advance it past position). The chain
  vnode's rank is never correctly assigned for an intra-cluster edge under
  cluster-expanded ranking.
- **Scope:** this is **cluster-aware edge routing**, a substantial sub-mission
  (the faithful router needs cluster support + correct chain-vnode ranks for
  intra-cluster multi-rank edges). NOT a localized fix. Recommend a dedicated
  mission, not a batch here.
- **Next step:** trace where the `node_45→node_50` chain vnode's rank is set vs
  corrupted across rank/expand_cluster/merge_ranks/routing phases, against C.
- **AC:** `graphs/b53.gv` renders to SVG; full suite 0 regr.


### T3 — defect C: single-node leaf clusters never expanded (1332)  [DEEPER]
- **Root finding:** a cluster's `info.rank` table is allocated only inside
  `expandCluster` (cluster.ts:204 `allocateRanks`). The 3 missing-rank clusters
  (`clusterc4046/c6378/c6755`, single owned node, `min==max`) are **never
  expanded** — the cluster-expansion recursion (`mincrossClust`, mincross.ts:273)
  and/or C's degenerate-cluster removal (`mincross.c:340 --GD_n_cluster`,
  recursion `mincross.c:545`) diverge from the port. No `info.rank` → the
  intercluster virtual chain breaks → `mapPathLongSingle` null-walk (symptom; do
  not guard it).
- **First (investigation):** instrument C `mincross_clust`/`expand_cluster`
  recursion + the cluster-removal at mincross.c:340 on 1332; find why these leaf
  clusters are expanded in C but skipped in the port.
- **Write-set (provisional):** `src/layout/dot/mincross.ts` (mincrossClust
  recursion) and/or `cluster.ts`.
- **AC:** `1332.dot` renders; the 3 leaf clusters get `info.rank`; full suite 0 regr.
- **Scope:** cluster-expansion recursion — non-trivial; treat as its own mission.

## Batch 3 — verify + finalize
- Regenerate `test/corpus/parity.json` + `PARITY.md`; expect errored 8 → 5
  (b53, 1767 from B1; 1332 from B2) with **0 per-id regressions** (ADR-5 style).
- Update `plans/errored-cluster/` deferral pages (mark 1332/b53/1767 resolved).
- Memory: update `errored-cluster-rc2-rc3-are-membership` with the fix outcome.

## Quality gates (every batch)
```
- npm run typecheck   # exit 0 (TS6)
- npm test            # exit 0 (full suite ~2250)
- npm run build       # exit 0
- git diff --name-only matches the batch write-set
```
Oracle: native dot 15.1.0 at `~/git/graphviz/build/cmd/dot/dot`,
`GVBINDIR=/tmp/gvplugins`. Revert any C instrumentation + rebuild before finish.

## Architecture decisions (carry from errored-cluster)
- ADR-1 faithful C port, not guards. C ground truth is the spec.
- ADR-4 "stops crashing + faithful to C" is success even if it surveys
  `diverged` (these are heavily-nested cluster graphs; exact byte parity is not
  expected — like the 5 cases already fixed re-bucketed errored→diverged).
- ADR-5 parity regen + 0 per-id regression is the gate.

## Confidence
- **Batch 1 (A+B): high** — validated experimentally, 0 regressions, both in one
  file with clear C references.
- **Batch 2 (C): medium** — symptom precisely characterized; root cause needs
  one C-instrumentation step before the fix is certain.
