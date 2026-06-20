<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions (approved)

## AD-1: Segmented loop lives in a single `routeChainSegmented`
- Context: C's `make_regular_edge` owns the chain walk, accumulating points
  across multiple `routesplines` calls in one `pointfs`; the port currently does
  one path + one route + one `recoverSlack`.
- Decision: new `routeChainSegmented(g, e, segs): Point[]` owns the full walk
  (begin/end/complete/route/accumulate + `straightPath` + per-segment
  `recoverSlack`), called by BOTH `routeMultiRankEdgeFaithful` and
  `faithfulBackFwdPoints`.
- Consequences: 1:1 with C structure; single shared implementation; exact
  point-accumulation semantics. `buildChainPath` is absorbed/replaced.

## AD-2: Keep in `edge-route-chain.ts`, decompose into helpers
- Context: file is 325/500 lines; the segmented router adds CCN; chain helpers
  are file-local.
- Decision: keep in `edge-route-chain.ts`, decompose into ≤CCN-10 helpers (e.g.
  an emit-one-segment helper). Fallback: extract to `edge-route-straight.ts` and
  export the shared chain helpers if the file crosses 500 lines.
- Consequences: complexity hook (CCN 10, file 500) stays satisfied; cohesion
  preserved.

## AD-3: Scope is `EDGETYPE_SPLINE` only
- Context: C smode handles spline + polyline; `EDGETYPE_LINE` short-circuits via
  `makeLineEdge`.
- Decision: port smode for `EDGETYPE_SPLINE` (the default; the entire bow
  bucket). Leave polyline/line on existing paths.
- Consequences: covers all 137 bow cases; polyline smode is a documented
  low-value follow-up, not done here.

## AD-4: Faithful threshold, no simplification
- Context: C uses `sl >= (GD_has_labels(root) & EDGE_LABEL ? 4+1 : 2+1)` and
  `sl -= 2` on smode entry; `recover_slack` runs per segment.
- Decision: port the threshold exactly, including the EDGE_LABEL branch
  (`g.info.has_labels & EDGE_LABEL`, EDGE_LABEL=1) and `sl-=2`, with per-segment
  `recoverSlack`.
- Consequences: faithful to C; no behavioral shortcuts.

## Rollback
Reversible — revert the commit(s). No persisted state, no migration.
