# compute_bb omitted edge splines (all non-dot engines)

## Observation: the graph bb was computed from node extents only

- **Context**: Batch-2 prep of the iterative-parity campaign. T1's injection
  harness attributed neato's 491 diverged ids; the single largest not-cleared
  bucket was `graph/_draw_/numeric` with **252 members** (of 369 not-cleared).
  Dumping the actual residual diffs for representatives (`graphs-b76`,
  `share-NaN`, `2391_1`) showed all three carrying the *same* three-diff
  signature:

  ```
  [graph]/bb[2]                          54  vs  72
  [graph]/_draw_/op[2].filled_polygon[4] 54  vs  72
  [graph]/_draw_/op[2].filled_polygon[6] 54  vs  72
  ```

  `bb` is `[llx, lly, urx, ury]`, so index 2 is the upper-right x; polygon
  indices 4 and 6 are the x of the background rect's two right-hand corners.
  Only the right edge was short — not a uniform translation.

- **Finding**: `computeSubgraphBB` (`src/layout/pack/index.ts:98`) walked
  **node extents only**. C's `compute_bb` (`lib/common/utils.c:633`) also
  expands the box over every out-edge's spline control points and over the
  edge's centre/head/tail/x labels. `graphs-b76` is one default node (54pt
  wide) with a self-loop; the loop bulges 18pt to its right, so the oracle's
  bb is 72pt and the port's was 54pt. The background `filled_polygon` is drawn
  from the bb, so it inherited the same truncation.

  This was NOT a neato bug. `computeSubgraphBB` is documented at
  `src/gvc/device.ts:493` as the `compute_bb` equivalent for **neato, fdp,
  sfdp, circo, twopi and osage**, and `pack` uses it for component boxes — so
  every non-dot engine had a bb that excluded any spline leaving the node hull
  (self-loops, curved/ported edges, flat edges routed around a node).
  Injection proved node *placement* was already correct in these ids; it was
  the box *containing* them that was wrong.

- **Impact**: Fixing `compute_bb`'s edge arm is a single-mechanism fix for the
  largest bucket in the campaign. Watch for the two-mechanism confusion:
  `2391_1` has the same bb signature but does NOT clear, because its residual
  root is `edge:a->a#0/_ldraw_[missing]` — the port never *emits* that
  self-loop's label, so no bb can contain it. Missing-label emission is a
  separate mechanism from bb truncation; don't merge them into one round.

- **Port hazard reconfirmed**: bezier point lists are over-allocated. The point
  loop MUST be bounded by `bz.size`, never `bz.list.length`, mirroring C's
  `ED_spl(e)->list[i].size`. See `bezier-emit-size-not-length` memory.

- **Deliberate deviation**: C's `compute_bb` also expands over node xlabels,
  cluster bbs and the graph label. The port grows `g.info.bb` for those in
  dedicated passes that run *after* this call (xlabel placement, `addClusters`,
  `placeGraphLabel`), so folding them in here too would double-expand rather
  than match C. Only the edge arm was missing.

- **Confidence**: High. Mechanism confirmed by instrumenting the native oracle
  (`GVTS_POS_DUMP`) and by the fix taking `graphs-b76` and `share-NaN` from 3
  residual diffs to 0.
