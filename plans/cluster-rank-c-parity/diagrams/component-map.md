# Component map — cluster ranking call chain

```mermaid
graph TD
  dotRank["dotRank(g)"] --> dot1Rank["dot1Rank(g)"]
  dot1Rank --> collapseSets["collapseSets(g,g)"]
  collapseSets --> collapseCluster["collapseCluster(g, subg)"]
  collapseCluster --> nodeInduce["nodeInduce(g, subg)"]
  collapseCluster --> recurse["dot1Rank(subg) — LOCAL rank<br/>BUG: returns all-zero ranks"]
  collapseCluster --> clusterLeader["clusterLeader(subg)"]
  dot1Rank --> class1["class1(g)"]
  class1 --> interclust1["interclust1(g,t,h,e)<br/>offset = minlen + tRank - hRank<br/>degenerates to 1 when tRank=0"]
  dot1Rank --> rank1["rank1(g) — network simplex"]
  dot1Rank --> expandRanksets["expandRanksets(g)<br/>rank += leader.rank"]
  expandRanksets --> setMinmax["setMinmax(cluster)"]

  recurse -. "fault site" .-> rank1
  recurse -. "fault site" .-> nodeInduce

  classDef bug fill:#fdd,stroke:#c00;
  class recurse,interclust1 bug;
```

Faithful (verified): `class1`, `interclust1`, `clusterLeader`, `setMinmax`,
`expandNode`. Defect: `dot1Rank(subg)` produces no local ranks, starving
`interclust1`'s offset.
