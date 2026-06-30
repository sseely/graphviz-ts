# T1 — gradient ID allocator + SVG def emitter (AD1-AD5)

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see per ported block. Suite baseline 1466/0, 82+ goldens
(post-parity-render-styling). Hook rule: smallest fix, ≤2 attempts
per file, then move on. Hook limits: 30 lines/function, CCN 10,
5 params, 500 lines/file.

C emits `<defs><linearGradient id="<objId>_l_<n>" ...>` or
`<defs><radialGradient id="<objId>_r_<n>" ...>` in-stream before
each gradient-filled shape. Two file-static counters (`gradId`,
`rgradId`) increment globally across the render.
(@see plugin/core/gvrender_core_svg.c:577, :614)

## Task

Create `src/render/svg-gradient.ts` with (all pure except counter
mutation):

1. **`resetGradientCounters()`** — resets module-level `gradId` and
   `rgradId` to 0. Call this at the start of each SVG render job
   (before the first shape is emitted). Determinism gate: if not
   called, golden byte-comparison fails. (AD1)

2. **`getGradientPoints(pts: Point[], n: number, angle: number): [Point, Point]`**
   — port of `get_gradient_points` (lib/common/utils.c:1446, flags=0
   for linear SVG case). Returns `[G0, G1]` on the gradient line.
   Pure function; no side effects.

3. **`emitLinearGradientDefs(pts: Point[], job: RenderJob): string`**
   — emits the `<defs><linearGradient id="...">` block to `job.write`
   and returns the `url(#id)` reference string. Reads
   `job.obj.id` (for the prefix), `job.obj.gradientAngle`,
   `job.obj.fillColor` (stop 0), `job.obj.stopColor` (stop 1),
   `job.obj.gradientFrac` (for the stop offsets). Increments `gradId`.
   (@see plugin/core/gvrender_core_svg.c:575-606)

4. **`emitRadialGradientDefs(job: RenderJob): string`**
   — emits `<defs><radialGradient id="..." cx="50%" cy="50%" r="75%"
   fx="..." fy="...">` and returns `url(#id)`. Reads
   `job.obj.gradientAngle`, `job.obj.fillColor` (stop at offset 0),
   `job.obj.stopColor` (stop at offset 1). Radial always uses 0/1
   stops (no frac). Increments `rgradId`.
   (@see plugin/core/gvrender_core_svg.c:611-639)

5. **`emitStopElement(job, offset, color)`** — internal helper that
   writes a `<stop offset="..." style="stop-color:...;stop-opacity:
   ...;"/>` element. Handles `transparent` as black with opacity 0
   (SVG 1.1 compat — same as C `svg_print_gradient_color`).
   (@see plugin/core/gvrender_core_svg.c:553-570)

6. **`resolveGradientFrac`** — helper that interprets `gradientFrac`:
   when `> 0`, first stop at `frac - 0.001`, second at `frac`;
   when `== 0`, first stop at 0, second at 1.
   (@see plugin/core/gvrender_core_svg.c:601-602)

TDD: write failing tests first for all pure functions and the
gradient ID scheme.

## Write-set (strict — nothing else)

`src/render/svg-gradient.ts` + `src/render/svg-gradient.test.ts`

## Read-set

- `~/git/graphviz/plugin/core/gvrender_core_svg.c` — `svg_gradstyle`
  (:575), `svg_rgradstyle` (:611), `svg_print_stop` (:553),
  `svg_print_gradient_color` (:147), `svg_grstyle` (:165)
- `~/git/graphviz/lib/common/utils.c` — `get_gradient_points` (:1446)
- `~/git/graphviz/lib/gvc/gvcjob.h` — `obj_state_t` gradient fields
  (:194-196)
- `src/gvc/job.ts` — `ObjState`, `RenderJob`, `GVColor` types
- `src/gvc/context.ts` — `FillType` enum (:39)
- `src/render/svg-helpers.ts` — `emitStyle`, `paintStr` (consumer
  context; read-only)

## Architecture decisions (locked)

AD1 (deterministic IDs via module-state counters, reset per render),
AD2 (inline defs, not hoisted), AD3 (port get_gradient_points here),
AD4 (radial = objectBoundingBox %, linear = userSpaceOnUse absolute),
AD5 (emitStyle caller uses returned url(#id) string).

## Interface contract (consumed by T2, T3, T4)

```ts
export function resetGradientCounters(): void
export function emitLinearGradientDefs(pts: Point[], job: RenderJob): string
export function emitRadialGradientDefs(job: RenderJob): string
```

Both emit functions write directly to `job.write(...)` and return the
`fill="url(#...)"` value fragment (just the `url(#id)` part, caller
writes `fill="`).

## Acceptance criteria (verified against `dot -Tsvg` output)

- Given `node1` object with `gradientAngle=0`, `fillcolor=red`,
  `stopcolor=blue`, `frac=0`: `emitLinearGradientDefs` writes
  `<defs>\n<linearGradient id="node1_l_0" gradientUnits="userSpaceOnUse" ...`
  and returns `url(#node1_l_0)`.
- Given NULL `obj.id` (HTML-table cell case): id is `l_0` (no prefix).
- Given second call: gradId increments → `l_1`.
- Given `resetGradientCounters()` then first call → `l_0` again.
- Given `frac=0.3`: stop offsets are `0.299` and `0.300`.
  (C formula: `frac - 0.001` and `frac`, formatted as %.03f)
- Given `frac=0` (radial case): stops at `0` and `1`.
- Given `gradientAngle=45` in linear case: `x1/y1/x2/y2` are
  non-trivial (geometry from `getGradientPoints`).
- Suite: 0 failed, goldens conformant (no callers yet).

## Quality bar

`npx tsc --noEmit` clean; `npx vitest run svg-gradient` 0 failed.
No `any` except at documented C-interop boundaries.
Commit: `feat(T1): port svg gradient def emitter + ID allocator`.
