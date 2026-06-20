<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map

```mermaid
graph TD
    subgraph edge-route-chain.ts
      RMF[routeMultiRankEdgeFaithful<br/>forward edges]
      FBF[faithfulBackFwdPoints<br/>back edges]
      RCS[routeChainSegmented<br/>NEW - owns smode loop]
      RS_helpers[chainBoxes / chainSegments / maximalBbox refs]
    end
    subgraph splines-route.ts
      SL[straightLen<br/>already ported, wire it]
      SP[straightPath<br/>NEW - T1]
    end
    subgraph common/splines-routespl.ts
      RSPL[routeSplines<br/>consumes Port.theta/constrained]
    end

    RMF --> RCS
    FBF --> RCS
    RCS --> SL
    RCS --> SP
    RCS --> RS_helpers
    RCS --> RSPL

    subgraph tests
      GS[golden suite + manifest]
      PAR[corpus survey / PARITY.md]
    end
    RCS -.verified by.-> GS
    RCS -.verified by.-> PAR
```

Touched (write-set): `splines-route.ts` (T1), `edge-route-chain.ts` (T2a, T2b),
test files + goldens + parity (T3). `routeSplines` and the `edge-route-faithful`
box helpers are read-only dependencies — already complete.
