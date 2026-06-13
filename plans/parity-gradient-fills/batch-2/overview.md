# Batch 2 — cluster/graph gradients + HTML-table BGCOLOR gradient

**Parallel: T3 and T4 can run concurrently (disjoint write-sets).**
Both depend on batch 1 (T1 + T2) being complete and committed.

T3 extends cluster and graph-bgcolor gradient emission (the same
`findStopColor` → `gvrender_set_gradient_vals` path C uses in
`emit_begin_cluster` and `emit_background`). T4 unskips the M12 AD4
deferral: HTML-table `BGCOLOR` + `GRADIENTANGLE` now emits a real
gradient instead of falling back to the first solid color.

## Task table

| ID | Name | Write-set | Depends on |
|----|------|-----------|------------|
| T3 | [cluster + graph bgcolor gradients](T3-cluster-graph-gradients.md) | src/render/svg-cluster.ts, src/render/svg-graph.ts | batch 1 |
| T4 | [HTML-table BGCOLOR gradient (M12 AD4)](T4-htmltable-gradients.md) | src/common/htmltable-emit-fill.ts | batch 1 |

Write-sets are disjoint. Run T3 and T4 in parallel.
