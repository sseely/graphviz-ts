# Component map — cluster mincross

```mermaid
graph TD
  dotMincross["dotMincross(g)"] --> runComponents["runComponents → mincross(g,0)<br/>BUG: stuck at cur_cross 1 (C reaches 0)"]
  dotMincross --> merge2["merge2(g)"]
  dotMincross --> runClusters["runClusters → mincrossClust(clust)"]
  dotMincross --> runRemincross["runRemincross<br/>markLowclusters + mincross(g,2)"]
  runComponents --> mincrossMain["mincrossMain(g,0)"]
  mincrossMain --> mincrossStep["mincrossStep"]
  mincrossStep --> medians["medians + reorder"]
  mincrossStep --> transpose["transpose / transposeStep"]
  transpose --> left2right["left2right / left2rightCluster<br/>SUSPECT: cluster guard blocks the swap"]

  classDef bug fill:#fdd,stroke:#c00;
  class runComponents,left2right bug;
```

Defect is in the first root `mincross(g,0)`: the crossing-removing reorder C
makes is rejected/missed by TS. Prime suspect: `left2right` cluster contiguity
guard active too early. T1 localizes exactly.
