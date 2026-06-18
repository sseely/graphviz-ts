# Component map — touched modules

```mermaid
graph TD
  subgraph writeset[Pre-authorized write-set]
    ORD[mincross-order.ts<br/>medians, reorder, reorderInner<br/>LAYER 1 fix]
    CRS[mincross-cross.ts<br/>transpose, transposeStep,<br/>transposeCounts/accumCross, exchange<br/>LAYER 2 fix likely here]
    ORDT[mincross-order.test.ts]
    CRST[mincross-cross.test.ts]
  end
  subgraph readonly[Read-only context]
    UTIL[mincross-utils.ts<br/>rankGet/rankSet/vStart]
    BUILD[mincross-build.ts<br/>buildRanks/installInRank<br/>order=vStart+n absolute]
    MX[mincross.ts<br/>dotMincross, initMccomp]
  end
  ORD -->|rankGet| UTIL
  CRS -->|rankGet, exchange| UTIL
  MX --> ORD
  MX --> CRS
  ORD --> CRS
  BUILD -->|sets ND_order absolute| UTIL
  CSRC[~/git/graphviz C spec<br/>mincross.c / cluster.c<br/>TEMP instrumentation only] -.oracle.-> CRS
```

`mincross.ts`, `mincross-build.ts`, `mincross-utils.ts` are **read-only** — the
order/window invariant (`ND_order == absolute index`) is established there and
must hold; the fix lives only in the ordering passes.
