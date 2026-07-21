# Component map — what each bucket touches

```mermaid
graph TD
  subgraph Tooling[read-only tools]
    HARNESS[attribute-divergence.ts<br/>injection harness]
    WALK[engine-walk.ts + parity-report.ts]
    NATIVE[~/git/graphviz POS_DUMP<br/>env-gated]
  end

  subgraph B1[B1 graph-bb]
    SPL[neato/splines.ts<br/>bb + inject hook]
    PACK[pack/index.ts<br/>computeSubgraphBB hull/curve]
    GEO[api/geometry.ts]
  end
  subgraph B2[B2 edge FP-ties]
    MULTI[neato/multispline.ts<br/>GTS CDT]
    FLAT[dot/straight-edges.ts]
    FMA[common/fma.ts]
  end
  subgraph B4[B4 ratio=fill]
    ASP[neato/set-aspect.ts]
  end
  subgraph B5[B5 known]
    XL[label/* + xlabels-place.ts<br/>lossy RTree]
    NS[x-coord NS]
  end
  subgraph Finalize
    REG[accepted.ts registry<br/>SOLE writer = T6.1]
    DOCS[parity-*.json/jsonl<br/>PARITY*.md]
  end

  HARNESS --> B1 & B2 & B4 & B5
  NATIVE --> HARNESS
  B1 --> REG & DOCS
  B2 --> REG & DOCS
  B4 --> REG & DOCS
  B5 --> REG & DOCS
  WALK --> DOCS
```

Write-set isolation: B1→splines/pack/geometry, B2→multispline/straight-edges/fma,
B4→set-aspect, B5→label/x-coord-NS. Distinct src files per bucket → batches
1-5 run without write conflicts. The registry + parity docs have a single
writer (T6.1). B2 and B4 touch shared primitives (fma, set-aspect) used by
neato/fdp → their fixes require the cross-engine re-sweep in T6.1.
