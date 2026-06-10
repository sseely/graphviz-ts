# T3 — fdp cluster scheme: ports, recursion, cluster bbs

## Context
T2 ported the flat fdp path (derived graphs, tlayout, xlayout, packed
components). fdp-cluster and fdp-nested-cluster need the recursive
cluster machinery of layout.c @15.0.0: clusters collapse to derived
nodes, are laid out bottom-up as sub-layouts with PORT nodes induced
by the parent layout, then re-expand with their final size feeding
the parent's xLayout.

Flow per layout(g) (layout.c:800):
1. deriveGraph: each cluster → one dnode (do_graph_label(subg) first;
   ND_clust(dn)=subg; members' DNODE → dn); port transform for g's
   own ports.
2. After fdp_tLayout of a component, for each dnode with ND_clust:
   expandCluster (getEdgeList: edges of dn sorted by atan2 angle then
   dist², equal angles spread by ≤2° (ANG=π/90); genPorts: one port
   per REAL edge, multi-edge fan by ED_count, direction by node
   creation-order comparison `n < other`) → PORTS(sg); recurse
   layout(sg); then dnode gets ND_width/height = BB(sg).UR (inches),
   lw=rw=UR.x·72/2, ht=UR.y·72.
3. Port nodes are removed from the component before packing
   (`agdelete(cg, n)` for IS_PORT).
4. In the recursive layout, fdp_tLayout's initPositions places ports
   ON the Wd/Ht ellipse at their alpha angles (pinned P_SET), other
   nodes by neighbor-average / drand48; updatePos clamps non-ports
   inside the boundary ellipse (d≥1 → 0.95·x/d) and projects ports
   onto it (x/d).
5. finalCC for non-root rg adds margin = late_int(rg, G_margin,
   CL_OFFSET=8) and GD_border[BOTTOM/TOP].y (cluster label space from
   do_graph_label) to the bb; label width can widen it
   (round(dimen.x) vs bb width, split /2).
6. Back in the parent: "record positions" writes BB(sg) (in parent
   inches) from the dnode pos ± width/2.
7. evalPositions (fdpLayout tail) accumulates cluster bb.LL offsets
   into member node positions and child cluster bbs (root LL at
   origin). setBB ×72 into point bbs for emission.

Cluster labels: do_graph_label(subg) runs in deriveGraph (sets
GD_label + GD_border for clusters; M2/M6 ported doGraphLabel).
Cluster boxes/labels must reach the renderer the same way M6 neato
did (g.info.clust / subg.info.bb + label pos placed at emit time by
gv_postprocess/placeGraphLabel equivalents).

setClustNodes only touches IS_CLUST_NODE nodes (created by
processClusterEdges for cluster-endpoint edges) — none in our
inputs; keep the T2 guard.

## Write-set
`src/layout/fdp/*`. `src/common/*`, `src/layout/pack/*` allowed with
decision-journal entry (likely: cluster label/border helpers).

## Read-set
- /tmp/fdp-spec/layout.c:527-696 (ecmp/getEdgeList/genPorts/
  expandCluster), 800-923 (layout recursion), 79-175 (finalCC),
  236-269 (evalPositions), 300-337 (chkPos)
- /tmp/fdp-spec/tlayout.c:499-547 (port placement + neighbor
  averaging), 337-355 (boundary clamp)
- src/layout/dot/graph-label.ts (doGraphLabel), M6 cluster emission
  in src/layout/neato/index.ts:addClusters + src/common/emit-cluster.ts
- Oracle: `fdp -Tplain` / `-Tsvg` on fdp-cluster, fdp-nested-cluster;
  `-Gmaxiter=N` bisection; `-v -v` (DEBUG prints are compiled out —
  rely on plain output)

## Acceptance criteria
- Given fdp-cluster, when rendered, then the golden test passes:
  both cluster boxes, labels "Left"/"Right", node/edge coords within
  0.5pt of the ref.
- Given fdp-nested-cluster, when rendered, then the golden test
  passes (inner box inside outer, label offsets correct).
- Full suite: no regression; failure count ≤ count at mission start.

## Quality bar
Gates per ../README.md; `@see` refs to 15.0.0 file:function; CCN
limits as in T2.

## Observability / Rollback
N/A. Reversible (git revert).

## Commit
`feat(fdp): port cluster scheme — ports, recursive layout, bbs`
