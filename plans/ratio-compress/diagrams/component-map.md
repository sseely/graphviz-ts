<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map — ratio=compress

```mermaid
graph TD
  A["graph attrs<br/>ratio= / size="] -->|T1: parseRatioKind + parseDrawingSize| B["dotGraphInit<br/>(init.ts)"]
  B -->|"g.info.drawing = {ratioKind:'compress', size, filled}"| C["g.info.drawing<br/>(was NEVER set)"]

  C -->|read| D["compressGraph<br/>(position-cluster.ts)"]
  D -->|"ratioKind==='compress'"| E["containNodes + makeLrvn<br/>ln→rn weight-1000 edge"]
  E --> F["x-coord network simplex<br/>compresses layout"]

  C -.->|"ratioKind null for compress"| G["setAspect<br/>(position-bbox.ts)"]
  G -.->|"aspectScaleFactors → null → no-op"| H["(no scaling for compress)"]

  classDef inscope fill:#d5e8d4,stroke:#82b366
  classDef dead fill:#f8cecc,stroke:#b85450
  classDef live fill:#dae8fc,stroke:#6c8ebf
  class A,B,C inscope
  class D,E,F live
  class G,H dead

  subgraph "Batch 2 — DEAD, captured (not wired by T1)"
    I["aspectFillScale  (T2)"]:::dead
    J["aspectExpandScale (T3)"]:::dead
    K["aspectValueScale (T4)"]:::dead
    L["idealsize / auto  (T5, UNPORTED)"]:::dead
  end
  G -.->|"fill/expand/value when drawing set (deferred)"| I
  G -.-> J
  G -.-> K
  G -.-> L
```

**Legend:** green = T1 wiring (in scope) · blue = already-ported live machinery
that T1 switches on · red = dead/unported ratio-aspect code captured as Batch 2
tasks. The single root cause is the unpopulated `g.info.drawing`.
