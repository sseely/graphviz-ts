# T3 — cluster fill + graph bgcolor gradient emission

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see per ported block. Suite baseline 1466/0, 82+ goldens
(post-parity-render-styling + batch 1). Hook rule: smallest fix,
≤2 attempts per file, then move on.

C handles cluster gradient fills in `emit_begin_cluster` (emit.c:3857)
and graph bgcolor gradients in `emit_background` (emit.c:1503).
Both call `findStopColor`, then `gvrender_set_gradient_vals`, setting
`obj->stopcolor`, `obj->gradient_angle`, `obj->gradient_frac` on the
active job obj, then pass `GRADIENT` or `RGRADIENT` as the `filled`
flag to `gvrender_box`.

The TS side has `src/render/svg-cluster.ts` (cluster bounding-box
polygon) and `src/render/svg-graph.ts` (graph background box). Both
currently call `emitStyle` with solid fill. After render-styling
batch 2 (T5), cluster and graph objs have proper `ObjState` pushed.
This task wires gradient resolution into those same obj-states.

## Task

1. **`src/render/svg-cluster.ts`** — before emitting the cluster
   polygon, check if `obj.fill === FillType.Linear/Radial`:
   - If yes: call `emitLinearGradientDefs(AF, job)` or
     `emitRadialGradientDefs(job)` and store the returned URL.
   - Write `<polygon ... fill="url(#id)" ...>` instead of the solid
     fill.
   - Read `~/git/graphviz/lib/common/emit.c:3857-3866` for the
     gradient detection pattern (findStopColor + gvrender_set_gradient_
     vals in the cluster path). The render-styling T5 agent will have
     set `obj.fill = FillType.Linear/Radial` and populated the
     gradient fields when a gradient spec is present.

2. **`src/render/svg-graph.ts`** (or `emitGraphBackground`) — same
   pattern for `graph[bgcolor="c1:c2"]`. C: emit_background:1503-1516.
   When `obj.fill === FillType.Linear/Radial`, emit gradient defs and
   `fill="url(#id)"`.

3. **Tests** — integration test: cluster with `fillcolor="red:blue"`,
   graph with `bgcolor="green:yellow"` → SVG contains gradient defs.

## Write-set (strict — nothing else)

- `src/render/svg-cluster.ts`
- `src/render/svg-graph.ts`
- co-located test files for the above

## Read-set

- `~/git/graphviz/lib/common/emit.c` — `emit_begin_cluster`
  gradient block (:3857-3866), `emit_background` gradient block
  (:1503-1516)
- `src/render/svg-gradient.ts` (T1 API)
- `src/render/svg-cluster.ts`, `src/render/svg-graph.ts` (modify)
- `src/gvc/context.ts` — FillType
- `src/gvc/job.ts` — ObjState

## Architecture decisions (locked)

AD1 (global counter, already reset by T2), AD2 (inline defs),
AD5 (fill="url(#...)" via FillType.Linear/Radial branch).

## Acceptance criteria (verified against `dot -Tsvg`)

```
Given: digraph G { subgraph cluster_0 { style=filled fillcolor="red:blue" a } }
When: port renders
Then: SVG contains <linearGradient id="clust1_l_N" ...> and
      <polygon fill="url(#clust1_l_N)" ...>

Given: digraph G { graph [bgcolor="red:blue"] a -> b }
When: port renders
Then: SVG contains <linearGradient id="graph0_l_N" ...> and
      <polygon fill="url(#graph0_l_N)" ...>
      (C uses "graph0" as the graph id — verify with dot -Tsvg)

Given: a graph with no bgcolor or with solid bgcolor
When: port renders
Then: SVG conformant to pre-task baseline
```

## Quality bar

`npx tsc --noEmit` clean; `npx vitest run` 0 failed, passed ≥ 1466;
82+ existing goldens conformant.
Commit: `feat(T3): cluster + graph bgcolor gradient fills`.
