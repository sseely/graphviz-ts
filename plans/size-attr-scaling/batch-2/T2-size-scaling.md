<!-- SPDX-License-Identifier: EPL-2.0 -->

# T2 — `size=` drawing scaling (parse → zoom → render)

## Context

Faithful port of Graphviz; `~/git/graphviz` is the spec. The port **ignores the
`size=` graph attribute**: it emits `transform="scale(1 1)"` and unscaled
`width`/`height`/`viewBox`. The oracle fits the drawing into the requested
`size` by computing a zoom `Z` and emitting `scale(Z)` plus size-fitted
dimensions. Example — `rankdir_dot` (`size="6,6"`): oracle emits
`scale(0.123195)`, `width="432pt" height="125pt"`; port emits `scale(1 1)`,
`width="3507pt" height="1021pt"`. This is the dominant divergence (maxΔ
3075–3193) on 6 rows and reaches ~137 `size=` corpus inputs.

Read [decisions.md](../decisions.md) D1–D5 in full before starting — they fix
the parse location, units, the ratio-aspect exclusion, the SVG-coords-stay-
full-size rule, and the regression floor.

## Task

In `render()` (`src/gvc/device.ts:442`, after `job.bb` is assigned at line 445):

1. **Parse** `size` and the filled flag from `g.attrs` (D1, D2):
   - `size = g.attrs.get('size')`; parse `"x,y"` or `"x"` (square); strip a
     trailing `!` and set `filled = true` when present.
   - convert inches→points: `drawing.size = {x: x*72, y: y*72}` (D2).
   - `filled ||= (g.attrs.get('ratio') === 'fill')` (D3). Do **not** set
     `ratioKind` for layout (D3).
2. **Compute zoom** `Z` per `init_job_viewport` (`emit.c:3356`, formula in
   [decisions.md#d3](../decisions.md#d3)) using `sz = job.bb.UR - job.bb.LL`
   (points, includes pad). Set `job.zoom = Z`. `Z` stays `1.0` when `size` is
   absent/degenerate (D5).

In `src/render/svg-graph.ts`:

3. `emitGraphGroupOpen` (line 84): replace literal `scale(1 1)` with
   `scale(Z Z)` using `job.zoom` (print with the existing double formatter,
   matching the oracle's `%g`).
4. `emitSvgTag` (line 54): the emitted `width`/`height`/`viewBox` become the
   **size-fitted device dims** = `round(dim * job.zoom)` (oracle:
   `gvrender_core_svg.c:258`, dims = `job.width/height`). Keep `viewBox`
   origin at `0 0`. Confirm rounding mode against the oracle (C uses integer
   `job->width`); pin from instrumented output if a canary dim is off by 1.

Do **not** change any node/edge coordinate emission — SVG keeps full-size coords
(D4); `transformPoint` already short-circuits on `GVRENDER_DOES_TRANSFORM`
(`device.ts:59`).

## Write-set

- `src/gvc/device.ts` — `render()` only (the `init_job_viewport` port). Leave
  `renderOneLabel` (T1) untouched.
- `src/render/svg-graph.ts` — `emitSvgTag`, `emitGraphGroupOpen`.
- `test/golden/inputs/dot-size-scaling.dot` — new input with `size=`.
- `test/golden/refs/dot-size-scaling.svg` — oracle reference.
- `test/golden/manifest.json` — append one entry.

## Read-set

- `src/gvc/device.ts:52-70` (`transformPoint`), `:440-450` (`render()` setup)
- `src/render/svg-graph.ts:50-90` (`emitSvgTag`, `emitGraphGroupOpen`)
- `src/model/layoutParams.ts:59-90` (`LayoutParams.size`, `ratioKind`, `filled?`)
- `src/gvc/job.ts:280-295` (`RenderJob.zoom`, `scale`, `bb`)
- `~/git/graphviz/lib/common/emit.c:3356-3427` (`init_job_viewport`), `:3680`
- `~/git/graphviz/lib/common/input.c:576-598,694` (`setRatio`, size parse)
- `~/git/graphviz/plugin/core/gvrender_core_svg.c:255-315` (dims, scale emit)
- `~/git/graphviz/lib/common/types.h` (`layout_t.size`, `filled`, `ratio_kind`)

## Architecture decisions

D1 (parse in `render()`), D2 (inches→points ×72, `!`=filled), D3 (no
ratio-aspect layout; derive `filled` only), D4 (SVG coords full-size; group
carries zoom), D5 (no-op when `size` absent). See [decisions.md](../decisions.md).

## Interface contracts

Produces `job.zoom: number` (= `Z`, default `1.0`) on `RenderJob`, consumed by
`emitSvgTag` and `emitGraphGroupOpen` within this task. If `LayoutParams` lacks
a `filled: boolean` field, add it (`@see types.h:layout_t.filled`); `size:
Point` already exists.

## Acceptance criteria

- Given `rankdir_dot`, `rankdir_dot1`, `rankdir_dot2` (each × `linux.x86`,
  `nshare` = **6 rows**), when surveyed, then all reach **byte-match** (combined
  with T1's empty-span fix).
- Given any graph with **no** `size=`/`ratio=fill`, when rendered, then the SVG
  is **byte-identical** to before (Z=1 no-op) — D5.
- Given `size="6,6"` on a drawing larger than 6in, when rendered, then the root
  `<g>` has `transform="scale(Z …)"` with `Z = min(432/sz.x, 432/sz.y)` and
  `width`/`height`/`viewBox` equal the oracle's to the `deterministic`
  tolerance.
- Given `size="50,50"` on a drawing **smaller** than 50in **without**
  `ratio=fill`, when rendered, then `Z = 1` (no upscaling); given the same with
  `ratio=fill`, then `Z = min(size/sz) > 1` (upscaled). (`emit.c:3380-3383`.)
- Given the new golden `dot-size-scaling`, when the golden suite runs, then it
  passes.

## Verification recipe (canary)

```
GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg \
  ~/git/graphviz/tests/linux.x86/rankdir_dot.gv > /tmp/oracle.svg
npx tsx test/corpus/render-one.ts \
  ~/git/graphviz/tests/linux.x86/rankdir_dot.gv dot > /tmp/port.svg
# compare root <svg> dims, group transform, then full diff
```

If the canary's `scale`/dims match but coordinates still differ, the residual is
a layout-level issue (out of scope) — log it, do not chase.

## Observability

N/A — render-path geometry; no new runtime operations or metrics.

## Rollback

**Reversible** — revert the commit. No persisted state; feature is gated on the
`size`/`ratio` attribute (D5), so reverting restores scale-1 behavior exactly.

## Quality bar

`npx tsc --noEmit --stableTypeOrdering` clean; `npx vitest run` green incl. new
golden; spot-check ≥2 existing byte-match goldens for zero byte change. Commit:
`feat(T2): scale SVG output to size= via init_job_viewport zoom`. Body: explain
the zoom formula and the SVG-coords-stay-full-size decision (D4); reference
`emit.c:3356`.

## Boundaries

- **Always:** keep `Z=1` a pure no-op for non-`size` inputs (D5); pin rounding
  to instrumented C.
- **Ask first:** if reaching byte-match appears to require setting `ratioKind`
  for layout (it should not — D3) or changing node/edge coordinates (D4).
- **Never:** activate `aspectFillScale`/`Expand`/`Value` layout reshaping; scale
  inner SVG coordinates; alter the raster ptf path.
