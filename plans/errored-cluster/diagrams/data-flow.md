<!-- SPDX-License-Identifier: EPL-2.0 -->
# Crash paths per root cause

Each chain ends at the throwing line. RC1–3 are layout-phase null-derefs; RC4 is
a pre-parse heuristic false-positive.

## RC1 — flatReorderRank temprank undercount (121, 2239, 258)

```mermaid
flowchart LR
  A[dotMincross] --> B[runClusters] --> C[mincrossClust]
  C --> D[flatReorder] --> E[flatReorderRank]
  E --> X["rk.v[i] = temprank[i]<br/>rk.v[i].info.order  ✗ undefined"]
```

## RC2 — mapPathLongSingle null-head walk (1332, graphs-b53)

```mermaid
flowchart LR
  A[mincrossClust] --> B[expandCluster] --> C[interclexp]
  C --> D[interclexpOneEdge] --> E[makeInterclustChain]
  E --> F[mapPath] --> G[mapPathLongSingle]
  G --> X["e = e.head.info.out!.list[0]  ✗ undefined"]
```

## RC3 — buildSkeletonEdgeCounts null rankleader/out (1767)

```mermaid
flowchart LR
  A[buildSkeleton] --> B[buildSkeletonCounts] --> C[buildSkeletonCountsNode]
  C --> D[buildSkeletonEdgeCounts]
  D --> X["rankleader![r].info.out!.list[0]  ✗ undefined"]
```

## RC4 — Stripper leaks in-string `--` (graphs-big, graphs-biglabel)

```mermaid
flowchart LR
  A[renderSvg] --> B[parse] --> C[validateEdgeOperators]
  C --> D["Stripper.strip(src)"]
  D --> X["/--(?!>)/ matches `--` inside<br/>a \\-continued string  ✗ false positive"]
  X --> T["throw EDGE_OP_UNDIRECTED_IN_DIRECTED"]
```
