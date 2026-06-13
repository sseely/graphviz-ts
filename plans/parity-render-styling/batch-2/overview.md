# Batch 2 — per-object styling (parallel, after batch 1)

Three tasks, disjoint write-sets. Each populates the obj-state (T2)
using the resolvers (T1) for one object kind, then verifies the
rendered styling against the C oracle. After this batch, styled graphs
render in color; the 82 default-styled goldens stay byte-identical
(unstyled objects resolve to the same default state).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T3 | Node fill/pen/penwidth/style ([T3-node-styling.md](T3-node-styling.md)) | sonnet | src/common/poly-gencode.ts (+test) | T1, T2 | [ ] |
| T4 | Edge color/penwidth/style ([T4-edge-styling.md](T4-edge-styling.md)) | sonnet | src/gvc/device.ts (renderEdge styling only), src/render/svg-helpers.ts (edge path — verify) (+tests) | T1, T2 | [ ] |
| T5 | Cluster fill + graph bgcolor ([T5-cluster-graph.md](T5-cluster-graph.md)) | sonnet | src/render/svg-cluster.ts, src/render/svg-graph.ts (+tests) | T1, T2 | [ ] |

**Write-set caution:** T2 and T4 both touch src/gvc/device.ts. Resolve
by ownership: T2 (batch 1) adds the lifecycle scaffolding; T4 only
populates the edge obj-state inside the already-landed renderEdge. If
T4 needs structural device.ts changes beyond setting obj fields,
STOP and report (it likely belongs in T2's scope or a follow-up). Edge
PATH/arrow emission lives in svg-helpers.ts (svgEdgePath /
svgArrowPolygons) — T4 owns those; confirm they read job.obj via
emitStyle and that edge `style` (already partly working) is not
regressed.
