# Data flow — mincross pipeline + diagnosis checkpoints

`dotMincross` stages and where the divergence lives. Layer 1 (vStart) is in the
component-level `mincrossStep` (medians/reorder); Layer 2 (oscillation) is in
`transpose` once the component is properly reordered.

```mermaid
flowchart TD
  A[dotMincross] --> B[runComponents]
  B --> C{per component c}
  C --> D[buildRanks + flatReorder<br/>checkpoint: build&lt;c&gt; — MATCHES C]
  D --> E[mincrossIter: mincrossStep x N]
  E --> F[medians + reorder<br/>LAYER 1: ignored vStart]
  F --> G[transpose<br/>LAYER 2: while delta&gt;=1 oscillates]
  G --> E
  E --> H[merge2<br/>checkpoint: collapsed-cluster leader order]
  H --> I[runClusters: mincrossClust]
  I --> J[runRemincross]
  J --> K[final per-rank order<br/>checkpoint: byte-compare to C]
```

## Comparison harness (both layers)

```mermaid
sequenceDiagram
  participant TS as renderSvg (esbuild bundle)
  participant C as build/cmd/dot/dot + /tmp/gvmine
  participant D as diff
  TS->>TS: gated cdumpRanks (fingerprinted v[up>down|clust])
  C->>C: CDUMP cdump_ranks in dot_mincross (REVERT after)
  TS->>D: r&lt;n&gt;: names...
  C->>D: r&lt;n&gt;: names...
  D->>D: per-rank byte compare (real + fingerprinted virtuals)
```
