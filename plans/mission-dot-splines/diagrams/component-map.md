# Routing dispatch map

Current dispatch in `edge-route.ts:routeOneEdge`. Bold = simplified fitter
(to retire); italic = faithful path (to become the only path).

```mermaid
graph TD
  R[routeOneEdge] -->|dir != forward| NF[routeEdgeNonForward]
  R -->|multi-rank back| BK[routeBackEdge]
  R -->|multi-rank fwd| MF{side-port or label?}
  R -->|adjacent fwd| FW[routeForwardEdge]

  MF -->|yes| FMR[routeFaithfulMultiRank → routeMultiRankEdgeFaithful]
  MF -->|no| FMRfit[routeFwdMultiRankEdge → computeSplineMulti]

  FW -->|flat label| FL[makeFlatLabeledEdge / makeAdjFlatLabeledEdge]
  FW -->|side port| FSP[routeFaithfulSidePort → routeRegularEdgeFaithful]
  FW -->|plain| FWfit[straightEdgeSplineWithRank]

  classDef fit fill:#fde8e8,stroke:#c00;
  classDef faith fill:#eef7ee,stroke:#0a0;
  class FMRfit,FWfit fit;
  class FMR,FSP fit2;
  class FMR,FSP,FL faith;
```

## Migration target

```mermaid
graph TD
  R[routeOneEdge] -->|dir != forward| NF[faithful non-forward]
  R -->|multi-rank back| BK[faithful back chain]
  R -->|multi-rank fwd| FMR[routeMultiRankEdgeFaithful]
  R -->|adjacent fwd| FW[routeRegularEdgeFaithful + flat-label dispatch]
```

| Category | Today | Batch |
|----------|-------|-------|
| adjacent fwd, side-port / label | faithful | done |
| adjacent fwd, plain | **fitter** | T2 |
| multi-rank fwd, label/port | faithful | done |
| multi-rank fwd, plain | **fitter** (computeSplineMulti) | T3 |
| multi-rank back | **fitter/chain** | T4 |
| non-forward (dir=back/both/none) | **fitter** | T4 |
| rankdir=LR/RL/BT (all above) | **fitter** | T5 verify |
| fitter deletion | — | T6 |
