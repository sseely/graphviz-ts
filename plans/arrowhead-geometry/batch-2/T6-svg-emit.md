# T6 — SVG emit per draw-op (polygon / ellipse / polyline)

## Context
`svgArrowPolygons(e, job)` (svg-helpers.ts:476) reads `_arrowPts`/`_tailArrowPts`
and emits a single `<polygon>` via `emitArrowPolygon`. Switch it to walk the
typed `headArrowOps`/`tailArrowOps` (T5) and emit the right SVG primitive per op:
filled/unfilled `<polygon>`, `<ellipse>`, or `<polyline>`.

## Task
1. Rewrite `svgArrowPolygons` to iterate `tailArrowOps` then `headArrowOps`
   (tail first, matching today's order), emitting per `op.kind`:
   - `polygon` → existing `emitArrowPolygon` path; honor `filled` (fill=penColor
     vs fill="none"). Preserve the Adobe first-point rotation already in
     `emitArrowPolygon`.
   - `ellipse` → `<ellipse cx cy rx ry>` with fill = penColor (filled) or "none"
     (open), stroke = penColor — match `svg_ellipse` byte format (cx/cy/rx/ry
     `printDouble`, stroke).
   - `polyline` → `<polyline points=... fill="none" stroke=penColor>`.
2. Reuse pen color/width from `job.obj` exactly as today.
3. Update `svg-edge-style.test.ts` and any test referencing `_arrowPts` to the new
   `headArrowOps`/`tailArrowOps` fields + new emission.

## Write-set
- `src/render/svg-helpers.ts` (modify) + `src/render/svg-edge-style.test.ts`
  (+ any svg arrow test referencing the old field)

## Read-set
- `src/model/edgeInfo.ts` (headArrowOps/tailArrowOps) — T5
- `src/render/svg-helpers.ts:448-490` (emitArrowPolygon, svgArrowPolygons)
- `~/git/graphviz/plugin/core/gvrender_core_svg.c` svg_ellipse / svg_polygon /
  svg_polyline (byte format)
- decisions.md#adr-1

## Interface outputs
Final SVG arrow primitives. (Terminal — consumed by the oracle/golden checks.)

## Acceptance criteria
- Given `a->b[arrowhead=dot]`, when rendered, then the output contains
  `<ellipse ... />` whose cx/cy/rx/ry conformant with native `dot -Tsvg`.
- Given `arrowhead=odot`, then the ellipse has `fill="none"`.
- Given `arrowhead=crow`, then a `<polygon>` with the 9-pt `points=` matching the
  oracle.
- Given default `a->b`, then the `<polygon>` is conformant to today (normal
  arrow unchanged).
- After this task, oracle-verify the 16 target cases: each no longer diverges on
  the arrow primitive (record per-id verdicts in the journal).

## Observability / Rollback
N/A. Reversible.

## Quality bar
`npm run typecheck && npm test && npm run build` green. One commit: `feat(svg):
emit arrow draw-ops as polygon/ellipse/polyline (T6)`.

## Boundaries
- Do NOT change layout (T5 owns it). Match the C svg primitive byte format
  exactly (attribute order, `printDouble` precision).
