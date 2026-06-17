# Component map — newrank rank-build path

The double-install of `c` (the hang) happens because both the root and cluster0
`build_ranks` install `c` into the **shared root rank array**.

```mermaid
graph TD
  dotRank["dotRank (rank.ts)<br/>BUG: gates flag, never reads newrank attr"] -->|newrank| dot2Rank["dot2Rank (rank-dot2.ts)"]
  dot2Rank --> initMincross["init_mincross"]
  initMincross --> fillRanks["fillRanks (mincross-build.ts)<br/>inserts _new_rank placeholders"]
  initMincross --> class2["class2 (classify.ts)"]
  initMincross --> decompose["decompose (decomp.ts)"]
  initMincross --> buildRanksRoot["buildRanks ROOT (mincross-build.ts)<br/>PLACE c @ root rank1"]
  buildRanksRoot --> installRoot["installInRank → placeInRankSlot"]
  mincrossOrder["mincrossPassSetup (mincross-order.ts)"] --> buildRanksRoot
  expandCluster["expandCluster (cluster.ts)"] --> buildRanksClu["buildRanks cluster0<br/>PLACE c @ root rank1 AGAIN"]
  buildRanksClu --> installClu["installInRank → placeInRankSlot"]
  installRoot --> rankArr[("root GD_rank[1].v<br/>= [c, c, null]  ← duplicate")]
  installClu --> rankArr
  rankArr --> furthest["furthestNode / neighborNode<br/>(mincross-utils.ts) → HANGS"]

  classDef bug fill:#fdd,stroke:#c00;
  class dotRank,buildRanksClu,rankArr,furthest bug;
```

The faithful question (Batch 1): in C, why is `c` NOT installed by both? C
collapses cluster members behind a CLUSTER pseudo-node at the enclosing level so
the root `build_ranks` installs the cluster as one node, and the cross-cluster
`rank=same` is resolved without double-routing `c`. The TS divergence is the
mission target.
