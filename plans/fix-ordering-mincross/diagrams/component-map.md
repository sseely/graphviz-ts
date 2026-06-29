# Component map — affected components

```mermaid
graph TD
    subgraph mincross [src/layout/dot]
      MC[mincross.ts<br/>orchestration + orderedEdges calls]
      MB[mincross-build.ts<br/>doOrderingNode / doOrderingAddFlatEdges / orderedEdges<br/>SUSPECT A: constraint construction]
      MO[mincross-order.ts<br/>median / transpose / reorder<br/>SUSPECT B: order preservation]
      MX[mincross-cross.ts<br/>crossing counts]
    end
    subgraph spec [~/git/graphviz/lib/dotgen]
      C[mincross.c<br/>do_ordering_node / ordered_edges / build_ranks / mincross_step]
    end
    subgraph diag [test/diagnostic]
      D[flat-geom-diff.mjs<br/>+ ellipse support T0]
      T[ordering-trace.md<br/>pinned divergence T0]
    end
    subgraph gate [test/corpus]
      S[survey.ts + rules-gate.ts<br/>0-regression gate]
      P[parity.json / parity-rules.json / PARITY.md<br/>baseline refresh T2]
    end

    C -. spec for .-> MB
    C -. spec for .-> MO
    MC --> MB
    MB --> MO
    T -. pins .-> MB
    T -. pins .-> MO
    MB -.->|fix T1| S
    MO -.->|fix T1| S
    S --> P
```

Write-set is decided by T0: the fix lands in `mincross-build.ts` (Suspect A)
and/or `mincross-order.ts` (Suspect B). `flat-geom-diff.mjs` gets the ellipse fix
in T0; the baseline files refresh in T2.
