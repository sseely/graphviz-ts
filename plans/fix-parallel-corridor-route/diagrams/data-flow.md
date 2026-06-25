<!-- SPDX-License-Identifier: EPL-2.0 -->

# Data flow — parallel/opposing cross-rank edge routing

## Current (buggy) vs target (faithful)

```mermaid
sequenceDiagram
    participant D as dispatchEdgeGroup (splines.ts)
    participant R as routeParallelEdgeGroup (splines-route.ts)
    participant B as baseSplineForGroup / routeRegularEdgeFaithful
    participant P as pathplan corridor (shortest+route)
    participant I as installShiftedEdge / clip_and_install

    Note over D: parallel cross-rank group (uniq>1)
    D->>R: edges (sorted by origSeq), multisep
    rect rgb(255,235,235)
    Note over R,B: CURRENT — one base from un-offset centers, then x-shift
    R->>B: baseSplineForGroup(edges[0])  %% centered
    B->>P: route from NODE CENTERS
    P-->>B: polyline (clips cluster corner → under-segments)
    B-->>R: base spline
    R->>I: shiftInteriorPts(base, ±dx) per edge
    end
    rect rgb(235,255,235)
    Note over R,B: TARGET (ADR-3) — per-edge offset ports, route each
    R->>B: for each edge: offset its tail/head PORTS by its perp offset
    B->>P: route EACH edge from its own offset ports
    P-->>B: corridor polyline that clears the obstacle
    B-->>R: per-edge spline (matches C make_regular_edge pt-count)
    R->>I: install each (back-edge members reversed by edgeNormalize)
    end
```

## ldbxtried symptom (n0 inside cluster0 → n2 outside)

```mermaid
graph LR
    subgraph C_oracle["C (20-pt curve)"]
        c0[n0 in cluster0] -->|out-right + down around cluster| c2[n2 @848,-203]
    end
    subgraph Port_bug["Port (8-pt near-straight)"]
        p0[n0] -->|short straight, ends ~985,-483 — misses n2| px[wrong endpoint]
    end
```
