<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: 1323 — flat edges between adjacent record nodes (graphviz #1323)

- **Context**: 1323 diverged (maxΔ 284, firstDiff `svg/g[1][childCount]` —
  structural element-count mismatch). Clustered record digraph.
- **Finding**: the port rendered 2 edges native does NOT: `namespace1:f3 ->
  vfsmount2:f13` and `vfsmount2:f14 -> namespace1:f1` (port 11 edges, native 9).
  Both ARE in the input (lines 59-60) with valid record ports. Native emits:
  `Warning: flat edge between adjacent nodes one of which has a record shape...`
  `Error: lost namespace1 vfsmount2 edge`. This is graphviz bug #1323 (still
  open; tests/test_regression.py marks 1323.dot/1323_1.dot strict-xfail).
- **C behavior**: `make_flat_adj_edges` (dotsplines.c) bails when a flat edge
  between ADJACENT nodes has a record-shape endpoint —
  `if (shapeOf(tn)==SH_RECORD || shapeOf(hn)==SH_RECORD) return 0;` — building NO
  spline. `map_edge` (postproc.c) then sees ED_spl==NULL and "lost"s the edge:
  it is never drawn.
- **Why the port differed**: the port's flat routing is fragmented (AD-3). The
  bail belongs in the LIVE router (edge-route.ts), not splines-flat.ts's
  makeFlatAdjEdges — bailing there just makes routeFaithfulSidePort return false,
  and routeForwardEdge falls through to the simplified fitter, which routes the
  edge anyway.
- **Fix**: guard at the top of `routeForwardEdge` (edge-route.ts) —
  `isLostFlatAdjRecordEdge(g, e)` (same-rank + isFlatAdjacent + record endpoint)
  → return, leaving e.info.spl undefined. edgeHasDrawableContent then skips it.
  EDGES NOW MATCH 9=9. typecheck clean, 79 flat/edge tests pass.
- **RESIDUAL (2026-06-26: RESOLVED, was MISDIAGNOSED)**: native renders
  "struct vfsmount" 3× (clust2 cluster_vfsmount, clust3 cluster_mount1, clust4
  cluster_mount2); the port drew it 1× (text 50 vs 48). This is NOT cluster
  "fragmentation" from the lost edges. cluster_mount1/cluster_mount2 have their
  own `label` commented out, so they INHERIT `label="struct vfsmount"` from the
  enclosing cluster_vfsmount — DOT attribute-default inheritance: a graph attr
  set on a subgraph is the default for subgraphs nested AFTER it (self +
  descendants only; not siblings/ancestors). Verified: nested clusters inherit a
  parent's (and even the root graph's) label in native; a sibling declared after
  does not. C does this at parse time (agmakeattrs copies parent dict defvals at
  agsubg); do_graph_label then reads agget(sg,"label") = the seeded value.
- **FIX (2026-06-26)**: graph-label.ts doGraphLabel read `sg.attrs.get('label')`
  (own-only) → nested label-less clusters bailed. Changed to `graphAttrInherited(
  sg, 'label')` — the SAME ancestor-walk the port already uses for
  fontname/fontsize/fontcolor and `clusterAttr` uses for color/style/pencolor.
  1323 + 1323_1: diverged (maxΔ 28) → BYTE-MATCH. Apples-to-apples survey (same
  oracle cache, reverted-vs-changed): exactly those 2 graphs change, 0 real
  regressions (2854 flipped diverged→oracle-error = native dot TIMEOUT on a
  cluster-free graph, native-side flake). Provably inert for cluster-free graphs
  (root walk == own read). 2445 unit tests pass; tsc clean.
- **Confidence**: High — root cause confirmed via native min-repro
  (mininherit/hier/rootlabel/order .dot), C source (attr.c agmakeattrs/setattr),
  and conformant.
