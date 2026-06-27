# Data flow — dot `doDot` pack branch

`dotLayoutEntry` routes through a new `doDot` wrapper that mirrors
`lib/dotgen/dotinit.c:doDot`.

```mermaid
flowchart TD
  A[dotLayoutEntry g] --> B{getPackModeInfo == l_undef<br/>AND getPack < 0?}
  B -- yes (no pack) --> C[dotLayoutPipeline g<br/>unchanged]
  B -- no (pack set) --> D[ccomps g -> components]
  D --> E{ncc == 1?}
  E -- yes --> C
  E -- no --> F{ratio_kind == R_NONE?}
  F -- no --> C
  F -- yes --> G[for each component sg]
  G --> H[initSubg sg, g  - ADR-2, if needed]
  H --> I[+ cluster-carry sg  - T3/ADR-3]
  I --> J[dotLayoutPipeline sg<br/>rank/mincross/position/splines]
  J --> G
  G -- all done --> K[packSubgraphs ncc, comps, g<br/>mode=l_graph, doSplines=true<br/>shifts n.info.coord -points-]
  K --> L[copyClusterInfo ncc, comps, g  - T3]
  L --> M[root GD_bb from packSubgraphs]
```

Key: the port's `packSubgraphs`→`shiftGraphs` shifts `n.info.coord` in **points**
(not C's inches/`ND_pos`), so `attachPos`/`resetCoord` are unnecessary. The root is
never re-ranked in the pack branch.
