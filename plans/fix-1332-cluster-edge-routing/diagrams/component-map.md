<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map — files in play

```mermaid
graph TD
    T1[T1 diagnosis artifact<br/>.agent-notes/1332-edge-routing-diagnosis.md]
    ERF[edge-route-faithful.ts<br/>maximalBbox / cl_bound]
    SR[splines-route.ts / edge-route-chain.ts<br/>corridor boxes]
    SP[pathplan/shortest.ts<br/>triangulation failure]
    INST[splines install path<br/>pn=0 → no spline]
    EMIT[SVG emit gate<br/>skip spline-less edges]
    CORPUS[test/corpus parity + PARITY.md]

    T1 -->|fixLocus| ERF
    T1 -->|fixLocus| SR
    T1 -->|lostEdgeVerdict| SP
    ERF --> T2[T2 corridor fix]
    SR --> T2
    SP --> T3[T3 lost-edge semantics]
    INST --> T3
    EMIT --> T3
    T2 --> T4[T4 watch gate]
    T3 --> T4
    T4 --> T5[T5 survey + disposition]
    T5 --> CORPUS

    style T3 stroke-dasharray: 5 5
```

Dashed = conditional (D1 rung 2 only). C references:
`lib/dotgen/dotsplines.c` (boxes/pathend), `lib/common/routespl.c`
(polygon + error path), `lib/pathplan/shortest.c` (failure site).
