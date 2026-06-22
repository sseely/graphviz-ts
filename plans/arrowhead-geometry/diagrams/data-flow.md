# Data flow — arrowhead geometry

```mermaid
flowchart TD
  A["edge attrs: arrowhead / arrowtail / arrowsize"] --> P["parseArrow → ArrowComponent[]"]
  P --> R["resolveArrowType → ResolvedArrow[] (type, mods, lenfact)  [T1]"]
  R --> L["arrowLength(comps, arrowsize, pw)  [T2]"]
  R --> S["arrowDrawOps(comps, tip, dir, arrowsize, pw)  [T2/T3]"]
  L --> C["edge-route-clip: clip spline back by length  [T4]"]
  C --> TIP["clipped tip + dir"]
  TIP --> S
  S --> ST["store e.info.headArrowOps / tailArrowOps : ArrowDrawOp[]  [T5]"]
  ST --> E["svgArrowPolygons: emit per kind  [T6]"]
  E --> POLY["polygon (filled/open)"]
  E --> ELL["ellipse (dot/odot)"]
  E --> PL["polyline (tee/gap/curve)"]
```

## Per-arrow emission (compound stacking)

```mermaid
sequenceDiagram
  participant D as arrowDrawOps
  participant C1 as component 1 (e.g. crow)
  participant C2 as component 2 (e.g. dot)
  D->>C1: gen at tip, advance tip by arrowLengthOne(crow)
  C1-->>D: polygon op(s)
  D->>C2: gen at advanced tip
  C2-->>D: ellipse op
  D-->>D: concat → ArrowDrawOp[]
```

> C computes arrows at render (`arrow_gencode`); the port computes at layout and
> stores `ArrowDrawOp[]` on `e.info` (ADR-2). Clip length (T4) and shape (T5) use
> the SAME per-type math so the tip and the drawn shape stay consistent.
