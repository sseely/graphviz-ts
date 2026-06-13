# T4 — edge color / penwidth / style (AD1, AD2)

## Context

graphviz-ts port; C spec at ~/git/graphviz/lib (15.0.0). Baseline
1466/0, 82 goldens. Hook rule: smallest fix, ≤2 attempts/file, move on.

Edge paths and arrows render via src/render/svg-helpers.ts
(`svgEdgePath`, `svgArrowPolygons`). Today edge `style=dashed` already
emits (the path writer handles dash independently), but edge `color`
and `penwidth` are dropped because the edge obj-state is null/default.
T2 now pushes a default ObjState per edge in renderEdge (src/gvc/
device.ts); this task populates it from the edge attrs so edge color,
penwidth, and style all render, matching C emit_edge.

## Task

1. In renderEdge (src/gvc/device.ts), after T2's pushed edge obj-state,
   resolve and set `penColor` (T1 resolvePenColor on the edge `color`
   attr — note C edge color can be a colorList "c1:c2" → first color
   for the single-spline case; multi-color edges are a documented
   follow-up, journal), `pen`/`penWidth` (T1 resolvers on edge `style`
   + `penwidth`). @see lib/common/emit.c:emit_edge (pencolor/style/
   penwidth blocks, ~:2311-2540).
2. Confirm `svgEdgePath`/`svgArrowPolygons` consume `job.obj` via the
   shared emit path; arrows are FILLED with the pen color in C
   (`gvrender_polygon(... filled)` with pen color) — verify arrow fill
   matches C (today arrows are `fill="black"`).
3. Do NOT make structural device.ts changes beyond setting obj fields
   (T2 owns the lifecycle scaffolding). If structural changes seem
   needed, STOP and report.
4. TDD: failing tests first; oracle-verify edge color, penwidth, style,
   colored arrowhead.

## Write-set (strict)

src/gvc/device.ts (renderEdge styling lines only), src/render/
svg-helpers.ts (edge path/arrow — only if arrow fill needs the pen
color wired), + co-located tests. If the edge-styling set exceeds
these, STOP and report.

## Read-set

~/git/graphviz/lib/common/emit.c:emit_edge (:2300-2550 color/style/
penwidth + arrow); src/gvc/device.ts (renderEdge, ~:99-105 after T2);
src/render/svg-helpers.ts (svgEdgePath ~:387, svgArrowPolygons ~:397);
src/common/style-resolve.ts (T1); src/gvc/job.ts (ObjState).

## Architecture decisions (locked)

AD1, AD2, AD3 (colorList → first color; multi-color edge a follow-up),
AD4 (don't change emitStyle/emitDash/emitPenWidth logic).

## Interface contract

None new — terminal emission. Edge obj-state carries penColor/pen/
penWidth before svgEdgePath; arrows fill with the resolved pen color.

## Acceptance criteria

- Given `A->B [color=red]`, then edge path `stroke="red"` and arrow
  `fill="red" stroke="red"` matching C
- Given `[penwidth=2]`, then `stroke-width="2"` on the path
- Given `[style=dashed]`, then `stroke-dasharray="5,2"` (no regression)
- Given `[style=bold]`, then penwidth 2
- Given an unstyled edge, output byte-identical to pre-task; 82 goldens
  stable

## Observability / rollback

N/A — gates are the SLI. Reversible (single commit).

## Quality bar

tsc clean; vitest 0 failed; byte-stability clean. Commit (orchestrator):
`feat(T4): render edge color, penwidth, and line style`.
