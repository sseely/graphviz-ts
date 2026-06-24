<!-- SPDX-License-Identifier: EPL-2.0 -->

# Data flow — S1 localization spike

```mermaid
sequenceDiagram
  participant R as reproducer le_long.gv
  participant P as port (render-one)
  participant C as oracle (instrumented dot)
  participant D as diff/analysis

  R->>P: render long edge
  P->>D: Proutespline inputs<br/>(boxes, input pts, slopes) + piece count = 2
  R->>C: render same edge<br/>(rebuilt gvplugin_dot_layout)
  C->>D: routesplines/Proutespline inputs<br/>(boxes, input pts, slopes) + piece count = 1
  D->>D: first differing field =<br/>ROOT CAUSE → decisions.md#d-fixsite
  Note over D: box corridor? input chain? slopes?
```

The piece-count difference (port 2 vs oracle 1) is downstream of whichever input
field differs first. S1 bisects boxes → input points → slopes in that order.
