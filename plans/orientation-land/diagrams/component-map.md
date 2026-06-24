<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map — orientation=land

```mermaid
graph TD
  A["graph attrs<br/>rotate / orientation / landscape"] -->|T1: parseLandscape| B["viewport.ts"]
  B -->|landscape bool| C["device.ts render()"]
  C -->|"job.rotation = 90"| D["RenderJob.rotation"]
  C -.->|ADR-2 guard| E["transformPoint<br/>(stays unrotated)"]
  D -->|T2 reads| F["svg-graph.ts"]
  F --> G["emitGraphGroupOpen<br/>rotate(-job.rotation)"]
  F --> H["emitSvgTag<br/>swap W/H"]
  F --> I["svgBeginPage<br/>rotated translate"]
  G --> J["SVG &lt;g&gt; transform"]
  H --> J
  I --> J

  classDef t1 fill:#dae8fc,stroke:#6c8ebf
  classDef t2 fill:#d5e8d4,stroke:#82b366
  class B,C,D,E t1
  class F,G,H,I,J t2
```

**Untouched (emit-only invariant):** `src/layout/**`, `src/pathplan/**`, splines.
Inner node/edge coordinates pass through `transformPoint` unrotated; the rotation
lives entirely in the SVG group transform.
