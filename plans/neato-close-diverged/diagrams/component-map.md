<!-- SPDX-License-Identifier: EPL-2.0 -->

# Component map — neato divergence buckets → source

```mermaid
graph TD
  subgraph neato[src/layout/neato]
    IDX[index.ts:197-260<br/>ccomps · packGraphs · computeSubgraphBB]
    INIT[init.ts<br/>node/label sizing]
    ADDCL[index.ts:224 addClusters<br/>cluster bbox + label]
    SPL[splines.ts · multispline.ts<br/>multispline-router.ts]
  end
  subgraph pack[src/layout/pack]
    POLY[poly-pack.ts]
    ARR[array-pack.ts]
  end
  LBL[edge-label placement<br/>common/neato — locate in T4]

  B1[B1 graph-bb / packing ×44]:::hot --> IDX
  B1 --> POLY
  B1 --> ARR
  B1 -.sizing.-> INIT
  B3[B3 cluster ×4] --> ADDCL
  B4[B4 edge-labels ×7] --> LBL
  B2[B2 splines ×37] --> SPL
  B5[B5 arrowheads ×3] --> SPL

  IDX -. node pos cascades .-> SPL
  IDX -. node pos cascades .-> LBL
  classDef hot fill:#f9d,stroke:#c06;
```

Cascade: `index.ts` component placement determines node coords → any spline,
label, or arrowhead attached to a moved node diverges. Fix B1, re-sweep, then
the residual B2/B4/B5 sets shrink to their genuine (non-cascade) defects.
