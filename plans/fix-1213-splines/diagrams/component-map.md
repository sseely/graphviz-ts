<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map — 1213 constraint=false spline divergence

Pipeline stages a `constraint=false` edge passes through, and where the divergence is
suspected (Batch 1 pins the exact one).

```mermaid
flowchart TD
  A[parse 1213-1.dot] --> B[rank assignment / network simplex<br/>ns.ts initRank]
  B -->|nodes + ranks MATCH oracle| C[mincross order]
  C --> D[x-coord assignment]
  D --> E[edge classification<br/>classify.ts]
  E --> F[routing boxes / corridor<br/>edge-route-boxes.ts]
  F --> G[spline fit + clip<br/>edge-route-chain/faithful, splines-clone, edge-route-clip]
  G --> H[SVG path/@d]

  E -. suspect .-> X[(constraint=false splines<br/>V0->V2, V0->V3, V1->V9<br/>maxΔ ~20px)]
  F -. suspect .-> X
  G -. suspect .-> X

  B --- N[C emits 'trouble in init_rank' exit 1<br/>RED HERRING — ranks still match,<br/>do not chase / AD-4]
  N:::note
  classDef note fill:#fff3cd,stroke:#856404;
  X:::bug
  classDef bug fill:#f8d7da,stroke:#721c24;
```

Established pre-mission: stages A–D produce identical output to the oracle (node
positions byte-identical). The divergence is isolated to E/F/G for the three
`constraint=false` edges only. Batch 1 (T1) determines which of E/F/G is the origin.
