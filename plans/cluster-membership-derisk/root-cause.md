<!-- SPDX-License-Identifier: EPL-2.0 -->
# Root cause + blast radius (P2)

## Are the defects independent or one shared cause?

**Two independent defects do the heavy lifting, plus one narrower follow-on:**

- **A (membership) and B (skeleton count)** are independent of each other but
  both live in `cluster.ts` and are needed together for 1767. A alone fixes b53.
  They are the dominant cause: **A+B resolve 2 of the 3 cases with 0 regressions
  (full suite 2250 pass).**
- **C (single-node leaf clusters miss `info.rank`)** is a *separate, narrower*
  defect surfaced only after A+B unblock 1332. It is not caused by A or B (the
  node is present and un-claimed); it is a cluster rank-table install gap.

The README's "membership vs ranking — independent or shared?" stop-condition
resolves to: **membership (A) is the shared root cause across all three cases;
ranking splits into the already-fixed `errored-cluster` T2 windowing and a small
residual leaf-cluster install gap (C) that only 1332 hits.**

## Root causes

### A — `markClusters` does not prune foreign nodes
`cluster.ts:markClusters` mirrors C's claim logic (`UF_setname`/`ND_clust`/
`ranktype=CLUSTER`) but omits C's `agdelete(clust, n)` for already-claimed
nodes. The port keeps foreign nodes in `clust.nodes`; every downstream consumer
that iterates a cluster's node set (`build_skeleton`, and any rank/position pass
that trusts `subg.nodes` ⊆ `[minrank,maxrank]`) then sees out-of-range nodes.

**Faithful fix:** when `(ranktype ?? 0) !== 0`, delete `n` from the cluster's
node set (and mirror agdelete's edge cleanup as C does), then `continue`.
Iterate a snapshot (`[...clust.nodes.values()]`) to mutate while looping.

### B — `buildSkeletonEdgeCounts` uses `rankleader[r]` not a fixed `rl`
Already documented in `errored-cluster/batch-2/deferred-1767.md`. Use
`rl = subg.info.rankleader![v.info.rank]` once and bump `rl.out[0].count`
`(hi-lo)` times, per `cluster.c:build_skeleton`.

### C — single-node leaf clusters never get `info.rank`
Unpinned root cause. Symptom: `clusterc4046/c6378/c6755` (1 owned node,
`min==max`) get no rank table, breaking the intercluster virtual chain in
`mapPathLongSingle`. Likely in the cluster rank-table install recursion
(`build_ranks`/`install_cluster`/`class2` per-cluster) — a single-rank leaf
cluster is skipped. Requires C instrumentation of `build_ranks` on these three
clusters before a fix.

## Blast radius

| Defect | File(s) | Risk | Coverage |
|--------|---------|------|----------|
| A | `src/layout/dot/cluster.ts` (`markClusters`) | low — local, regression-clean with B | b53 ✅, 1767 (with B) ✅, 1332 (partial) |
| B | `src/layout/dot/cluster.ts` (`buildSkeletonEdgeCounts`) | low — local, regression-clean | 1767 ✅ |
| C | likely `cluster.ts`/`mincross-build.ts` (cluster rank install) + surfaces in `cluster-path.ts` (chain walk) | medium — needs C instrumentation first | 1332 only |

**A+B share one file (`cluster.ts`) and one regression gate (full suite), and
are validated clean.** C is isolated to 1332 and is the only piece still needing
investigation.

## Recommendation

**One fix mission, two batches** (or split B2 into its own mission if C proves
deep):

- **Batch 1 — A + B** (`cluster.ts`): the membership `agdelete` + the
  `build_skeleton` fixed-`rl`. Fixes **b53 + 1767**, 0 regressions (already
  validated experimentally). High confidence, ship first.
- **Batch 2 — C** (cluster rank-table install for single-node leaf clusters):
  starts with C instrumentation of `build_ranks`/`install_cluster` on 1332's
  `clusterc4046/c6378/c6755`. Fixes **1332**. Lower confidence — gate Batch 2
  behind its own investigation step; if it balloons, spin it out.

Net: this derisk converts the 3 deferred `errored-cluster` cases from "deep
unknown cluster infra" into **2 ready-to-fix (A+B) + 1 scoped follow-on (C)**.
