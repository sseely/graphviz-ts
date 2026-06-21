# Component map — buckets over modules

Which `src/` modules each bucket's fixes most likely touch (finalized per triage).

```mermaid
flowchart LR
  subgraph Buckets
    CS[color-stroke 9]
    TC[text-content 7]
    AT[attr-or-tag 33]
    PP[polygon-points 3]
    PG[parser-gap 10]
  end
  subgraph Modules[src/ modules]
    CR[render/color-resolve.ts]
    GR[render/svg-gradient.ts]
    ML[common/make-label.ts]
    SV[render/svg-*.ts]
    PGc[render/poly-gencode.ts]
    AR[common/ arrows/shapes]
    PEG[parser/dot.pegjs + dot.js]
  end
  CS -->|hex lowercase VERIFIED| CR
  CS -.->|gradient/default fill| GR
  TC -->|escaping/content| ML
  TC -.->|charset DEEP ADR-5| X1[defer]
  AT -->|attribute emission| SV
  AT -.->|arrowhead attrs| AR
  PP -->|vertex coords| PGc
  PP -.->|count diff DEEP| X2[defer]
  PG -->|grammar gap| PEG
  PG -.->|Latin1/russian DEEP| X3[defer]
```

Solid = likely-simple (in scope). Dashed-to-defer = presumed deep (comparison
page). Modules are a planning estimate; each fix task finalizes its write-set
from the triage doc.
