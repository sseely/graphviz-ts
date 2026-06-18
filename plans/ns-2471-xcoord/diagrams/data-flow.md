# Data flow — position → network simplex + diagnosis checkpoints

The hang is in `dotPosition`'s x-coord network simplex, after mincross (now
correct). `maxphase=2` stops before this; `maxphase=3` enters it and hangs.

```mermaid
flowchart TD
  A[dotLayoutPipeline] --> B[dotRank]
  B --> C[dotMincross<br/>FIXED — completes 3.6s == C]
  C --> D{maxphase}
  D -->|=2: return| E[stop — proves mincross OK]
  D -->|>=3| F[dotPosition]
  F --> G[createAuxEdges]
  G --> H["rank(g, 2, nsiter2=INT_MAX)"]
  H --> I[rank2Loop<br/>LAYER 3: pivots never reach optimal]
  I --> J{leaveEdge != undefined?}
  J -->|yes forever| I
  J -->|no / optimal| K[setXcoords — never reached]
```

## Pivot-cycling probe (Batch 1)

```mermaid
sequenceDiagram
  participant L as rank2Loop
  participant LE as leaveEdge
  participant EE as enterEdge
  participant U as nsUpdate
  L->>LE: negative-cut tree edge?
  LE-->>L: edge e (or undefined=optimal)
  L->>EE: entering edge for e
  EE-->>L: edge f
  L->>U: pivot(e, f) — cut-value + low/lim update
  Note over L: probe logs (iter, e, f, totalWeight)<br/>cycling = repeated (e,f) or non-decreasing weight
```

## C-oracle comparison (Batch 1/3)

```mermaid
sequenceDiagram
  participant TS as renderSvg (esbuild bundle)
  participant C as build/cmd/dot/dot + /tmp/gvmine
  participant D as diff
  TS->>D: per-rank node x-order (post dotPosition)
  C->>D: per-rank node x-order (REVERT C instrumentation after)
  D->>D: byte-compare x-order per rank
```
