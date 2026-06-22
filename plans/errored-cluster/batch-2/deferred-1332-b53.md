<!-- SPDX-License-Identifier: EPL-2.0 -->
# Deferred: 1332.dot + graphs/b53.gv (RC2 re-classified)

## Status: deferred to a cluster-rank-install follow-on (user-confirmed 2026-06-22)

These two cases were RC2 in the original brief ("`mapPathLongSingle` null-head
walk"). That crash is **resolved** — but by T2, not T3 — and the cases now expose
a different, deeper crash that lies outside this mission's write-sets.

## What changed

| State | 1332.dot | graphs/b53.gv |
|-------|----------|---------------|
| Pre-T1/T2 (baseline) | crash `cluster-path.ts:154` `mapPathLongSingle` — `reading 'head'` | (same family; hangs/crashes upstream) |
| Post-T2 (current) | crash `position-cluster.ts:82` `containNodesRank` — `reading '5'` | crash `position-cluster.ts:82` `containNodesRank` — `reading '3'` |

**Proof the mapPath crash is gone:** swapping `mincross-flat.ts` back to its
pre-T2 body reproduces the exact RC2 stack (`mapPathLongSingle` → `reading
'head'`); with the T2 windowing fix in place, the virtual-chain walk completes
(every hop has `out.size === 1`) and never derefs null. RC1 and RC2 shared the
single windowing root cause fixed in T2.

## New root cause (the real remaining gap)

`containNodesRank` (position-cluster.ts:82) does `g.info.rank![r]` where
`g.info.rank` is **undefined** — i.e. a cluster never had its per-cluster rank
table installed. A whole subtree of clusters is affected:

- **1332.dot**: rank tables present for the early `cluster_4252` subtree, but
  `clusterc4118` (minrank=maxrank=5) and every later sibling/subtree
  (`cluster_4257`, `cluster_5378`, `cluster_5383`, `cluster_6382`,
  `cluster_6409`, …) have `info.rank === undefined`.
- **graphs/b53.gv**: only the last sibling `cluster_node_44` (minrank=maxrank=3)
  has `info.rank === undefined`; its siblings are fine.

The clusters have valid `minrank`/`maxrank` but no rank table, so the install
loop bails or never visits the later siblings. This is a cluster-rank-table
install gap (cluster.ts / mincross cluster recursion), **not** the `cluster-path.ts`
`map_path` logic T3 was scoped to, and **not** `cluster.ts:buildSkeleton` (T4).

## Why deferred, not fixed here

Per ADR-1 the fix must be a faithful C port, not a guard (a bare
`if (!g.info.rank) return` at position-cluster.ts:82 would mask the divergence).
The faithful fix touches cluster-rank-table installation — outside every task's
declared write-set, and potentially large (2471-saga class). Per the autonomous
STOP rules (mis-scope + out-of-write-set), this was surfaced and the user chose
to proceed with T4 and defer these two to a follow-on.

## Net mission outcome for these cases

`errored` → still `errored`, but the **original RC2 crash is fixed** and the
remaining crash is precisely root-caused and isolated for a dedicated mission.
No regression (they were errored before, are errored now at a later phase).

## Follow-on entry point

Instrument cluster rank-table install (where `g.info.rank` is allocated per
cluster — see `mincross-build.ts:80` and the cluster recursion in `cluster.ts`)
on 1332.dot; find why `clusterc4118` and later siblings are skipped. Compare to
C `build_skeleton` / `mark_clusters` / `class2` cluster install order.
