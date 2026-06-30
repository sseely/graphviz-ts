<!-- SPDX-License-Identifier: EPL-2.0 -->

# Component map — mincross hot path

Profile of 2108 (self-time): `reorderInner` 47%, `accumCross` 17%,
`interclexp` 5%, `transposeStep`/`rcross`/`cleanup1Virt`/`class1`/`medians` ≈ 11%.

```mermaid
graph TD
  DM["dot_mincross / mincrossMain<br/>(mincross.ts)"] --> MI["mincrossIter"]
  MI --> MS["mincrossStep"]
  MS --> RE["reorder<br/>(mincross.ts)"]
  MS --> TR["transpose<br/>(mincross.ts)"]
  DM --> RR["runRemincross<br/>(cluster path)"]
  DM --> MC["mincrossClust<br/>maxthispass=MIN(4,MaxIter)"]
  RR --> MS
  MC --> MS

  RE --> RI["reorderInner ★47%<br/>(mincross-order.ts)"]
  RE --> MED["medians<br/>(mincross-order.ts)"]
  TR --> TS["transposeStep<br/>(mincross-cross.ts)"]
  TS --> AC["accumCross ★17%<br/>(mincross-cross.ts)"]
  TS --> RC["rcross / rcrossCount<br/>(mincross-cross.ts)"]
  MS --> NC["ncross() total crossings<br/>→ Convergence=.995 / MinQuit test"]

  classDef hot fill:#fdd,stroke:#c00;
  class RI,AC hot;
```

## Hypothesis under test

```mermaid
graph LR
  A["port ncross() or<br/>crossing tiebreak<br/>diverges from C?"] -->|yes| B["convergence test sees<br/>different crossings →<br/>MORE reorder/transpose passes"]
  B --> C["reorderInner/accumCross<br/>run extra times → 6x slow"]
  A -->|no, counts match C| D["pure per-op constant factor<br/>→ optimize the hot loop"]
```

The diagnostic (Batch 1) decides which branch is real by diffing C-vs-port
counters; Batch 2 fixes the indicated branch conformantly.
