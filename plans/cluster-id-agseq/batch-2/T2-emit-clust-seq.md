<!-- SPDX-License-Identifier: EPL-2.0 -->

# T2 — emit `clust<seq>` and retire `job.clusterId`

## Context

T1 added `Graph.seq` (AGSEQ; 0 for root, 1-based per subgraph in creation
order). Today `svgClusterId` (`src/render/svg-id.ts:49`) emits
`clust<job.clusterId>`, where `job.clusterId` is a dense counter bumped by
`svgBeginCluster` (`src/render/svg-cluster.ts:14` `job.clusterId++`). C instead
uses `clust<AGSEQ(subgraph)>` (`getObjId`, emit.c:230). This task switches the
emission to `sg.seq` and removes the dead dense counter.

`svgClusterId` already routes through `job.objId(ownId, fallback)` which applies
the DOT `id` attribute override and the `gid_` prefix — keep that wrapper; only
change the fallback string from `'clust' + job.clusterId` to `'clust' + sg.seq`.

## Task
1. `src/render/svg-id.ts:svgClusterId` — replace `'clust' + job.clusterId` with
   `'clust' + sg.seq`. Update the JSDoc (`clust<clusterId>` → `clust<AGSEQ seq>`,
   `@see lib/common/emit.c:getObjId`).
2. `src/render/svg-cluster.ts:svgBeginCluster` — remove the `job.clusterId++`
   line and its comment referencing the dense counter.
3. `src/gvc/job.ts` — remove the `clusterId` field (line ~299). Grep first to
   confirm no other reader (`grep -rn clusterId src`); if any non-test reader
   remains, stop and log.
4. `src/gvc/device.ts:343` has a comment "beginCluster increments
   job.clusterId" — update/remove that stale comment if present.

## Read-set
- `decisions.md#adr-3-retire-jobclusterid-entirely`
- `src/render/svg-id.ts:36-50` (`svgClusterId`)
- `src/render/svg-cluster.ts:13-21` (`svgBeginCluster`)
- `src/gvc/job.ts` around the `clusterId` field
- Interface from T1: `Graph.seq: number`

## Acceptance criteria
- Given `nestedclust.gv` rendered to SVG via `renderSvg` (dot engine), when
  reading the three `<g class="cluster">` ids, then they are `clust2`, `clust6`,
  `clust7` (oracle order).
- Given `graphs/clust1.gv` rendered, when reading cluster ids, then they are
  `clust1`, `clust2` (unchanged from before — no regression).
- Given a cluster with an explicit DOT `id="foo"` attribute, when rendered, then
  the id is `foo` (override path still wins; seq unused).
- Given `grep -rn 'clusterId' src` excluding tests, then there are no matches
  (field fully retired).

## Tests (TDD — write first)
- Add a render-level assertion in a new `src/render/svg-cluster-id.test.ts`
  (there is no `svg-id.test.ts`; cluster-focused render tests live alongside
  `svg-cluster-fill.test.ts`). Use `renderSvg` on the `nestedclust` and `clust1`
  inputs; extract cluster `<g id=...>` values and assert the lists above. Also
  add a unit case for the explicit-`id` override path.

## Observability
N/A — library.

## Rollback
Reversible — revert the commit.

## Quality bar
- `npx tsc --noEmit --stableTypeOrdering` exit 0.
- `npx vitest run` green.
- No new dead code; `clusterId` fully removed.

## Commit
`fix(T2): emit cluster ids from AGSEQ seq, drop dense clusterId`
