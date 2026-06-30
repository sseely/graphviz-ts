<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map — root_twopi spline divergence

Candidate origin components (Batch 1 pins the single one). Node positions are
exact, so the divergence is downstream of ranking/position, in edge routing.

```mermaid
graph TD
  subgraph dispatch [edge-route.ts]
    RO[routeOneEdge dispatch]
  end
  subgraph chain [edge-route-chain.ts]
    RMR[routeMultiRankEdgeFaithful]
    RBE[routeBackEdge]
    RCS[routeChainSegmented]
    RS[recoverSlack]
  end
  subgraph faithful [edge-route-faithful.ts]
    MBB[maximalBbox]
    RB[rankBox]
    CRP[completeRegularPath]
  end
  subgraph fitter [common/splines-routespl.ts]
    RSPL[routeSplines]
  end

  RO --> RMR --> RCS
  RO --> RBE --> RCS
  RCS --> MBB
  RCS --> RB
  RCS --> CRP
  RCS --> RS
  RCS --> RSPL

  RO -. "311E->312E: first-segment delta (21pt)" .-> SUS1{{box-corridor vs fitter?}}
  RO -. "280->586E: 4 vs 7 ctrl points" .-> SUS2{{piece-count: recover_slack / routing order?}}

  SUS1 --- MBB
  SUS1 --- RSPL
  SUS2 --- RS
  SUS2 --- RCS

  classDef suspect fill:#fdd,stroke:#900;
  class SUS1,SUS2 suspect;
```

**Reading:** `311E->312E` (same point count, first-segment shape off 21pt) points
at the box corridor near the tail (`maximalBbox`) or the fitter
(`routeSplines`/Proutespline). `280->586E` (extra segment) points at piece-count
— `recoverSlack` vnode mutation or `edgecmp` routing order changing the corridor.
Batch 1's box-vs-fitter experiment (equal boxes ⇒ fitter; different boxes ⇒
upstream) disambiguates, exactly as in `plans/fix-1213-splines/`.
