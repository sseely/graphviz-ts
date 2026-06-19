# Component map — ortho subsystem (P1 slice highlighted)

```mermaid
graph TD
  subgraph P1["Phase 1 — THIS MISSION (parallel, unwired)"]
    RG[rawgraph.ts<br/>adjacency + topsort<br/>T1]
    TR[trapezoid.ts<br/>Seidel decomposition<br/>T2]
    SG[sgraph.ts + fPQ.ts<br/>search graph + PQ + shortPath<br/>T3]
  end
  subgraph P2["Phase 2 — next mission"]
    PA[partition.ts<br/>polygon partition + random permute]
    MZ[maze.ts<br/>mkMaze: cells + sgraph from node boxes]
  end
  subgraph P3["Phase 3 — final mission"]
    OR[ortho.ts<br/>orthoEdges: route + spline emit]
    WIRE[splines.ts dispatch<br/>EDGETYPE_ORTHO -> orthoEdges]
  end

  TR --> PA
  PA --> MZ
  RG --> PA
  RG --> MZ
  SG --> MZ
  MZ --> OR
  SG --> OR
  OR --> WIRE

  SPEC[~/git/graphviz/lib/ortho/*.c<br/>SACRED SPEC — read only]
  SPEC -.faithful port.-> RG
  SPEC -.faithful port.-> TR
  SPEC -.faithful port.-> SG

  classDef now fill:#fde,stroke:#c39
  classDef later fill:#eef,stroke:#88a
  classDef ro fill:#efe,stroke:#5a5
  class RG,TR,SG now
  class PA,MZ,OR,WIRE later
  class SPEC ro
```

- **Write-set (P1):** `src/ortho/{rawgraph,trapezoid,sgraph,fPQ}.ts` + tests.
- **Read-only:** `~/git/graphviz/lib/ortho/*` (C spec), existing TS `pointf`.
- P1 has **no edge** into the layout pipeline — it cannot change rendered output
  (ADR-4). Wiring is P3 (`splines.ts` EDGETYPE_ORTHO dispatch, `dotsplines.c:251`).
