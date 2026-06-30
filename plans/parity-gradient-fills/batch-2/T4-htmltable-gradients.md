# T4 — HTML-table BGCOLOR gradient emission (M12 AD4 unskip)

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see per ported block. Suite baseline 1466/0, 82+ goldens
(post-parity-render-styling + batch 1). Hook rule: smallest fix,
≤2 attempts per file, then move on.

M12 stored `GRADIENTANGLE` in the HTML-table parse/store path
(M12 T3 and T4), but deferred gradient paint with a comment citing
"future gradient-fills work" (M12 AD4). This task unskips those sites.

`withHtmlPaint` in `src/common/htmltable-emit-fill.ts` currently
accepts `fill?: string` (solid only). When `BGCOLOR="red:blue"` is
present, `setHtmlFill` or its equivalent calls `parseGradientSpec`,
which already splits the colors — but discards the second color and
passes only `c1` to `withHtmlPaint`. This task extends the path
to emit a gradient.

C reference: HTML-table fill in C is handled by the same `setFill`
mechanism that ultimately calls `gvrender_set_fillcolor` +
`gvrender_set_gradient_vals` on the active obj, then draws with
`GRADIENT` or `RGRADIENT`. The SVG renderer's `svg_polygon` dispatches
to `svg_gradstyle` identically for html table cells as for nodes.
The key difference: HTML-table cells often lack an `obj->id` prefix
(obj->id is for the whole node, not the cell), so gradient ids are
bare `l_<n>` / `r_<n>`.

Verified with `dot -Tsvg`: an HTML-table `BGCOLOR="red:blue"` produces
`<linearGradient id="l_0" gradientUnits="userSpaceOnUse" ...>` with
no node-id prefix (because the painting runs under the HTML emission
context where `obj->id` may differ from the node id — see the observed
output where `id="l_0"` not `id="node1_l_0"`).

## Task

1. **Extend `withHtmlPaint` / `HtmlPaint` interface** in
   `src/common/htmltable-emit-fill.ts`:
   - Add optional `fillGradient?: { stop: string; angle: number; frac: number }`
     field to `HtmlPaint`.
   - When present, `withHtmlPaint` sets `paintObj.fill = FillType.Linear`
     (or `FillType.Radial` if a `GRADIENTANGLE` hint signals radial),
     `paintObj.stopColor`, `paintObj.gradientAngle`, `paintObj.gradientFrac`.

2. **Find and update all M12 gradient-deferral comment sites** — search
   for the M12 AD4 deferral comment pattern (likely "gradient",
   "GRADIENTANGLE", or "linearGradient" TODO comments in
   `htmltable-emit-fill.ts` and any htmltable-emit-*.ts callers).
   Replace the first-color-only path with the extended `HtmlPaint`
   gradient fields.

3. **Verify that `svgPolygon` / `svgBezier`** (which do the actual
   shape drawing for table-cell fills) dispatch to gradient emission
   when `FillType.Linear/Radial` — this was wired in T2; just verify
   the html path reaches the same code path.

4. **Tests**: HTML-table with `BGCOLOR="red:blue" GRADIENTANGLE="45"`
   → SVG contains `<linearGradient id="l_N" ...>`.

## Write-set (strict — nothing else)

- `src/common/htmltable-emit-fill.ts`
- Any htmltable-emit-*.ts file that has M12 AD4 deferral comment
  sites (read to identify; likely 1-2 files; declare in journal
  if more than 2)

## Read-set

- `src/common/htmltable-emit-fill.ts` (primary file to modify)
- All files with M12 AD4 deferral comments (grep for "AD4" or
  "gradient" TODO in src/common/htmltable-*.ts)
- `src/render/svg-gradient.ts` (T1 API for emitting gradient defs)
- `src/gvc/context.ts` — FillType
- `src/gvc/job.ts` — ObjState gradient fields
- `~/git/graphviz/lib/common/htmltable.c` — `emit_html_cell` / `setFill`
  gradient path (for context on how C handles it)

## Architecture decisions (locked)

AD1 (global counter, reset by T2 at render start), AD2 (inline defs),
AD5 (fill="url(#...)"). Radial for HTML tables follows the same
`style=radial` hint in the GRADIENTANGLE/style attr path.

## Acceptance criteria (verified against `dot -Tsvg`)

```
Given: digraph G { a [label=<<TABLE BGCOLOR="red:blue"><TR><TD>x</TD></TR></TABLE>> shape=none] }
When: port renders
Then: SVG contains <linearGradient id="l_N" gradientUnits="userSpaceOnUse" ...>
      and the table background polygon has fill="url(#l_N)"

Given: same graph with GRADIENTANGLE="45"
When: port renders
Then: linearGradient x1/y1/x2/y2 reflect the 45-degree angle

Given: BGCOLOR with single solid color (no colon)
When: port renders
Then: plain fill="<color>", conformant to pre-task baseline
```

## Quality bar

`npx tsc --noEmit` clean; `npx vitest run` 0 failed, passed ≥ 1466;
82+ existing goldens conformant.
Commit: `feat(T4): html-table BGCOLOR gradient emission (M12 AD4 unskip)`.
