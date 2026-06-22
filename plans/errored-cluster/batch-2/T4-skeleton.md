<!-- SPDX-License-Identifier: EPL-2.0 -->
# T4 — RC3: buildSkeletonEdgeCounts null rankleader/out

## Context
`buildSkeletonEdgeCounts` (src/layout/dot/cluster.ts:260) crashes at
`rlr.info.out!.list[0]` (or `subg.info.rankleader![r]` is undefined) while
accumulating per-rank skeleton edge counts. In C `build_skeleton` (cluster.c) the
rankleader array and each leader's `out` list are populated for every rank in
`[lo, hi)` before counts are touched. Crash path: `buildSkeleton →
buildSkeletonCounts → buildSkeletonCountsNode → buildSkeletonEdgeCounts`. Case:
`1767.dot`.

## Task
1. Read `buildSkeletonEdgeCounts` + `buildSkeleton`/`buildSkeletonCounts`
   (cluster.ts) and C `build_skeleton` (cluster.c).
2. Instrument C `build_skeleton` on `1767.dot`: dump `rankleader[r]` and its
   `out` list for the rank range of the failing edge. Compare to the port — find
   the rank whose leader (or leader `out`) the port left unset (likely a rank
   outside the port's populated range, or a zero-init `out`).
3. Fix so the rankleader chain is populated as in C before counts run. Do NOT
   guard the deref (ADR-1).
4. Extend the existing `src/layout/dot/cluster.test.ts` with a case asserting
   `1767.dot` renders.

## Write-set
- `src/layout/dot/cluster.ts`
- `src/layout/dot/cluster.test.ts` (existing — extend)

## Read-set
- `src/layout/dot/cluster.ts:255-295` (buildSkeletonEdgeCounts, buildSkeleton*)
- `~/git/graphviz/lib/dotgen/cluster.c:build_skeleton`
- decisions.md#adr-1, #adr-3
- memory: `calloc-zero-vs-undefined-port-hazard`, `2471-blocker-is-cluster-ranking`

## Interface outputs
None (internal layout fix).

## Acceptance criteria
- Given `1767.dot`, when `renderSvg(_, 'dot')`, then no throw.
- Given native `build_skeleton` instrumented on `1767.dot`, when skeleton edge
  counts accumulate, then the port matches C's rankleader population and count
  updates over `[lo, hi)` (faithful).
- Given the full vitest suite, then it stays green (0 regressions).

## Observability / Rollback
N/A — pure layout fix. Reversible.

## Quality bar
`npm run typecheck && npm test` green (full suite). One commit:
`fix(cluster): populate rankleader chain before skeleton edge counts (T4)`.

## Boundaries
- Only `cluster.ts` (+ its existing test). If the rankleader gap originates in
  ranking (a different module), STOP and log it — do not expand the write-set.
