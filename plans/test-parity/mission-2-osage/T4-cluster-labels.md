# T4 — Cluster labels: do_graph_label + place_graph_label

## Context
C mkClusters calls do_graph_label(subg) per cluster (builds GD_label,
sets GD_border TOP/BOTTOM with PAD'd label dimen); osage_layout ends
with dotneato_postprocess → place_graph_label (sets label pos within
the border strip, lab.set). Our osage does neither, so
addMarginAndBorder sees border=0 and renderClusterLabel skips.
Both functions are already ported (engine-neutral, parked under dot):
doGraphLabel (src/layout/dot/graph-label.ts), placeGraphLabel
(src/layout/dot/position-bbox.ts).

## Task
1. osage mkClustersInto: call `doGraphLabel(subg, layoutMeasurer(g))`
   for each cluster found (@see lib/osage/osageinit.c:mkClusters).
2. osageLayout: after osageReposition, call `placeGraphLabel(g)`
   (@see lib/osage/osageinit.c:osage_layout dotneato_postprocess).
3. Verify applyLabelExpansion + addMarginAndBorder now reproduce the
   ref: labelled cluster height 104.5; empty labelled cluster
   40.75x45 (label dimen + 2pt margins + 24.5 TOP border).

## Read-set
~/git/graphviz/lib/common/input.c:838-905 (do_graph_label),
~/git/graphviz/lib/common/postproc.c:place_graph_label,
test/golden/refs/osage-labels.svg, osage-empty-cluster.svg.

## Acceptance criteria
- osage-labels golden PASSES (113pt height, ClusterA/ClusterB text at
  y=-87.2)
- osage-empty-cluster golden PASSES (Empty box 40.75x45)
- Full suite: no previously passing test fails

## Write-set
src/layout/osage/index.ts

## Commit
`feat(osage): build and place cluster labels per C mkClusters`
