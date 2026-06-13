# Mission — gradient fills parity (linearGradient / radialGradient / striped / wedged)

**Objective:** Replace the first-color-solid fallback for multi-color
fills with real SVG gradient emission, matching C graphviz 15.0.0.
Today, `style=filled fillcolor="c1:c2"` (and all gradient-bearing
attrs) falls back to the first solid color via `parseGradientSpec` in
`src/common/htmltable-emit-fill.ts`. C emits `<defs><linearGradient>`
/ `<defs><radialGradient>` before the shape element and fills with
`fill="url(#id)"`. Also covers: `graph[bgcolor="c1:c2"]`, cluster
gradient fills, HTML-table `BGCOLOR` with `GRADIENTANGLE` (the M12
AD4 deferral, now actioned), and `style=striped` / `style=wedged`
multicolor fills.

**DEPENDENCY (HARD):** This mission MUST run AFTER
`plans/parity-render-styling/` lands and merges. The render-styling
mission wires `ObjState` (pen/fill/pencolor/fillcolor) into the
node/edge/cluster/graph walk. Gradient fills extend that fill
resolution — without a populated `job.obj`, gradient emission has
nowhere to write `stopColor`, `gradientAngle`, and `gradientFrac`.
Do not begin this mission until the render-styling branch is merged.

## Branch

`feature/parity-gradient-fills` off `feature/post-parity`. Merge back
with a **merge commit** when all gates pass, on Scott's go-ahead.

## Canonical rules

- C source at `~/git/graphviz/lib/` (tag 15.0.0) is the spec; SVG
  refs only from the installed 15.0.0 `dot` binary.
- NEVER modify existing refs, manifest entries, or tolerances;
  additions APPEND (carried AD-C1).
- One commit per task; re-read this README + decision-journal.md after
  every compaction.
- Agent prompts MUST include the hook rule: "if a pre-commit/length/
  CCN hook complains, smallest fix, at most 2 attempts per file, then
  move on." Hook limits: 30 lines/function, CCN 10, 5 params,
  500 lines/file.

## Quality Gates (after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND failed == 0 AND passed >= 1466
  on_fail: fix_and_rerun
- command: OUTDIR=/tmp/gf-x npx tsx .probes/render-all.ts + byte-diff vs pre-task baseline
  pass: existing goldens byte-identical (82+RS until T6 lands, more after)
  on_fail: stop
- command: git diff --name-only HEAD~1..HEAD
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1466 passed / 0 failed**, 82+ goldens
(post-parity-render-styling merge). Exact baseline count confirmed
before first commit.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 (sequential: T1 → T2) | [T1 gradient ID allocator + SVG def emitter](batch-1/T1-gradient-emitter.md), [T2 node linear + radial fills](batch-1/T2-node-gradients.md) | [ ] |
| 2 (parallel, after 1) | [T3 cluster + graph bgcolor gradients](batch-2/T3-cluster-graph-gradients.md), [T4 HTML-table BGCOLOR gradient (M12 AD4)](batch-2/T4-htmltable-gradients.md) | [ ] |
| 3 (after 2) | [T5 striped / wedged multicolor fills](batch-3/T5-striped-wedged.md), [T6 goldens + C-oracle verify](batch-3/T6-goldens.md) (orchestrator inline) | [ ] |

T1 must land before T2; both must land before batch 2. T5 and T6 are
after batch 2.

## Stop conditions

- Change outside the active task's write-set
- 2 consecutive gate failures on the same check; same location/
  approach changed 3+ times for the same failure
- Implementation contradicts AD1–AD5 ([decisions.md](decisions.md))
- A divergence from the C oracle traces to code outside this
  mission's blast-radius (M10/M11/M12/render-styling precedent — no
  silent fixes)
- Numeric divergence with an FMA signature without disassembly
  evidence (src/common/fma.ts)
- gradient IDs are not deterministic in golden byte-comparison
  (journal and stop — do not papier-mâché with a sort)

## Push-forward conditions (journal entry each)

- Hook-forced module splits; C function boundaries + @see preserved
- Probe design under .probes/ (untracked)
- Test-fixture repairs in files the task owns
- Trivially obvious fallback-chain fixes within a task's own files
- Unskipping M12 AD4 deferral comment sites (GRADIENTANGLE in HTML
  table path) — T4's declared purpose, not a scope violation

## Key references

- [decisions.md](decisions.md) — AD1–AD5 + carried rules
- [decision-journal.md](decision-journal.md) — append-only
- [diagrams/component-map.md](diagrams/component-map.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- C: plugin/core/gvrender_core_svg.c — `svg_gradstyle` (:575),
  `svg_rgradstyle` (:611), `svg_grstyle` (:165), `svg_print_stop`
  (:553), `svg_ellipse/svg_polygon/svg_bezier` (gradient dispatch
  :642-714)
- C: lib/common/emit.c — `findStopColor` (:4335),
  `gvrender_set_gradient_vals` (lib/gvc/gvrender.c:467),
  `emit_background` gradient block (:1503-1516),
  `emit_begin_cluster` gradient block (:3857-3866),
  `wedgedEllipse` (:549), `stripedBox` (:595)
- C: lib/common/utils.c — `get_gradient_points` (:1446)
- C: lib/gvc/gvcjob.h — `obj_state_t.stopcolor/.gradient_angle/
  .gradient_frac` (:194-196)
- TS: src/render/svg-helpers.ts — `emitStyle` / `paintStr` /
  `svgPolygon` / `svgEllipse` / `svgBezier`
- TS: src/gvc/job.ts — `ObjState.stopColor/.gradientAngle/
  .gradientFrac`, `FillType.Linear/Radial` (context.ts:39)
- TS: src/common/htmltable-emit-fill.ts — `parseGradientSpec` /
  `setHtmlFill` (current first-color fallback to REPLACE)
- plans/parity-render-styling/ — dependency mission; read AD1-AD4
  before this mission's AD1+
