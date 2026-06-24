<!-- SPDX-License-Identifier: EPL-2.0 -->

# Component map

```mermaid
graph TD
  subgraph parse[Parse / build]
    B[parser/builder.ts<br/>processSubgraph] -->|new Graph + assignSubgSeq| G[model/graph.ts<br/>Graph.seq + root counter]
    API[api/builder.ts<br/>addSubgraph] --> AG[model/cgraph-ops.ts<br/>agsubg + assignSubgSeq]
    AG --> G
  end
  subgraph render[Render]
    SC[render/svg-cluster.ts<br/>svgBeginCluster] --> SI[render/svg-id.ts<br/>svgClusterId]
    SI -->|reads sg.seq| G
    JOB[gvc/job.ts<br/>clusterId REMOVED]:::removed
  end
  G -.AGSEQ.-> SI
  classDef removed fill:#fdd,stroke:#900,stroke-dasharray:4;
```

`Graph.seq` (T1) is the single contract; both creation paths write it via
`assignSubgSeq`, and `svgClusterId` (T2) reads it. `job.clusterId` is deleted.
