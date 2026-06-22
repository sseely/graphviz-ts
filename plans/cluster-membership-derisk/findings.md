<!-- SPDX-License-Identifier: EPL-2.0 -->
# Findings — per-case first divergence (P1)

Method: native-C `build_skeleton`/`mark_clusters` instrumented (rebuilt
`gvplugin_dot_layout`, `/tmp/gvplugins`), diffed against the port at the same
phase. Experimental port fixes applied/reverted to validate causality (the port
is back at HEAD — investigation only). Full vitest suite run with the candidate
fixes to measure regressions.

## Three distinct defects (A, B, C)

| Defect | Site | Cause | Cases needing it | Validated |
|--------|------|-------|------------------|-----------|
| **A** membership | `cluster.ts:markClusters` | skips already-claimed nodes but never removes them from `clust.nodes`; C does `agdelete(clust,n)` | b53, 1767, (1332) | ✅ fixes b53; necessary for 1767 |
| **B** skeleton count | `cluster.ts:buildSkeletonEdgeCounts` | bumps `rankleader[r]` per r; C bumps a FIXED `rl=rankleader[ND_rank(v)]` | 1767 | ✅ with A → 1767 renders |
| **C** leaf-cluster rank | cluster rank-table install (ranking/`build_ranks`) | single-node "label-wrapper" leaf clusters never get `info.rank` → intercluster virtual chain breaks | 1332 | ⚠️ partially root-caused |

**A+B together: full vitest suite 2250 pass, 0 regressions.** b53 and 1767 both
render with A+B alone.

## Defect A — cluster membership (the headline)

C `mark_clusters` (cluster.c) iterates each cluster's nodes and, for any node
already claimed by an earlier cluster (`ND_ranktype(n) != NORMAL`), calls
**`agdelete(clust, n)`** — removing it from the later cluster's subgraph
("first-cluster-wins"):

```c
for (n = agfstnode(clust); n; n = nn) {
    nn = agnxtnode(clust, n);
    if (ND_ranktype(n) != NORMAL) { agdelete(clust, n); continue; }  // <-- removes
    UF_setname(n, GD_leader(clust)); ND_clust(n) = clust; ND_ranktype(n) = CLUSTER;
    ...
}
```

The port (`cluster.ts:markClusters`) instead just `continue`s, leaving the
foreign node in `clust.nodes`:

```ts
if ((n.info.ranktype ?? 0) !== 0) continue;   // skips claim, but keeps it in clust.nodes
```

So `build_skeleton`, which iterates `subg.nodes`, sees foreign nodes whose ranks
fall outside the cluster's `[minrank,maxrank]` → `rankleader[outOfRangeRank]`
undefined → crash.

**C vs port (1767, `build_skeleton` dump):**

| cluster | C (owned-only) | port (leaks foreign) |
|---------|----------------|----------------------|
| cluster_1 | `{f:2}` | `{a:1, f:3, c:3}` |
| cluster_2 | `{p1:1,p2:1,p3:1}` | `{p1:1, p2:0, p3:0, f:3}` |
| cluster_3 | `{S1:0,S2:0,S3:0}` | (crash before reached) |

Experimental fix (mirror agdelete: `clust.nodes.delete(n.name)` when claimed):
b53 → renders; 1767 → advances to defect B.

## Defect B — build_skeleton fixed-`rl` (secondary)

Independent of A. C bumps a single `rl = GD_rankleader(subg)[ND_rank(v)]`'s
`out[0]` count `(hi-lo)` times; the port indexes `rankleader[r]` per r, hitting
the last leader (empty `out`) when an edge head's rank exceeds the cluster's
maxrank. Carried over from `errored-cluster` T4. With A, 1767 renders.

## Defect C — single-node leaf clusters miss `info.rank` (1332 only)

With A+B applied, 1332 advances much further: clusters missing `info.rank` drop
from a large subtree to **3** — all single-node "label-wrapper" leaf clusters:

```
clusterc4046  min12 max12  1 node (c4046)  parent cluster_6754
clusterc6378  min18 max18  1 node (c6378)  parent cluster_6754
clusterc6755  min33 max33  1 node (c6755)  parent root
```

These clusters keep their (un-claimed) node but still never receive a rank
table. The consequence: the intercluster virtual chain for an edge spanning
them breaks — `mapPathLongSingle` walks `from→to` (e.g. rank 13→14→15) and the
virtual node at rank 14 has an **empty `out` list** (`size:0`), so `out.list[0]`
is undefined → `Cannot read properties of undefined (reading 'head')`
(`cluster-path.ts:154`).

**Not yet pinned:** why the port's cluster rank-table install skips single-node
leaf clusters (the node is present, `min==max`, parent is a real cluster). First
step for the fix mission: instrument C `build_ranks`/`install_cluster` on these
three clusters and diff the install order/recursion against the port.

## Per-case outcome with candidate fixes

| Case | HEAD (current) | with A | with A+B | needs |
|------|----------------|--------|----------|-------|
| graphs/b53.gv | crash `containNodesRank` | layout OK¹ | layout OK¹, **crash `maximalBbox` (ht1)** | A+B + **D** |
| 1767.dot | crash `buildSkeletonCountsNode` | crash (defect B) | **renders** ✅ | A+B |
| 1332.dot | crash `containNodesRank` | crash `mapPath` | crash `mapPath` (defect C) | A+B + **C** |

¹ **Correction (Batch 1):** the A/A+B columns here were measured with
`dotLayoutEntry` (*layout only*). On full `renderSvg`, b53 passes layout but
crashes in **edge routing** — defect **D** (`maximalBbox` reads `ranks[r].ht1`
with `ranks[r]` undefined; a vnode rank outside the root rank array). D is a
separate pre-existing defect exposed by A+B advancing b53 past position. Only
**1767 renders end-to-end with A+B**; b53 needs +D, 1332 needs +C (both Batch 2).
