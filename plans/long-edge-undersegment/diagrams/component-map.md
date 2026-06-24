<!-- SPDX-License-Identifier: EPL-2.0 -->

# Component map — affected modules

```mermaid
graph TD
    subgraph dot [src/layout/dot]
        ERC[edge-route-chain.ts<br/>routeChainSegmented, straightLen,<br/>smodeThreshold, recoverSlack]
        ERF[edge-route-faithful.ts<br/>maximalBbox, rankBox,<br/>completeRegularPath/adjustRegularPath]
        ERO[edge-order.ts<br/>routing order — DONE, not touched]
    end
    subgraph common [src/common]
        RSP[splines-routespl.ts<br/>routeSplinesInternal, limitBoxes]
    end
    subgraph pathplan [src/pathplan]
        RT[route.ts<br/>Proutespline/reallyroutespline<br/>FAITHFUL — premise not the bug]
    end

    ERC --> ERF
    ERC --> RSP
    RSP --> RT
    ERO -.already correct.-> ERC

    classDef suspect fill:#fdd,stroke:#c00;
    classDef faithful fill:#dfd,stroke:#0a0;
    class ERC,ERF,RSP suspect;
    class RT,ERO faithful;
```

Red = candidate fix sites (S1 picks one). Green = verified faithful / already
fixed; touch only if S1 proves the premise wrong (→ stop & re-scope).
