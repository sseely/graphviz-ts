<!-- SPDX-License-Identifier: EPL-2.0 -->

# Component map — touched modules

```mermaid
graph TD
    attrs["g.attrs (size, ratio)"] -->|T2 parse| render["gvc/device.ts render()"]
    bb["job.bb (points)"] --> render
    render -->|sets job.zoom = Z| job["RenderJob.zoom"]
    job --> tag["render/svg-graph.ts emitSvgTag<br/>width/height/viewBox"]
    job --> grp["render/svg-graph.ts emitGraphGroupOpen<br/>scale(Z)"]

    label["gvc/device.ts renderOneLabel"] -->|T1 guard| textspan["renderer.textspan<br/>(skip empty str)"]

    subgraph OUT_OF_SCOPE["out of scope (D3)"]
      ratioLayout["position-bbox.ts<br/>aspectFill/Expand/Value"]
    end
    attrs -.->|do NOT activate| ratioLayout

    classDef edit fill:#def,stroke:#06c;
    classDef oos fill:#fee,stroke:#c33,stroke-dasharray:4;
    class render,tag,grp,label,textspan edit;
    class ratioLayout oos;
```

- **Blue** = files edited (T1: `renderOneLabel`; T2: `render()`, `emitSvgTag`,
  `emitGraphGroupOpen`).
- **Red dashed** = `ratio=` layout reshaping, deliberately untouched (D3).
- No data-model, API-contract, or service-dependency changes (Layer-4 only).
