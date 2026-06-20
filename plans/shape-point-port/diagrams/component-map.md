<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map

```mermaid
graph TD
    subgraph shapes.ts
      MK[mkPoint 'point' -> kind: SH_POINT<br/>READ-ONLY, already set]
    end
    subgraph nodeinit.ts
      SZ[size resolution<br/>ADD SH_POINT branch - AD-2]
    end
    subgraph poly-gencode.ts
      GC[ellipse + renderLabel<br/>ADD SH_POINT branch - AD-3/AD-4]
    end
    subgraph poly-inside.ts
      IN[poly_inside ellipse branch sides<=2<br/>REUSE - AD-5, contingency only]
    end

    MK --> SZ
    MK --> GC
    SZ --> GC
    GC -.clips via.-> IN

    subgraph tests
      UT[unit tests: sizing + render]
      GS[golden dot-point-shape]
      PAR[corpus survey / PARITY.md]
    end
    SZ -.verified by.-> UT
    GC -.verified by.-> UT
    GC -.verified by.-> GS
    GC -.verified by.-> PAR
```

Write-set: `nodeinit.ts` (T1), `poly-gencode.ts` (T1), module tests (T1),
`poly-inside.ts` (T1, contingency only), goldens + parity (T2). `shapes.ts` and
the ellipse/inside paths are read-only/reuse dependencies.
