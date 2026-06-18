# Data flow — the stuck crossing (mc3)

```mermaid
sequenceDiagram
  participant B as build_ranks (init order)
  participant M as mincross(g,0)
  participant S as mincross_step
  participant T as transpose / left2right

  B-->>M: initial order (cur_cross = 1, SAME in C and TS)
  M->>S: pass 0 iter 0
  S->>T: evaluate adjacent swaps on each rank
  Note over T: C: a swap removes the crossing → cur_cross 0
  Note over T: TS: the same swap is rejected/missed → cur_cross 1 (stuck)
  T-->>M: C → 0 (done); TS → 1 (loops to MinQuit, never improves)
```

Same initial order rules out init-order; the divergence is purely in which swap
the cluster-constrained transpose/reorder is willing to make. Success = TS
reaches C's per-rank ORDER, not just C's count (AD-3).
