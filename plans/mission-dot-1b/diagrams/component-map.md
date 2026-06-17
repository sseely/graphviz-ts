# Component map — fitter web & DOT-1b migration

Current state: the faithful path routes all single edges; the **fitter** (red)
survives in two paths (adjacent-back fallback, parallel-group router).

```mermaid
graph TD
  subgraph live[Live dispatch]
    ROE[routeOneEdge / routeDotEdges]
    RPG[routeParallelEdgeGroup<br/>splines-route.ts]
  end
  subgraph faithful[Faithful pathplan - keep]
    RREF[routeRegularEdgeFaithful]
    RMREF[routeMultiRankEdgeFaithful]
    CAI[clipAndInstall + buildDotSinfo]
    RS[routeSplines]
  end
  subgraph fitter[Simplified fitter - DELETE in T4]
    CS[computeSpline / computeSplineMulti]
    BRC[buildRankCorridor]
    CTN[clipToNodes]
    SES[straightEdgeSplineWithRank<br/>routeWithRank / routeSimple]
    RER[routeEdgeRaw / applyEndArrows]
    RFMR[routeFwdMultiRankEdge / fitterBackFwdPoints]
  end

  ROE -->|adjacent/multi-rank fwd| RREF
  ROE -->|multi-rank back| RMREF
  ROE -.->|adjacent back: DECLINES -> fitter| SES
  RPG -.->|baseSplineForGroup| CS
  RPG -.->|installShiftedEdge| CTN
  RREF --> RS
  RMREF --> RS
  RREF --> CAI

  classDef del fill:#fde8e8,stroke:#c00;
  classDef keep fill:#eef7ee,stroke:#0a0;
  class CS,BRC,CTN,SES,RER,RFMR del;
  class RREF,RMREF,CAI,RS keep;
```

## Target state (after T1–T4)

```mermaid
graph TD
  ROE[routeOneEdge] -->|all single edges| RREF[faithful pathplan]
  ROE -->|adjacent back: T1 makeFwdEdge| RREF
  RPG[routeParallelEdgeGroup: T3 shared faithful base + makeFwdEdge] --> RREF
  RREF --> CAI[clipAndInstall]
  RREF --> RS[routeSplines]
```

| Path | Today | DOT-1b |
|------|-------|--------|
| single fwd/multi-rank/multi-rank-back | faithful | unchanged |
| adjacent back (b→a, 1 rank) | **fitter fallback** | T1 faithful |
| parallel/opposing group | **fitter** (computeSpline) | T3 faithful (mirror C) |
| fitter functions + T1 scaffolding + harness | present | **deleted (T4)** |
