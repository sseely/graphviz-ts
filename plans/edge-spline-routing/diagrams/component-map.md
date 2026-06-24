<!-- SPDX-License-Identifier: EPL-2.0 -->

# Component map — edge spline routing

```mermaid
graph TD
  A[dot layout: ranks + node positions<br/>MATCH oracle ✓] --> B[edge-route chain<br/>src/layout/dot/edge-route-chain.ts]
  B --> C[routesplines / box corridor<br/>src/common/splines-routespl.ts]
  C -->|boxes + input points + slopes| D[Proutespline<br/>src/pathplan/route.ts]
  D --> E[reallyRoutespline: fit 1 bezier,<br/>split if not splineIsInside<br/>FAITHFUL to C ✓]
  E --> F[SVG path/@d emit]

  style A fill:#d5f5d5
  style E fill:#d5f5d5
  style B fill:#fff2cc
  style C fill:#fff2cc
  style D fill:#fff2cc
  style F fill:#f5d5d5

  classDef suspect stroke:#cc0000,stroke-width:2px;
  class B,C,D suspect
```

Green = verified matching the oracle. Yellow + red border = the suspect upstream
zone S1 must bisect (box corridor / input chain / endpoint slopes). Red = the
observable divergence (extra bezier piece in `path/@d`).
