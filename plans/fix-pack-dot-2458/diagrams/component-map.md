# Component map — touched vs reused

```mermaid
graph LR
  subgraph write["Write-set (this mission)"]
    IDX["dot/index.ts<br/>doDot wrapper + entry routing"]
    PC["dot/pack-components.ts (new)<br/>component loop, initSubg,<br/>cluster-carry, copyClusterInfo"]
    T["pack-components.test.ts<br/>+ goldens pack-2458 / pack-clusters"]
  end
  subgraph reuse["Reused as-is (DO NOT MODIFY — ADR-3)"]
    PK["pack/index.ts<br/>ccomps, getPack*, getPackInfo,<br/>packSubgraphs, shiftGraphs (points)"]
    PIPE["dot/index.ts:dotLayoutPipeline<br/>rank/mincross/position/post"]
    TWO["twopi/* (template only)"]
  end
  subgraph baseline["Refreshed (T4)"]
    PJ["test/corpus/parity.json"]
    PM["test/corpus/PARITY.md"]
  end

  IDX --> PC
  IDX --> PIPE
  PC --> PK
  PC --> PIPE
  T --> IDX
  T --> PC
  IDX -. verified by .-> PJ
  PJ --> PM
```

- **index.ts / pack-components.ts** — the only source changes.
- **pack/** and **twopi/** — reused; touching them is a STOP condition.
- **parity.json / PARITY.md** — refreshed in T4 (Estimate+ghl recipe).
