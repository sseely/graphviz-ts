# make_flat_adj_edges aux pipeline

The flat-adjacent side-port router builds a rotated auxiliary graph, lays it
out, routes splines there, then transforms them back. The open defect is a
divergence between the port's and C's aux graph somewhere in this chain.

```mermaid
flowchart TD
  A["group of adjacent flat side-port edges<br/>(structParty:S↔structDefaultAuto:N)"] --> B[buildFlatAux]
  B --> B1["cloneGraph → auxg (flip inverted: LR→TB)"]
  B --> B2["clone auxt from refTn, auxh from other<br/>❓ C also pins auxt in rank=source subg"]
  B --> B3["clone each edge (ports copied positionally)<br/>+ heavy hvye ordering edge"]
  B1 & B2 & B3 --> C[dotRank → dotMincross → dotPosition]
  C --> D["repositionFlatAux<br/>auxt.y=rightx, auxh.y=leftx, others.y=midx"]
  D --> E[dotSameports]
  E --> F["dotSplines_ (routes the aux curl)"]
  F --> G["copyFlatSplines: transformf(p, del, flip)<br/>back onto original edges"]
  G --> H["installed spline on original edge"]

  classDef suspect fill:#fee,stroke:#c00;
  class B2,E,F suspect
```

Verified faithful to C: `cloneGraph` flip-inversion, `repositionFlatAux`,
`del`, `transformf`, and (commit 480b34a) the `cloneFlatEdge` orientation
reference. Suspect nodes (red): the missing `rank=source` pin on `auxt`
(B2), and the aux `dotSameports`/`dotSplines_` curl (E/F) — a change to the
latter would breach the `splines-flat.ts`-only scope (AD-3) and is a
stop-and-check.
