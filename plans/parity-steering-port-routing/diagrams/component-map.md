# Component map — steering-port routing

How dot routing relates to the faithful pipeline this mission wires in.

```mermaid
graph TD
  subgraph dot["dot layout (src/layout/dot)"]
    DS[dotSplines / routeDotEdges<br/>splines.ts]
    ROE[routeOneEdge<br/>edge-route.ts — SIMPLIFIED]
    MRE[makeRegularEdge<br/>splines-route.ts — partial]
    BRC[buildRankCorridor + computeSpline<br/>monotonic corridor only]
    DS --> ROE
    DS -.-> MRE
    ROE --> BRC
    MRE --> BRC
  end

  subgraph faithful["faithful routesplines (src/common, src/pathplan) — PORTED, proven via neato"]
    BP[beginPath / endPath<br/>splines-path-begin.ts / -end.ts<br/>BeginRegSide / EndRegSide side boxes]
    RS[routeSplines / checkPath / limitBoxes<br/>splines-routespl.ts]
    CAI[clipAndInstall / newSpline<br/>splines-clip.ts]
    PP[Proutespline / Pshortestpath<br/>src/pathplan]
    BP --> RS --> PP
    RS --> CAI
  end

  subgraph other["neato / pack / ortho"]
    NEATO[neato/splines.ts] --> BP
  end

  MRE -. "THIS MISSION: wire ported-with-side edges here (AD1/AD2)" .-> BP

  classDef gap fill:#fdd,stroke:#c00;
  classDef good fill:#dfd,stroke:#0a0;
  class BRC gap;
  class BP,RS,CAI,PP good;
```

- Red: the simplified fitter that truncates loop corridors (the blocker).
- Green: the faithful pipeline, already ported and exercised by neato.
- Dashed mission arrow: route dot's side-port edges through `beginPath` →
  `routeSplines` → `clipAndInstall`, gated to ported-with-side edges first
  (AD2), full-switch decided in SR9 (AD3).
