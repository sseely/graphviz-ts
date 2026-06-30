<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map — mike L→U routing surface

The diagnostic targets the dot edge-spline pipeline. Batch 0 walks it stage by
stage to find the first C-vs-port divergence.

```mermaid
flowchart TD
    rank[ranks + virtual-node chain<br/>L→U spans N ranks] --> order[edge routing order<br/>recover_slack / vnode placement<br/>edge-route-rank.ts]
    order --> boxes[per-rank box corridor<br/>edge-route-boxes.ts]
    boxes --> chain[long-edge chain router<br/>edge-route-chain.ts]
    chain --> fit[spline fitter / Proutespline<br/>splines.ts · splines-route.ts]
    fit --> emit[bezier piece emission<br/>port 14 pts vs C 8 pts]

    classDef suspect fill:#fee,stroke:#c00;
    class chain,boxes suspect
```

```mermaid
flowchart LR
    cdump[C dotsplines.c / routespl.c<br/>MIKEDBG dump: boxes, chain span, pieces] -->|diff| finding[T0 finding<br/>divergentStage + fixTarget]
    pdump[port MIKEDBG dump<br/>same stages] -->|diff| finding
    finding --> t1[T1 fix in fixTarget + L→U oracle test]
    t1 --> t2[T2 survey: 0 regressions, refresh baseline]
```

Primary suspect: `edge-route-chain.ts` (long-edge segmentation) and the box
corridor it consumes. Confirmed/redirected by Batch 0.
