# T5 — cluster fill + graph background (AD1, AD2)

## Context

graphviz-ts port; C spec at ~/git/graphviz/lib (15.0.0). Baseline
1466/0, 82 goldens. Hook rule: smallest fix, ≤2 attempts/file, move on.

Clusters render via src/render/svg-cluster.ts (svgBeginCluster +
boundary polygon in device.ts) and the graph background via
src/render/svg-graph.ts (emitGraphBackground / svgBeginGraph). Today
`subgraph cluster_0 { style=filled; color=lightgrey }` emits
`fill="none"` and `bgcolor=...` emits `fill="white"`. C draws the
cluster fill in emit_clusters/emit_begin_cluster and the page
background in emit_background.

## Task

1. Cluster: resolve cluster `style`/`color`/`fillcolor`/`bgcolor` (T1
   resolvers; cluster fill = fillcolor || color when style=filled, plus
   the bgcolor-backward-compat path — read emit.c:3841 "bgcolor
   supported for backward compatibility; if fill is set, fillcolor
   trumps bgcolor"). Set the cluster obj-state (T2 pushes it in the
   cluster path) so the boundary polygon fills. @see lib/common/emit.c:
   emit_clusters/emit_begin_cluster (:3777-3940).
2. Graph background: port emit_background (emit.c:1476) — when `bgcolor`
   is set, emit a filled rect over the page bbox BEFORE nodes/edges
   (C default "white" means no rect; a real bgcolor emits one). Match
   C's element (polygon vs rect) and position exactly.
   @see lib/common/emit.c:emit_background (:1476-1530), emit_page
   (:3593, background ordering).
3. Two-color/gradient cluster or graph fill → first solid (AD3).
4. TDD: failing tests first; oracle-verify cluster filled, graph
   bgcolor, cluster bgcolor-compat, default (no bgcolor → no rect).

## Write-set (strict)

src/render/svg-cluster.ts, src/render/svg-graph.ts, + co-located tests.
The cluster boundary polygon is currently emitted in device.ts
(renderClusters) — if filling it requires a device.ts change, that
overlaps T2/T4; STOP and report (likely the fill belongs in svg-cluster
via the obj-state emitStyle path — confirm the polygon already reads
job.obj).

## Read-set

~/git/graphviz/lib/common/emit.c:emit_background (:1476), emit_page
(:3593-3660), emit_clusters/emit_begin_cluster (:3758-3940);
src/render/svg-cluster.ts; src/render/svg-graph.ts; src/gvc/device.ts
(renderClusters cluster body); src/common/style-resolve.ts (T1);
src/render/svg-helpers.ts (emitStyle, svgPolygon).

## Architecture decisions (locked)

AD1, AD2, AD3 (first solid), AD4. Emission ORDER: background before
view (nodes/edges/clusters); cluster fill before its label. Golden-
sensitive.

## Acceptance criteria

- Given `bgcolor=lightyellow`, then a `lightyellow` page rect before
  the nodes, matching C's element + coords
- Given `subgraph cluster_0 { style=filled; color=lightgrey }`, then
  the cluster boundary fills `lightgrey`
- Given cluster `bgcolor` without fillcolor, then bgcolor fills
  (backward-compat path)
- Given no bgcolor / unfilled cluster, then output conformant to
  pre-task; 82 goldens stable

## Observability / rollback

N/A — gates are the SLI. Reversible (single commit).

## Quality bar

tsc clean; vitest 0 failed; byte-stability clean. Commit (orchestrator):
`feat(T5): render cluster fill and graph background color`.
