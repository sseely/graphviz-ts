# G2 — gradient SVG emitters + obj-state plumbing (AD1, AD2, AD3, AD5)

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0). Baseline 1584/0, 97
goldens. Hook rule: smallest fix, ≤2 attempts/file, then move on.

The render path emits node/cluster/graph shapes via `emitStyle` (reads
`job.obj`). Today emitStyle handles only solid/none fill. The ObjState
(src/gvc/job.ts) already declares `stopColor`, `gradientAngle`,
`gradientFrac` and the enums `FillType.Linear`/`FillType.Radial` exist
(src/render/context.ts). This task ports the SVG gradient emitters and
extends emitStyle to emit `<defs>` + `fill="url(#id)"` when the obj-state
fill is Linear/Radial. G3/G4 will SET those obj-state fields; this task
makes the EMISSION correct and keeps solid/none conformant.

## C ground truth (verified — match exactly)

`a [style=filled, fillcolor="red:blue"]` (linear gradient) emits, right
before the `<ellipse>`:
```
<defs>
<linearGradient id="l_0" gradientUnits="userSpaceOnUse" x1="..." y1="..." x2="..." y2="..." >
<stop offset="0" style="stop-color:red;stop-opacity:1.;"/>
<stop offset="1" style="stop-color:blue;stop-opacity:1.;"/>
</linearGradient>
</defs>
<ellipse fill="url(#l_0)" stroke="black" .../>
```
`style="radial,filled"` emits `<radialGradient id="r_0" cx="50%" cy="50%"
r="75%" fx="..%" fy="..%">` + two stops, `fill="url(#r_0)"`. The id is
`<obj.id>_l_<n>` when the object has an id, else `l_<n>` (and `r_<n>`).
Capture the exact `dot -Tsvg` output for several cases and match it
conformant (run the oracle).

## Task (TDD — failing tests first)

### 1. src/render/svg-gradient.ts (NEW) — port the emitters

@see plugin/core/gvrender_core_svg.c:553 (svg_print_stop), :572
(svg_gradstyle), :608 (svg_rgradstyle); lib/common/utils.c:1446
(get_gradient_points).
- `getGradientPoints(A: Point[], angle: number, radial: boolean): {g0: Point; g1: Point}`
  — port get_gradient_points (linear branch: bbox center ± half*cos/sin;
  radial branch: center + inner/outer radii). The port renders y-up but
  SVG y-down; the C function computes in a frame where it negates center.y
  for the non-RHS case — match C's exact formulas including the `-center.y`
  terms. Verify the emitted x1/y1/x2/y2 against the oracle.
- `emitLinearGradient(job, pts: Point[], id: string): void` — port
  svg_gradstyle: emit `<defs>\n<linearGradient id="<id>" gradientUnits=
  "userSpaceOnUse" x1=".." y1=".." x2=".." y2=".." >\n` then two stops,
  `</linearGradient>\n</defs>\n`. Stops via emitStop. First stop offset =
  `frac>0 ? frac-0.001 : 0`, color = obj.fillColor; second offset =
  `frac>0 ? frac : 1`, color = obj.stopColor. Use job.printDouble for the
  coords (gvprintdouble parity).
- `emitRadialGradient(job, id): void` — port svg_rgradstyle (cx 50% cy
  50% r 75%, fx/fy from angle: angle 0 → 50/50, else round(50*(1+cos)),
  round(50*(1-sin))).
- `emitStop(job, offset: number, color: GVColor): void` — port
  svg_print_stop: `<stop offset="0|1|%.3f" style="stop-color:COLOR;
  stop-opacity:OPACITY;"/>\n`. opacity: rgba a<255 → a/255 (%f); string
  "transparent" → "0"; else "1.". Match the exact `1.` / `0` / `%.03f`
  formatting (offset 0 → "0", offset 1 → "1", else 3 decimals).
- Gradient id construction: `gradientId(obj, kind: 'l'|'r', n): string` →
  `(obj.id ? escapeXml(obj.id)+'_' : '') + kind + '_' + n`.

### 2. src/gvc/job.ts — gradient id counters

Add `linearGradId = 0` and `radialGradId = 0` fields to RenderJob
(alongside nodeId/clusterId). Per AD1 they start at 0 per render (a fresh
dot process starts at 0) and increment each time a gradient is emitted.
Do NOT change the ObjState interface (the gradient fields already exist).

### 3. src/render/svg-helpers.ts — emitStyle gradient branch (AD3)

In `emitStyle` (and/or the shape emitters svgEllipse/svgPolygon/svgBezier
— pick the faithful split), when `obj.fill === FillType.Linear` or
`FillType.Radial` AND `filled` is true:
- emit the `<defs>` gradient block FIRST (inline, before the element —
  AD2) by calling the svg-gradient emitter (allocate the id via the
  job counter), THEN emit `fill="url(#<id>)"` instead of the solid
  paint. The stroke/penwidth/dash emission is UNCHANGED.
- For the SOLID and NONE cases, emitStyle output is conformant to
  today (the 97 goldens). The gradient branch is reached ONLY when
  obj.fill is Linear/Radial, which no default/solid object sets.
The shape emitters pass `pts` (the polygon/ellipse points) to the
gradient emitter so getGradientPoints can compute the gradient line; for
an ellipse, C passes [center, corner] (2 points). Thread the points
through. Keep the Lizard parser rules (no `${...}` in exported fns;
new RegExp('"','g') for double-quote).
Do NOT change emitDash/emitPenWidth/paintStr behavior for solid/none.

## Write-set (STRICT)

- src/render/svg-gradient.ts (new) + src/render/svg-gradient.test.ts (new)
- src/render/svg-helpers.ts (emitStyle + shape emitters gradient branch)
- src/gvc/job.ts (gradId counters only)
- co-located tests for the emitStyle change (extend svg.test.ts or a new
  test file you own)

Do NOT touch style-resolve.ts/multicolor.ts (G1), poly-gencode.ts/
device.ts (G3), svg-graph.ts (G4).

## Read-set

- plugin/core/gvrender_core_svg.c:553-690 (svg_print_stop, svg_gradstyle,
  svg_rgradstyle, svg_grstyle fill-url branch, svg_ellipse/polygon/bezier
  GRADIENT dispatch)
- lib/common/utils.c:1446-1500 (get_gradient_points — BOTH branches)
- src/render/svg-helpers.ts:77-123 (paintStr/emitStyle/emitDash/
  emitPenWidth), 308-359 (svgEllipse/svgPolygon/svgBezier)
- src/gvc/job.ts (ObjState gradient fields 99-106, RenderJob counters
  ~217-224), src/gvc/context.ts (FillType), src/common/color.ts:15
  (GVColor)

## Architecture decisions (locked)

AD1 (per-job gradId counters), AD2 (defs inline before shape), AD3
(additive gradient branch; solid path frozen), AD5 (new svg-gradient.ts
to keep svg-helpers.ts < 500 lines).

## Acceptance criteria (oracle-verify each)

- A test that manually sets obj.fill=Linear, fillColor=red, stopColor=
  blue, frac=0, angle=0 on a pushed obj, then calls svgEllipse with
  filled=true, emits the `<defs><linearGradient id="l_0" …>` + two stops
  + `<ellipse fill="url(#l_0)" …>` matching the C oracle conformant.
- Radial variant → `<radialGradient id="r_0" …>` + `url(#r_0)`.
- A second gradient in the same job → `l_1` / `r_1` (counter increments).
- obj.fill=Solid → output conformant to today; obj.fill=None →
  `fill="none"`. 97 goldens conformant (no obj sets Linear/Radial yet).
- frac>0 (e.g. 0.3) → first stop offset 0.299, second 0.3 (match C's
  frac-0.001 / frac).

## Byte-stability gate

```
OUTDIR=/tmp/g2-after npx tsx .probes/render-all.ts
diff -rq /tmp/mc-baseline /tmp/g2-after   # baseline captured by orchestrator
```
MUST be no differences. tsc 0; vitest ≥1584, 0 failed.

## Return (brief, structured)

- The svg-gradient.ts exported API; where the emitStyle gradient branch
  lives (emitStyle vs the shape emitters) and how points are threaded.
- Oracle table: linear, radial, frac>0, second-gradient-id, solid-
  unchanged — PORT vs C Y/N.
- tsc; full vitest; byte-diff result.
