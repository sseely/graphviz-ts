<!-- SPDX-License-Identifier: EPL-2.0 -->

# T1 — Gradient fill in the HTML-table emit path

## Context

`graphviz-ts` is a faithful TypeScript port of Graphviz; the C source at
`~/git/graphviz` is the spec. This task makes HTML-like label **tables** emit
gradient `bgcolor` fills. Today the port emits a solid first-stop color for a
gradient bgcolor (`bgcolor="yellow:violet"` → `fill="yellow"`) and omits the
`<defs>`/`<linearGradient>`/`<radialGradient>`. Graph/cluster/node gradients are
already byte-exact — only the HTML-table path drops the gradient.

Strict TS, no `any`, no Node-only APIs, EPL-2.0 header on any new file. Tests
are vitest, co-located (`*.test.ts`). TDD: write the failing test first.

## Task

Route gradient `bgcolor` specs through the existing gradient machinery so the
table and each cell emit a gradient fill matching the oracle.

1. **`src/common/htmltable-emit-fill.ts`**
   - Extend `HtmlPaint` with optional gradient fields. Suggested shape (final
     names are a push-forward decision — keep them minimal and documented):
     `gradientAngle?: number`, `radial?: boolean`, and the second/stop color
     (e.g. `stop?: string`). Solid-only callers omit them → unchanged behavior.
   - In `withHtmlPaint`, when a gradient is requested (stop color present), set
     on `paintObj`: `fill = radial ? FillType.Radial : FillType.Linear`,
     `fillColor = resolveRenderColor(paint.fill)`,
     `stopColor = resolveRenderColor(stop)`, `gradientAngle = gradientAngle ?? 0`,
     `gradientFrac` = the frac from the spec (see `parseGradientSpec` /
     C `findStopColor`; for the `c0:c1` form with no explicit frac this is 0).
     Mirror `applyGradientFields` in `poly-gencode.ts:251-261`.
   - Keep the solid branch exactly as-is for non-gradient paint.

2. **`src/common/htmltable-emit.ts`** (`emitBgFill`, `BgFillCtx`)
   - Stop collapsing the gradient. Lines 97-100 currently do
     `const solid = spec ? spec[0] : bgcolor; withHtmlPaint({ fill: solid }, …)`.
     Instead: when `parseGradientSpec(bgcolor)` returns a pair, call
     `withHtmlPaint` with `fill = spec[0]`, `stop = spec[1]`,
     `gradientAngle = <angle>`, `radial = <style includes 'radial'>`.
   - Thread `gradientangle` and `style` into `BgFillCtx` and pass them from both
     call sites: the cell site (`htmltable-emit.ts:147-148`, `cell.gradientangle`,
     `cell.style`) and the table site (`:279-280`, `placed.gradientangle`,
     `placed.style`). These fields already exist on the data types
     (`htmltable-types.ts`).
   - Radial detection: `style` string includes `"radial"` (consistent with how
     `penTypeOf` checks `"dashed"`/`"dotted"` in the same module). See D2.

3. **Tests** (`htmltable-emit.test.ts`, `htmltable-emit-fill.test.ts`)
   - `withHtmlPaint` with a linear gradient paint sets `obj.fill = Linear`,
     `obj.stopColor`, `obj.gradientAngle`, `obj.gradientFrac` (assert each).
   - `withHtmlPaint` with `radial: true` sets `obj.fill = Radial`.
   - `emitBgFill` with `bgcolor="yellow:violet"` drives a gradient (assert the
     renderer receives a gradient fill / a gradient `<defs>` is emitted), not a
     solid `fill="yellow"`.
   - `emitBgFill` with a single-color bgcolor still emits solid (regression).
   - Honor `gradientangle` passthrough (e.g. 315 from grdfillcolor).

## Write-set

- `src/common/htmltable-emit-fill.ts` (modify)
- `src/common/htmltable-emit.ts` (modify)
- `src/common/htmltable-emit.test.ts` (modify)
- `src/common/htmltable-emit-fill.test.ts` (modify — create if absent, with
  EPL-2.0 header)

Do NOT modify `src/render/svg-gradient.ts`, `svg-helpers.ts`, or
`poly-gencode.ts` — the renderer already emits gradient defs from the obj fields.
If you believe one needs changing, STOP and log to the decision journal (this
contradicts the mission premise).

## Read-set

- `src/common/htmltable-emit-fill.ts` (whole — small; `parseGradientSpec:38`,
  `withHtmlPaint:110`, `HtmlPaint:88`)
- `src/common/htmltable-emit.ts:84-160`, `:270-285` (`emitBgFill` + call sites)
- `src/common/poly-gencode.ts:240-261` (`applyGradientFields` — the model)
- `src/render/svg-gradient.ts:97-165` (`emitStop`, `emitLinearGradient`,
  `emitRadialGradient`, `gradientId` — the consumer; read-only)
- `src/common/htmltable-types.ts:135-220` (`gradientangle`, `style`, `bgcolor`)
- C spec: `~/git/graphviz/lib/common/htmltable.c:347-365` (`setFill`),
  `:540-550` (`emit_html_tbl` setFill call), `:640-650` (`emit_html_cell`);
  `findStopColor` in `~/git/graphviz/lib/common/emit.c`.

## Architecture decisions (locked — see decisions.md)

- D1: gradient resolution lives in `withHtmlPaint`, not `emitBgFill`.
- D2: radial via `style` substring `"radial"`.
- D3: missing second stop → `parseGradientSpec` default (`'black'` =
  `DEFAULT_COLOR`); do not special-case.

## Interface contract (consumed by T2)

After this task, rendering any `graphs-grd{fillcolor,linear,linear_angle,radial,
radial_angle}` corpus input via `test/corpus/render-one.ts <input> dot` emits one
`<linearGradient>` or `<radialGradient>` per gradient table/cell bgcolor, with
`id` of the form `l_N`/`r_N` continuing the per-graph counter after the
structural gradients, and `fill="url(#l_N)"` on the corresponding polygon.

## Acceptance criteria

- Given `withHtmlPaint({ fill:'yellow', stop:'violet', gradientAngle:315 })`,
  when the draw fn runs, then `obj.fill === FillType.Linear`,
  `obj.gradientAngle === 315`, `obj.stopColor` resolves to violet.
- Given `withHtmlPaint({ …, radial:true })`, then `obj.fill === FillType.Radial`.
- Given `emitBgFill` with `bgcolor="yellow:violet"`, when emitted, then a
  gradient fill is produced (not solid `fill="yellow"`).
- Given `emitBgFill` with `bgcolor="yellow"` (single color), then solid fill is
  produced unchanged.
- `npm run typecheck` exits 0; `npx vitest run` exits 0 (no regressions).

## Observability

N/A — no new observable runtime operations (pure render emission).

## Rollback

Reversible — revert the commit; output reverts to solid table fills.

## Quality bar

`npm run typecheck` and `npx vitest run` both exit 0 before finishing. No `any`.
Cap the CCN/length per repo hooks (file ≤500 lines, CCN ≤10, params ≤5 — group
extra params into the existing `BgFillCtx`/`HtmlPaint` descriptors). Return only
a short summary of what changed.

## Commit

`feat(htmltable): emit gradient bgcolor fills for tables and cells`
Body: note the C `setFill` origin and that node/cluster gradients were already
correct.
