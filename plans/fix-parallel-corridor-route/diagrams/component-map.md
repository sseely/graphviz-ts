<!-- SPDX-License-Identifier: EPL-2.0 -->

# Component map — affected files

```mermaid
graph TD
    splines["splines.ts<br/>dispatchEdgeGroup"] --> route["splines-route.ts<br/>routeParallelEdgeGroup ★T1.2"]
    splines --> straight["straight-edges.ts<br/>makeStraightEdges ⊙T1.3"]
    route --> faithful["edge-route-faithful.ts<br/>baseSplineForGroup /<br/>routeRegularEdgeFaithful ★T1.2"]
    faithful --> boxes["edge-route-boxes.ts ⊙T1.4"]
    faithful --> routing["edge-route-routing.ts ⊙T1.4"]
    boxes --> pathplan["src/pathplan/* (read-only — OUT OF SCOPE, ADR-5 STOP if needed)"]
    routing --> pathplan
    faithful --> clip["edge-route-clip.ts<br/>clip_and_install (read-only)"]

    classDef fix fill:#dfd,stroke:#393
    classDef cond fill:#ffd,stroke:#993
    classDef ro fill:#eee,stroke:#999
    class route,faithful fix
    class straight,boxes,routing cond
    class pathplan,clip,splines ro
```

★ = primary fix (T1.2) · ⊙ = conditional on T0.3 (T1.3/T1.4) · grey = read-only.

**Hard boundary (ADR-5):** `src/pathplan/*` is read-only. If Batch 0 finds the fix
needs pathplan changes, STOP and re-plan.
