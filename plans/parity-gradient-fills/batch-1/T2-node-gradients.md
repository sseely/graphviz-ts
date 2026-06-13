# T2 — node linear + radial gradient fills

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see per ported block. Suite baseline 1466/0, 82+ goldens
(post-parity-render-styling). Hook rule: smallest fix, ≤2 attempts
per file, then move on. Hook limits: 30 lines/function, CCN 10,
5 params, 500 lines/file.

**Depends on T1 being committed.** T1 provides `emitLinearGradientDefs`,
`emitRadialGradientDefs`, and `resetGradientCounters`.

C dispatches gradient emission per shape in `svg_ellipse`,
`svg_polygon`, `svg_bezier` — each checks if `filled==GRADIENT` or
`filled==RGRADIENT`, calls the appropriate `svg_gradstyle`/
`svg_rgradstyle`, captures the returned `gid`, then calls
`svg_grstyle(job, filled, gid)` which writes `fill="url(#...)"`.
(@see plugin/core/gvrender_core_svg.c:642-714)

The render-styling mission (parity-render-styling T3) wires
`obj.fillColor`, `obj.fill` (FillType.Solid/None) from attrs.
THIS task wires `FillType.Linear/Radial` + `obj.stopColor`,
`obj.gradientAngle`, `obj.gradientFrac` when `findStopColor` detects
a gradient spec in `fillcolor`.

## Task

1. **Extend `src/common/style-resolve.ts`** (from parity-render-styling
   T1): add `resolveNodeGradient(fillcolorAttr, gradAngleAttr)` that:
   - Calls `parseGradientSpec(fillcolor)` to detect `c1:c2` form.
   - If gradient: sets `fill = FillType.Linear` (or `FillType.Radial`
     if `style=radial`), `fillColor = c1`, `stopColor = c2`,
     `gradientAngle` from `gradientangle` attr (default 0),
     `gradientFrac` from the semicolon fraction if present (default 0).
   - If not gradient: returns `FillType.Solid`, `fillColor = color`,
     `stopColor` unused.
   - @see lib/common/emit.c:isFilled, findStopColor (:4335), and
     lib/common/emit.c gradient block in emit_begin_node.

2. **Extend `src/render/svg-helpers.ts`**: modify `emitStyle`,
   `svgEllipse`, `svgPolygon`, `svgBezier` to detect
   `obj.fill === FillType.Linear` or `.Radial`:
   - Before writing `<ellipse`/`<polygon`/`<path`: call
     `emitLinearGradientDefs(pts, job)` or `emitRadialGradientDefs(job)`
     and write the returned `<defs>` block.
   - In `emitStyle` (or the shape function directly): write
     `fill="url(#...)"` instead of `paintStr(obj, true)`.
   - When `obj.fill` is `None` or `Solid`: behavior unchanged (golden
     byte-stability for existing 82+ goldens).

3. **Wire `resetGradientCounters()`** at the start of each SVG render
   job (locate the render entry point — likely `src/render/svg.ts` or
   `src/gvc/device.ts`; confirm by reading). Call before the first
   shape is emitted. One call per render, not per graph.

TDD: write failing integration tests (node with gradient fillcolor
→ check SVG contains `<linearGradient`, `fill="url(#`).

## Write-set (strict — nothing else)

- `src/common/style-resolve.ts` (add `resolveNodeGradient`)
- `src/render/svg-helpers.ts` (extend `emitStyle`, shape emitters)
- `src/render/svg.ts` or `src/gvc/device.ts` (reset call — read to
  confirm which file; one of these is the render entry point)
- `src/render/svg-helpers.test.ts` (or co-located test)

## Read-set

- `src/render/svg-gradient.ts` (T1 output — the API to call)
- `src/common/style-resolve.ts` (extend this file)
- `src/render/svg-helpers.ts` (modify: emitStyle + shape emitters)
- `src/gvc/context.ts` — FillType enum
- `src/gvc/job.ts` — ObjState fields
- `~/git/graphviz/plugin/core/gvrender_core_svg.c` — `svg_ellipse`
  (:642), `svg_polygon` (:686), `svg_bezier` (:665), `svg_grstyle`
  (:165)
- `~/git/graphviz/lib/common/emit.c` — gradient dispatch in
  emit_begin_node (the style=radial/filled+gradient block around :1424)

## Architecture decisions (locked)

AD1 (reset counters per render), AD2 (inline defs before shape),
AD5 (emitStyle extended with FillType.Linear/Radial branch).

## Acceptance criteria (verified against `dot -Tsvg`)

```
Given: digraph G { a [style=filled fillcolor="red:blue"] }
When: port renders to SVG
Then: output contains:
  <defs>\n<linearGradient id="node1_l_0" gradientUnits="userSpaceOnUse" ...
  <stop offset="0" style="stop-color:red;stop-opacity:1.;"/>
  <stop offset="1" style="stop-color:blue;stop-opacity:1.;"/>
  </linearGradient>\n</defs>
  fill="url(#node1_l_0)"

Given: digraph G { a [style=radial fillcolor="red:blue"] }
When: port renders to SVG
Then: output contains:
  <defs>\n<radialGradient id="node1_r_0" cx="50%" cy="50%" r="75%" ...
  fill="url(#node1_r_0)"

Given: digraph G { a [style=filled fillcolor="red:blue" gradientangle=45] }
When: port renders to SVG
Then: x1/y1/x2/y2 in linearGradient match dot -Tsvg (non-zero, angle-derived)

Given: a graph with no gradient attrs (solid fill or unfilled)
When: port renders to SVG
Then: output is byte-identical to pre-task baseline
```

## Quality bar

`npx tsc --noEmit` clean; `npx vitest run` 0 failed, passed ≥ 1466;
82+ goldens byte-identical vs pre-task baseline.
Commit: `feat(T2): wire node linear/radial gradient fills`.
