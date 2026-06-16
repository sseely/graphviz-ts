# Component map — flat-label dispatch

```mermaid
graph TD
  subgraph ranking [ranking / position phase]
    P[position.ts:dotPosition] -->|today: stub returns false| STUB[flatEdges stub<br/>position.ts:183]
    P -.->|T1: import real| FE[flat.ts:flatEdges]
    FE --> MA[markAdjacent → checkFlatAdjacent]
    FE --> NA[needsAbomination<br/>T1: flat_out, not rk.flat]
    NA -->|rank-0 label| AB[abomination<br/>T1: 0-based rewrite]
    FE --> PN[processNodes → flatNode<br/>makeVnSlot: label vnode at r-1]
  end
  subgraph routing [spline routing phase]
    MFE[splines-flat.ts:makeFlatEdge] -->|isAdjacent| ADJ[makeFlatAdjEdges<br/>T3: emit label]
    MFE -->|T2: ED_label set| MFL[make_flat_labeled_edge<br/>T2: new]
    MFL --> RS[routeSplines → clipAndInstall]
    MFL --> LP[ED_label.pos = ND_coord ln; set=true]
  end
  PN -->|label vnode ln| MFL
  LP --> EMIT[SVG label text emitted]
  ADJ --> EMIT
```

## Task → component

- **T1** — `position.ts` (wire `flatEdges`), `flat.ts` (`needsAbomination`,
  `abomination`, `flatNode`/`makeVnSlot`).
- **T2** — `splines-flat.ts` (`make_flat_labeled_edge` + dispatch, non-adjacent).
- **T3** — `splines-flat.ts` (`makeFlatAdjEdges` label emission, adjacent).
