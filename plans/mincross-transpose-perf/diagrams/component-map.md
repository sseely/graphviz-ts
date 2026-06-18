# Component map — mincross transpose hot path

```mermaid
graph TD
  mincrossMain["mincrossMain"] --> mincrossIter["mincrossIter<br/>ncross() per iter (incremental, valid-cache)"]
  mincrossIter --> mincrossStep["mincrossStep"]
  mincrossStep --> reorder["reorder + medians"]
  mincrossStep --> transpose["transpose(g, !reverse)<br/>do…while(delta>=1)  ← 98% of 2471 time"]
  transpose --> transposeStep["transposeStep(r)<br/>loops adjacent pairs"]
  transposeStep --> left2right["left2right (cluster/flat guard)"]
  transposeStep --> transposeCounts["transposeCounts(v,w)<br/>local in_cross+out_cross<br/>SUSPECT(c): allocates [0,0]/pair"]
  transposeStep --> exchange["exchange (swap order)"]
  mincrossIter --> ncross["ncross → rcross<br/>SUSPECT(c): new Array per rcross"]

  classDef hot fill:#fdd,stroke:#c00;
  classDef suspect fill:#ffd,stroke:#aa0;
  class transpose,transposeStep hot;
  class transposeCounts,ncross suspect;
```

The cost is inside a single `transpose()` call. Batch 1 (AD-4) determines
whether it is **pass-count** (the `do…while` runs far more passes than C),
**non-convergence** (delta never reaches 0), or **constant-factor** (the
yellow per-call allocations + megamorphic access). Per-swap scope already
matches C — `transposeCounts` is local, `ncross` is incremental.
