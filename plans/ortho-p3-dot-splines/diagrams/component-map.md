# Component map — affected components

```mermaid
graph TD
    subgraph dot["src/layout/dot (this mission)"]
        SP["splines.ts: dotSplines_ (+ortho branch, +resetRW)"]:::mod
        AD["ortho-adapter.ts (NEW, T1)"]:::new
        LB["splines-label.ts (T2, maybe setEdgeLabelPos wrapper)"]:::mod
    end

    subgraph ortho["src/ortho (existing; fixes only on golden divergence)"]
        OE["index.ts: orthoEdges"]:::existing
        MZ["maze.ts"]:::existing
        PT["partition.ts"]:::existing
        RT["ortho-route.ts"]:::existing
        P1["rawgraph/trapezoid/sgraph/fpq (P1, oracle-pinned)"]:::pinned
    end

    subgraph neato["src/layout/neato (reference, NOT modified)"]
        NS["splines.ts: OrthoHelper (pattern to mirror)"]:::ref
    end

    subgraph gold["test/golden (T3)"]
        IN["inputs/dot-ortho-*.dot (NEW)"]:::new
        RF["refs/dot-ortho-*.svg (NEW, native-C)"]:::new
        MF["manifest.json (append)"]:::mod
    end

    SP --> AD
    SP --> LB
    AD --> OE
    OE --> MZ --> PT
    OE --> RT
    PT --> P1
    NS -. mirrored by .-> AD
    SP --> IN
    IN --> RF

    classDef new fill:#d4edda,stroke:#28a745;
    classDef mod fill:#fff3cd,stroke:#ffc107;
    classDef existing fill:#e2e3e5,stroke:#6c757d;
    classDef pinned fill:#cce5ff,stroke:#007bff;
    classDef ref fill:#f8d7da,stroke:#dc3545;
```

**Legend:** green = new · yellow = modified · grey = existing (touched only on
golden divergence) · blue = P1 oracle-pinned · red = reference only (not modified).
