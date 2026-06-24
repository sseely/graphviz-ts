<!-- SPDX-License-Identifier: EPL-2.0 -->

# Data flow — long-edge spline routing (where the piece count is decided)

```mermaid
sequenceDiagram
    participant RD as routeDotEdges (edge-route.ts)
    participant CH as routeChainSegmented (edge-route-chain.ts)
    participant FA as maximalBbox/rankBox (edge-route-faithful.ts)
    participant RS as routeSplinesInternal (splines-routespl.ts)
    participant SP as Pshortestpath
    participant PR as routeSpline=Proutespline (pathplan/route.ts)

    RD->>CH: route multi-rank edge (order = C dot_splines_)
    Note over CH: smode? straightLen >= threshold<br/>→ split chain into segments<br/>(SUSPECT A: one fewer segment)
    CH->>FA: build box corridor per segment
    FA-->>CH: boxes (maximal_bbox / rank_box)
    CH->>RS: routeSplines(P) per segment
    RS->>SP: Pshortestpath(poly, eps) → pl
    Note over RS,SP: SUSPECT B: corridor so close pl<br/>bends one less → fewer pieces
    RS->>PR: Proutespline(edges, pl, evs)
    Note over PR: reallyroutespline splinefits<br/>(faithful — premise NOT the bug;<br/>SUSPECT C only if A/B clean)
    PR-->>RS: spline control points (3 vs oracle 4)
```

S1 walks this chain for `sleep--runmem` (p3), dumping each hand-off in both C and
the port. The first field that differs (smode segments → corridor boxes/`pl` →
slopes → fitted pieces) is the root cause.
