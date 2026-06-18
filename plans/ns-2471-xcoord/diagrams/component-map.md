# Component map — touched modules

```mermaid
graph TD
  POS[position.ts<br/>dotPosition / nsiter2<br/>READ-ONLY context] -->|calls rank| NS[ns.ts<br/>rank / rank2 / rank2Loop<br/>leaveEdge / enterEdge / nsUpdate<br/>LIKELY FIX SITE]
  NS -->|tree ops + cut values| NSC[ns-core.ts<br/>addTreeEdge / invalidatePath<br/>exchangeTreeEdges / cut-value<br/>POSSIBLE FIX SITE]
  SPEC[~/git/graphviz/lib/common/ns.c<br/>SACRED SPEC — read only] -.faithful port.-> NS
  SPEC -.faithful port.-> NSC
  NS --> T1[ns.test.ts<br/>regression]
  NSC --> T2[ns-core.test.ts<br/>regression]

  classDef write fill:#fde,stroke:#c39
  classDef ro fill:#eef,stroke:#88a
  class NS,NSC,T1,T2 write
  class POS,SPEC ro
```

- **Write-set:** `ns.ts`, `ns-core.ts`, their tests.
- **Read-only:** `position.ts` (caller), `ns.c` (C spec, sacred).
- Fix site confirmed in Batch 2; `ns.ts` (pivot selection) is the prime suspect,
  `ns-core.ts` (cut-value / low-lim maintenance) the secondary.
