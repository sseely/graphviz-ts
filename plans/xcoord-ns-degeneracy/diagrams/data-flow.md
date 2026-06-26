# Data flow — x-coordinate NS pipeline

The cross-rank position assignment (where the divergence lives), and the 4-stage
oracle diff that localizes the fix.

```mermaid
flowchart TD
  A[ranks + mincross order fixed<br/>cx identical, byte-match] --> B[create_aux_edges<br/>position.ts / position-aux.ts]
  B --> C["x-coord NS: rank(g, 2)<br/>ns.ts feasibleTree + pivots"]
  C --> D["LR_balance (mode 2)<br/>ns.ts lrBalance"]
  D --> E[set_xcoords -> ND_coord.x<br/>= cy in this LR graph]
  E --> F{honda-tokoro:<br/>port cy != native cy}

  subgraph Oracle diff (T1 vs T2)
    S1[Stage1 AUX graph<br/>nodes+edges w/minlen]
    S2[Stage2 PIVOTS<br/>enter/leave per iter]
    S3[Stage3 PRE-balance x]
    S4[Stage4 POST-balance x]
    S1 --> S2 --> S3 --> S4
  end

  B -.dump.-> S1
  C -.dump.-> S2
  C -.dump.-> S3
  D -.dump.-> S4
  S4 --> G[first differing stage<br/>= fix site]
```

Weight=0 edges (`n022->n004`, `n022->n008`) contribute zero-weight aux edges →
cost-degenerate slack → native and port pick different optimal-face vertices.
`weight=1` collapses the degeneracy and both match (proven this session).
