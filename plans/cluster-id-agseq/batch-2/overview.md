<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 2 — emit `clust<seq>`

Consume `Graph.seq` (from T1) in cluster id emission and retire the dead dense
counter. Depends on T1.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | `svgClusterId` → `clust<sg.seq>`; remove `job.clusterId` field + `svgBeginCluster` increment | sonnet | `src/render/svg-id.ts`, `src/render/svg-cluster.ts`, `src/gvc/job.ts`, `src/render/svg-cluster-id.test.ts` (new) | T1 | [x] |

Gate after batch: `tsc --noEmit` + `vitest run` green; a render assertion shows
`nestedclust` → `clust2/6/7`.
