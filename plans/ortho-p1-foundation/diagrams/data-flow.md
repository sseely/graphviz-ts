# Data flow — eventual ortho pipeline, and where P1 sits

The full `splines=ortho` pipeline (C `ortho.c:orthoEdges`). P1 ports the shaded
foundation; P2/P3 build the rest. P1 is verified in isolation against the C oracle.

```mermaid
flowchart TD
  A["dot_splines: et == EDGETYPE_ORTHO<br/>(P3 wiring)"] --> B[orthoEdges g  — P3]
  B --> C[mkMaze: build cells from node boxes — P2]
  C --> D["partition: trapezoidal decomposition<br/>of free space (P2 wraps P1 trapezoid)"]
  D --> E["construct_trapezoids(nseg, seg, permute)<br/>★ P1 / T2 — Seidel"]
  D --> F["random permute generation<br/>(P2 — partition.c)"]
  C --> G["sgraph: maze search graph<br/>★ P1 / T3 (snode/sedge)"]
  C --> H["rawgraph: channel adjacency<br/>★ P1 / T1"]
  B --> I["per edge: shortPath(pq, sgraph, from, to)<br/>★ P1 / T3 — Dijkstra via fPQ"]
  I --> J[orthogonal polyline — P3]
  J --> K[convert to spline + clip_and_install — P3]

  classDef p1 fill:#fde,stroke:#c39
  class E,G,H,I p1
```

## P1 verification flow (isolated, C-oracle)

```mermaid
sequenceDiagram
  participant C as instrumented lib/ortho (native)
  participant F as fixtures (segments / edge sets / sgraphs)
  participant TS as src/ortho/*.ts (port)
  participant T as vitest
  C->>T: dump traps_t (normalized), rawgraph adj+topsort,<br/>PQ pop seq, shortPath n_dad chain
  Note over C: build via make gvplugin_dot_layout → /tmp/gvmine; REVERT C after
  F->>TS: same fixture inputs (+ fixed permute for trapezoid)
  TS->>T: ported outputs
  T->>T: assert TS == C dump (byte / order-normalized)
```
