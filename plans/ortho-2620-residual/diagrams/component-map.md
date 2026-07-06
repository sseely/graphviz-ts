<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map — ortho edge-routing pipeline (2620 residual locus)

The maze INPUT now matches C (mincross fixed). The residual lives somewhere in
the stages below; T1 bisects to the first divergent one.

```mermaid
flowchart TD
  IN[node boxes + edges<br/>MATCHES C now] --> MAZE[maze.ts<br/>cells / gcell bb M3✓]
  MAZE --> PART[partition.ts<br/>trapezoid decomposition]
  PART --> CHAN[maze-channels.ts<br/>channel graph]
  CHAN --> SG[sgraph.ts<br/>shortest-path / relax<br/>int-trunc class]
  SG --> FPQ[fpq.ts<br/>priority queue<br/>sentinel domain]
  SG --> WTS[updateWts<br/>congestion]
  WTS --> TRK[ortho-parallel.ts<br/>assignTracks / top_sort M2✓]
  TRK --> ROUTE[ortho-route.ts<br/>segments → bezier/polyline]
  ROUTE --> OUT[edge @d coords<br/>maxDeltaPath here: g428/path1/@d4]

  QSORT[bsd-qsort.ts<br/>apple qsort M1✓] -.global sort.-> TRK
  QSORT -.-> ROUTE

  classDef done fill:#d4edda,stroke:#28a745;
  class MAZE,TRK,QSORT done
```

Green = already-landed fixes (M1 qsort, M2 addPEdges/tracks, M3 gcell bb) —
the residual is DISTINCT from these. Prime suspects for a fourth mechanism:
sgraph relax ordering/truncation, fPQ tie ordering, route-conversion segment
order, or a channel-graph tie-break. `maxDeltaPath` lands in ROUTE output.
