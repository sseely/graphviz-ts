<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map — concentrate edge path

The concentrate path the 6 dropped edges flow through. Batch 1 instruments each
hop to find where the port first diverges from C.

```mermaid
graph TD
  IN["b15.gv: concentrate=true<br/>record ports, 2 clusters"] --> CLASS["classify.ts (class2.c)<br/>concentrateOrMerge / handleMultiEdge<br/>marks IGNORED only same tail+head+ports"]
  CLASS --> POS["position.ts:168<br/>calls dotConcentrate(g)"]
  POS --> CONC["conc.ts (conc.c)<br/>dotConcentrate → mergevirtual<br/>rebuild_vlists (degenerate-rank truncate)"]
  CONC --> ROUTE["edge-route.ts:445-460<br/>IGNORED-edge handling"]
  ROUTE --> SPL["splines.ts:390-410<br/>concentrate-merged chain routing"]
  SPL --> SVG["SVG emit: edge <g> blocks<br/>oracle 153 / port 147 (−6)"]

  classDef suspect fill:#fde,stroke:#a33;
  class CONC,ROUTE,SPL suspect

  note["6 dropped edges: different tails,<br/>5 → HoverRest:In, 1 → Stand:In.<br/>NOT parallel multi-edges → CLASS ruled out as primary."]
  note -.-> CLASS
```

C invariant (the spec): `dot_concentrate` merges only VIRTUAL nodes that share
tail/head AND pass `portcmp`; it never deletes original edges, so `dotsplines`
emits all 153. The port drops 6 — the defect is in a suspect node (pink) above.
