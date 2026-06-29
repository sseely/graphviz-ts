# Component map — affected components

```mermaid
graph TD
    subgraph mincross [src/layout/dot]
      MB[mincross-build.ts<br/>buildRanks / enqueueNeighbors / installInRank<br/>SUSPECT A: install-order enforcement]
      FG[fastgr.ts<br/>newVirtualEdge orig=null defaults<br/>SUSPECT B: weight/count/xpenalty/minlen = 1 vs C calloc-0]
      MF[mincross-flat.ts<br/>flatReorder / constrainingFlatEdge / flatSearch<br/>SUSPECT C: weight-1 reordering]
    end
    subgraph spec [~/git/graphviz/lib/dotgen]
      C[mincross.c build_ranks/flat_reorder/flat_search<br/>fastgr.c new_virtual_edge]
    end
    subgraph diag [test/diagnostic]
      T[flatorder-enforce-trace.md<br/>pinned divergence T0]
    end
    subgraph gate [test/corpus]
      S[survey.ts + rules-gate.ts<br/>0-regression gate]
      P[parity.json / parity-rules.json / PARITY.md<br/>baseline refresh T2]
    end

    C -. spec for .-> MB
    C -. spec for .-> FG
    C -. spec for .-> MF
    T -. pins .-> MB
    T -. pins .-> FG
    T -. pins .-> MF
    MB -.->|fix T1| S
    S --> P
```

Write-set is decided by T0: the fix lands in `mincross-build.ts` (install order)
and/or `fastgr.ts` (orig=null defaults) and/or `mincross-flat.ts` (weight handling).
The baseline files refresh in T2.
