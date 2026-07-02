<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map — touched vs read-only

```mermaid
graph TD
    subgraph provisional write-set
        ER[edge-route*.ts]
        SR[splines-route*.ts]
        SC[splines-clip.ts]
    end
    subgraph metadata / docs
        AD[accepted-divergences.json]
        KD[known-divergences.md §A2]
        PM[PARITY.md + parity*.json]
    end
    subgraph read-only spec
        C[~/git/graphviz lib/dotgen + lib/common<br/>temp instrumentation, reverted]
        NAN[tests/graphs|share|windows/NaN.gv]
    end
    T2[T2 diagnosis] -->|fixLocus| ER & SR & SC
    T2 -.->|expansion ask if outside| OTHER[any other src file]
    T1[T1 stage-1 truth] --> AD & KD
    T5[T5 stage-2 retire] --> AD & KD & PM
    C --> T2
    NAN --> T2
```
