<!-- SPDX-License-Identifier: EPL-2.0 -->

# Component map

Files touched, by subsystem, and which task owns each.

```mermaid
graph TD
  subgraph NS["network-simplex (T1)"]
    nsr["ns-range.ts<br/>dfsRange / dfsRangeInit / dfsCutval"]
    ns["ns.ts<br/>rerank, enterEdge, accessors"]
    nsc["ns-core.ts<br/>nsSlack, seq"]
  end
  subgraph REC["deep recursion (T2, conditional)"]
    acy["acyclic.ts dfs"]
    str["straight-edges.ts dfs"]
    sub["ns-subtree.ts treeAdjust"]
  end
  subgraph MC["mincross (T3, conditional)"]
    mc["mincross.ts<br/>reorderInner / accumCross / transposeStep / rcross"]
  end
  subgraph PARSE["parser (T4)"]
    peg["dot.pegjs → dot.js"]
  end
  subgraph VAL["validation (T5)"]
    sv["survey.ts + dashboard.ts"]
    pj["parity.json / PARITY.md"]
    cmp["comparisons/**"]
  end

  nsr -->|dominant 40% hotspot| HOT([rescues 2471,1718,2475_2,b100,b104,2222])
  ns -->|rerank overflow| FIX2108([rescues 2108 crash])
  acy -.->|only if still overflows| FIX2108
  mc -.->|only if 2471 > 3x native| HOT
  peg --> SV5([T5 gate])
  HOT --> sv
  FIX2108 --> sv
  sv --> pj --> cmp
```

## Ownership (one writer per file)

| File | Task |
|---|---|
| ns-range.ts, ns.ts, ns-core.ts | T1 |
| acyclic.ts, straight-edges.ts, ns-subtree.ts | T2 |
| mincross.ts (+ mincross-*.ts) | T3 |
| parser/dot.pegjs, parser/dot.js | T4 |
| corpus/parity.json, PARITY.md, comparisons/** | T5 |

No two concurrent tasks share a file. T1∥T4 (batch-1); T2∥T3 (batch-2); T5 alone.
