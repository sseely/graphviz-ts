# G4 — wire graph bgcolor gradient (AD3, AD6)

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0). Baseline 1584/0, 97
goldens. Hook rule: smallest fix, ≤2 attempts/file, then move on.

G1 added findStopColor + discriminated resolvers; G2 made the gradient
emitters + emitStyle url branch + gradId counters. The parity mission's
`resolveGraphBgcolor` (src/render/svg-graph.ts) currently returns a solid
color (or transparent-omit), drawing the background polygon via the
hardcoded `<polygon fill="..." stroke="none">`. This task makes a
two-color `bgcolor="c1:c2"` emit a real gradient background, matching C's
emit_background gradient block.

## C ground truth (emit_background, emit.c ~1500; oracle-verify)

`bgcolor="lightyellow:lightblue"` paints the page rect as a gradient:
findStopColor(bgcolor) → fillcolor/stopcolor/frac; pencolor transparent;
GRADIENT (or RGRADIENT if a graph `style=radial`); `gvrender_box(clip,
GRADIENT)` → the background polygon emits a `<defs><linearGradient
id="l_0" …>` + `fill="url(#l_0)"`. The gradient angle comes from the
graph `gradientangle` attr. Capture `printf 'digraph{bgcolor="red:blue";a}'
| dot -Tsvg` and match the `<defs>` + background polygon conformant
(coords identical to the solid background polygon; only the fill becomes
url()).

## Task (TDD — failing tests first)

In src/render/svg-graph.ts:
- The background is currently emitted by `emitGraphBackground` using
  `resolveGraphBgcolor`. Extend the resolution to detect a gradient
  (findStopColor on the bgcolor): when the bgcolor is a 2-color spec,
  emit the background polygon as a GRADIENT — push the gradient fields
  onto `job.obj` (the graph ObjState pushed in renderGraph) and route the
  polygon through the obj-state/emitStyle gradient path (G2), OR emit the
  `<defs>` + `fill="url(#id)"` polygon directly via the G2 svg-gradient
  emitter (whichever keeps the background coords conformant). The
  graph background uses the page clip box as the gradient points (C passes
  the box to get_gradient_points).
- Solid bgcolor / no bgcolor / transparent paths stay conformant
  (the 97 goldens — all solid/white/none backgrounds).
- Gradient id: the background gradient is the FIRST gradient emitted in
  the page, so `l_0` (no obj id prefix on the root graph, OR `graph0_l_0`
  — VERIFY against the oracle; the root graph's obj.id may be "graph0").

Reuse the G2 emitter (`emitLinearGradient`/`emitRadialGradient` +
`getGradientPoints`) and the gradId counters — do NOT duplicate gradient
emission. Respect the Lizard rule (no `${...}` template literals in
exported functions in svg-graph.ts).

## Write-set (STRICT)

- src/render/svg-graph.ts (+ src/render/svg-graph.test.ts)

If you need to change the G2 emitters or job.ts, STOP and report (those
are G2's; coordinate via the interface contract).

## Read-set

- ~/git/graphviz/lib/common/emit.c:emit_background (:1480-1530, the
  findStopColor/GRADIENT branch)
- src/render/svg-graph.ts (resolveGraphBgcolor, emitGraphBackground,
  svgBeginGraph from the parity mission)
- src/render/svg-gradient.ts (G2 emitters), src/common/style-resolve.ts
  (G1 findStopColor), src/gvc/job.ts (graph obj-state + gradId counters)
- G2 task file (interface contract)

## Architecture decisions (locked)

AD3 (use the obj-state/emitStyle gradient path or the G2 emitter — don't
re-implement), AD6 (gradient when findStopColor true). AD2 (defs inline
before the background polygon).

## Acceptance criteria (oracle-verify)

- `bgcolor="red:blue"` → `<defs><linearGradient …>` + background polygon
  `fill="url(#…)"`, coords identical to the solid background, matching C.
- graph `style=radial bgcolor="red:blue"` → radial (if C supports it;
  verify — else linear; journal).
- solid `bgcolor=lightyellow` → unchanged (parity); no bgcolor → white;
  transparent → omitted. 97 goldens conformant.

## Byte-stability gate

```
OUTDIR=/tmp/g4-after npx tsx .probes/render-all.ts
diff -rq /tmp/mc-baseline /tmp/g4-after
```
no differences. tsc 0; vitest 0 failed.

## Return (brief, structured)

- How the gradient background is emitted (obj-state route vs direct G2
  emitter); the gradient id you observed for the root background (l_0 vs
  graph0_l_0) per the oracle.
- Oracle table: bgcolor-linear, bgcolor-radial(if any), solid-unchanged,
  none/transparent — PORT vs C Y/N.
- tsc; vitest; byte-diff result.
