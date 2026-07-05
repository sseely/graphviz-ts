# Batch 2 — known-locus fixes (parallel iff write-sets verified disjoint)

Three fix tasks with loci pinned by prior notes. Executor MUST verify T8/T9
declared file lists are disjoint before parallel dispatch; else serialize
T8→T9. Batch gate: full survey+gate (idle box) then snapshot refresh.

| ID | Description | Model | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T8 | decorate cluster-corridor polyline (Δ43.5) | sonnet | splines-groups/cluster corridor sites + tests | — | [ ] |
| T9 | portlabel upstream splines: 144_ortho + arrowsize | fable | samehead/ortho spline sites + tests | — | [ ] |
| T10 | 1949 LR cluster-label order-axis (Δ95, uniform y-shift class) | opus | order-axis placement site + tests | — | [ ] |
