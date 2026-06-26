# Data flow — spline routing pipeline (4-stage oracle dump)

```mermaid
sequenceDiagram
  participant E as Edge (tail->head, labeled)
  participant L as Label-node placement
  participant B as Routing-box corridor
  participant F as Fitter (routesplines)
  participant O as Bezier emit

  Note over E,O: Stages dumped by GV_XDUMP / __XDUMP (ADR-2)
  E->>L: Stage 1 — classification + label-node id/rank/coord
  L->>B: Stage 2 — routing boxes handed to fitter
  B->>F: Stage 3 — pre-fit path points
  F->>O: Stage 4 — final bezier segments (piece count + control points)
  Note over O: honda divergence: edge2 native 2-seg / port 1-seg;<br/>edge27 native 2-seg / port 4-seg
```

Localization rule: the **first** stage where C and port differ for a given
edge names the fix site. Node positions already match (x-coord NS fixed), so
Stage 1 label-node coords should match — if they don't, label placement is the
root; if they match but Stage 2 boxes differ, the corridor is the root; etc.
