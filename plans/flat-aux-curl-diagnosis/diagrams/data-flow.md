# Data flow — flat-adj aux pipeline & where the curl is decided

The flat-adj aux pipeline (C `make_flat_adj_edges` / port `makeFlatAdjEdges`).
The curl is decided at **dot_rank**, not at the spline.

```mermaid
flowchart TD
  A["edges[] same-rank, with ports"] --> B["cloneGraph + clone auxt/auxh"]
  B --> S{"auxt pinned to<br/>rank=source subgraph?"}
  S -- "C: YES (agsubg rank=source)" --> R["dot_rank(auxg)"]
  S -- "port: NO (suspect — AD-3)" --> R
  R --> R2{"auxh.rank relative<br/>to auxt.rank"}
  R2 -- "gap > 1 (C)" --> N1["normalize inserts<br/>virtual node on 3->2"]
  R2 -- "gap = 1 (port)" --> N2["no virtual node<br/>edge stays direct"]
  N1 --> SP1["dot_splines_ → aux size 7<br/>(curls below)"]
  N2 --> SP2["dot_splines_ → aux size 4<br/>(straight)"]
  SP1 --> T["transform back → bb.ll.y ≈ -7.88<br/>→ global +7.88 up-shift (CORRECT)"]
  SP2 --> T2["bb.ll.y = 0 → no up-shift<br/>→ cardinal :e->:w land 7.88 low (BUG)"]
```

Diagnosis order (this mission): confirm the **R2** branch divergence by dumping
both sides (T3), after ruling the **S** input in/out (T2), using a
canary-validated harness (T1). The fix (restore the C branch in the port) is a
**separate** mission (AD-1).

```mermaid
sequenceDiagram
  participant H as Harness (T1)
  participant P as Port aux (buildFlatAux)
  participant C as Native dot (instrumented, AD-6)
  H->>P: dump ranks+chain for 2->3 (canary)
  H->>C: dump ranks+chain for 2->3 (canary)
  Note over H: canary green ⇒ both size 7
  H->>P: dump ranks+chain for 3->2
  H->>C: dump ranks+chain for 3->2
  Note over H: name first divergent stage (T3)
```
