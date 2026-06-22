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

## Batch 2 — C (single-node leaf-cluster rank install) → 1332  [GATED]

### T3 — investigate + fix leaf-cluster rank-table install
- **First (investigation):** instrument C `build_ranks`/`install_cluster` on
  1332's `clusterc4046`, `clusterc6378`, `clusterc6755`; find why a single-node
  `min==max` leaf cluster gets a rank table in C but not in the port.
- **Write-set (provisional):** `src/layout/dot/cluster.ts` and/or
  `src/layout/dot/mincross-build.ts` (cluster rank install); the broken chain
  surfaces in `cluster-path.ts:mapPathLongSingle` but that is a symptom — do not
  guard it.
- **C ref:** `lib/dotgen/rank.c`, `cluster.c:build_ranks`/`install_cluster`.
- **AC:** `1332.dot` renders (was `mapPath` null-walk after A+B); the 3 leaf
  clusters get `info.rank`; full suite 0 regr.
- **Stop/split:** if T3's root cause is not a localized install fix (e.g. it
  needs ranking-phase rework), STOP and spin C into its own mission.

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
