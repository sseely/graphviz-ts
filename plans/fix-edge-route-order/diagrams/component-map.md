<!-- SPDX-License-Identifier: EPL-2.0 -->

# Component map — affected modules

```mermaid
graph TD
    subgraph "src/layout/dot (MODIFY)"
        SP["splines.ts<br/>dotSplines_ / routeEdgeGroup / dispatchEdgeGroup"]
        ER["edge-route.ts<br/>routeDotEdges / routeOneEdge"]
        EO["edge-order.ts<br/>edgeRouteCmp (read; T1.3 conditional)"]
    end
    subgraph "src/layout/dot (READ-ONLY — do not change)"
        RPG["splines-route.ts<br/>routeParallelEdgeGroup"]
        RRF["edge-route-faithful.ts<br/>routeRegularEdgeFaithful"]
        RC["edge-route-chain.ts<br/>recoverSlack (faithful)"]
    end
    subgraph "C spec"
        CDS["dotsplines.c<br/>dot_splines_ single edge loop"]
    end
    subgraph "test (Batch 1/2)"
        GLD["test/golden/* (ldbxtried + repro)"]
        PAR["test/corpus/parity*.json + PARITY.md"]
    end

    SP -->|"cnt==1 → routeOneEdge (in edgecmp order)"| ER
    SP -->|"cnt>1"| RPG
    ER --> RRF
    RPG --> RC
    RRF -.reads moved vnode.-> RC
    SP -.order from.-> EO
    CDS -.faithful order target.-> SP
    SP --> GLD
    GLD --> PAR
```

**Change locus:** `splines.ts` + `edge-route.ts` fold the two passes into one
`edgecmp` loop (ADR-3 / Option A). `edge-order.ts` is read-only unless T0.3 finds
the comparator diverges (T1.3). `routeParallelEdgeGroup`, `routeRegularEdgeFaithful`,
and `recoverSlack` are correct and must not change (ADR-5 STOP if they must).
