# Curved dispatch + compound pass (vs C)

## Where curved plugs in (mirrors dotsplines.c)

```mermaid
flowchart TD
    DS["dotSplines_(g)"] --> NONE{et == NONE?}
    NONE -->|yes| RET0[return 0]
    NONE -->|no| ORTHO{et == ORTHO?}
    ORTHO -->|yes| OE[orthoDispatch — done, ortho-P3]
    ORTHO -->|no| TOP["curved top (dotsplines.c:241-247):<br/>if CURVED: resetRW + warn-on-labels (no downgrade)"]
    TOP --> LOOP["edge-group routing loop"]
    LOOP --> CV{et == CURVED?}
    CV -->|yes NEW T1| MSE["makeStraightEdges(g, list, cnt, CURVED, sinfo)<br/>bend(get_cycle_centroid) or perp-spread → clipAndInstall"]
    CV -->|no| REG["normal per-group spline routing (unchanged)"]
    MSE --> FIN["finish (dotsplines.c:461-465):<br/>CURVED skips routesplinesterm"]
    REG --> FIN

    classDef new fill:#d4edda,stroke:#28a745;
    classDef done fill:#cce5ff,stroke:#007bff;
    class MSE,TOP new
    class OE done
```

## Compound (already wired — T2 verifies)

```mermaid
flowchart LR
    P["dot pipeline: … dotSplines → dotCompoundEdges"] --> C{g.info.compound?}
    C -->|yes| CE["dotCompoundEdges (index.ts:128, T38)<br/>clipCompoundHead/Tail to cluster bb"]
    C -->|no| SKIP[skip]
    CE --> V["T2: golden vs native C — fix compound*.ts only if divergent"]

    classDef done fill:#cce5ff,stroke:#007bff;
    class CE done
```

Blue = already implemented. Green = new in this mission (T1). T2 mints native-C
goldens for both and fixes the TS to match C on any divergence.
