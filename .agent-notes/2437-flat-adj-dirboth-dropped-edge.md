<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: 2437 — flat adjacent side-port edge with dir=both was dropped

- **Context**: 2437 diverged (maxΔ 8.42, firstDiff `svg/g[1][childCount]`).
  Input is 6 lines: `{rank=same; AA3:se -> AA4:sw [dir=both]}`. Native routes
  the edge as a curve dipping below both nodes (reserving 8.42pt extra height)
  with arrowheads on BOTH ends. The port drew the two nodes and NO edge at all.

- **Root cause #1 (dropped edge — control flow)**: `routeOneEdge` (edge-route.ts)
  splits on `dir` BEFORE flat dispatch. `dir=both` is non-forward, so it goes to
  `routeEdgeNonForward`, whose three paths (`routeFaithfulAdjacentBack`,
  `dispatchMultiRankNonForward`, `routeFaithfulRegularPlain`) all DECLINE a
  same-rank flat edge. The flat-adjacent router (`makeFlatAdjEdges`, the rotated
  aux-graph pipeline) lived ONLY inside `routeForwardEdge`, which non-forward
  edges never reach → e.info.spl stayed undefined → edgeHasDrawableContent
  skipped it. C dispatches flat edges by topology in `dot_splines_` independent
  of ED_dir (only arrowheads differ by direction).
  - **Fix**: extracted the flat dispatch into `routeFlatEdge(e,g): boolean`
    (the four checks: isLostFlatAdjRecordEdge / makeFlatLabeledEdge /
    makeAdjFlatNoPortEdge / hasSidePort+routeFaithfulSidePort) and call it from
    `routeEdgeNonForward` for same-rank edges too, before routeFaithfulRegularPlain.
    Surgical: forward hot path unchanged (routeForwardEdge now calls the same
    helper); only non-forward same-rank edges (previously dropped) gain a path.

- **Root cause #2 (trailing spline junk)**: `copyOneFlatSpline` (splines-flat.ts)
  copied `auxbz.list.length` points. The aux spline over-allocates `list` and
  clip lowers `size` (head-arrow clip: 7→4). Emitting list.length appended the
  unclipped tail (`... 83.73,-4.46 137.81,-8.42 137.81,-8.42 137.81,-8.42`) and
  inflated the graph bb (bg polygon x 141.81 vs oracle 141.63).
  - **Fix**: copy `auxbz.size` points (the "emit bz.size not list.length"
    hazard). Corrected both the path and the bb.

- **Root cause #3 (missing tail arrowhead)**: `copyFlatArrow` only copied
  `headArrowOps`. For dir=both the aux edge carries BOTH headArrowOps and
  tailArrowOps (verified: sflag=1 eflag=1, headOps=1 tailOps=1). The tail arrow
  polygon was never installed.
  - **Fix**: also copy tailArrowOps to orig.tailArrowOps, EXCEPT when tail ops
    were consumed as the head in the reversed-clone case (#241_0: no headArrowOps
    + eflag). Distinguishing test: `tailConsumed = headArrowOps===undefined && eflag`.
    Preserves #241_0; inert for dir=forward (tailArrowOps undefined).

- **Result**: 2437 diverged (maxΔ 8.42) → BYTE-MATCH (path + both arrowhead
  polygons identical to oracle). typecheck clean; 79 flat/edge unit tests pass.
- **Confidence**: High — conformant against native headless oracle; root causes
  confirmed by runtime probe (aux size=4/list=7, both arrow-op arrays present).
