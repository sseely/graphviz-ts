<!-- SPDX-License-Identifier: EPL-2.0 -->

# Data flow — AGSEQ assignment vs C

```mermaid
sequenceDiagram
  participant P as parser/builder
  participant R as root Graph (counter)
  participant SG as subgraph Graph
  participant SVG as svgClusterId

  Note over P,R: nestedclust.gv — counter starts at 0 (root.seq=0 → graph0)
  P->>SG: new Graph("%1" anon)
  P->>R: assignSubgSeq → ++counter = 1
  R-->>SG: sg.seq = 1
  P->>SG: new Graph("cluster_ss81")
  P->>R: ++counter = 2
  R-->>SG: sg.seq = 2
  Note over P,R: anon subgraphs 3,4,5 …
  P->>SG: new Graph("cluster_x")
  P->>R: ++counter = 6
  R-->>SG: sg.seq = 6
  P->>SG: new Graph("cluster_y")
  P->>R: ++counter = 7
  R-->>SG: sg.seq = 7
  SVG->>SG: read seq → "clust2", "clust6", "clust7"
```

Mirrors C: `agnextseq(par, AGRAPH)` = `++clos->seq[AGRAPH]` (graph.c:152),
assigned when the subgraph opens, before its body recurses.
