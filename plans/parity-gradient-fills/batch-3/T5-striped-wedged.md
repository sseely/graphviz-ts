# T5 — striped + wedged multicolor fills

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C at
`~/git/graphviz/lib` (tag 15.0.0) is the spec. Vitest, strict TS,
JSDoc @see per ported block. Suite baseline 1466/0, 82+ goldens
(post-batch-2). Hook rule: smallest fix, ≤2 attempts per file,
then move on. Hook limits: 30 lines/function, CCN 10, 5 params,
500 lines/file.

`style=striped` (boxes) and `style=wedged` (ellipses) are multicolor
fills that partition the shape into colored segments — they do NOT use
`<linearGradient>`. Instead:
- `stripedBox` (emit.c:595): divides the bounding box into vertical
  colored stripes (one polygon per color) by iterating the parsed
  color-segment list.
- `wedgedEllipse` (emit.c:549): divides the ellipse into wedge
  segments (one bezier path per color) using `ellipticWedge`.

Both use C's `parseSegs` color-list parser and iterate the result.
Both require `style=striped` or `style=wedged` flag from the resolved
style (parity-render-styling T1's `parseStyleFlags`).

**Note on scope:** `wedgedEllipse` requires porting `ellipticWedge`
(computes bezier approximation of an elliptic arc), which involves
significant geometry (see emit.c around :500-548). If this geometry
is too large for a single task (> 500-line file limit), split: create
`src/common/elliptic-wedge.ts` for the pure geometry, then call it
from the striped/wedged emitter. Flag in decision journal if a split
is needed.

## Task

1. **`src/render/svg-striped.ts`** (new file) — port:
   - `stripedBox(pts: Point[], colorList: string, job: RenderJob): void`
     Iterates parsed segments, emits one filled polygon per stripe.
     Emits thin `stroke-width` (THIN_LINE constant from C). Does not
     emit a gradient. Calls `renderer.polygon(pts, true, job)` with
     a per-stripe `withHtmlPaint`-style scoped fill.
     (@see lib/common/emit.c:stripedBox :595)
   - `wedgedEllipse(center, rx, ry, colorList: string, job: RenderJob): void`
     Iterates parsed segments, emits one `<path>` bezier arc per wedge.
     Requires porting `ellipticWedge` geometry (bezier approximation).
     (@see lib/common/emit.c:wedgedEllipse :549)
   - `parseColorSegs(colorList: string): Array<{color: string; t: number}>`
     Pure function: port of `parseSegs` for the SVG context. (C uses
     a linked-list `colorsegs_t`; TS returns a plain array.)
     (@see lib/common/emit.c — `parseSegs` is internal; locate its
     definition near emit.c:4300+)

2. **Integrate into the node shape dispatch** — in
   `src/common/style-resolve.ts` (or the caller that sets
   `FillType`), when `flags.striped = true` set a new
   `FillType.Striped` value (or handle via the existing shape-dispatch
   path that calls `stripedBox`/`wedgedEllipse` directly).
   Look at how parity-render-styling T3 wired node shape dispatch to
   see where to hook in.

3. **Tests**: `style=striped fillcolor="red:blue:green"` on a box →
   SVG has 3 `<polygon>` elements with fills red, blue, green.
   `style=wedged fillcolor="red:blue"` on an ellipse → SVG has
   2 `<path>` bezier wedges.

## Write-set (strict — nothing else)

- `src/render/svg-striped.ts` (new)
- `src/render/svg-striped.test.ts` (new)
- `src/common/style-resolve.ts` (add striped/wedged dispatch trigger)

## Read-set

- `~/git/graphviz/lib/common/emit.c` — `stripedBox` (:595),
  `wedgedEllipse` (:549), `parseSegs` (locate near :4300)
- `~/git/graphviz/lib/common/geom.c` or `geomprocs.h` —
  `ellipticWedge` (search for its definition)
- `src/common/style-resolve.ts` — extend it
- `src/render/svg-helpers.ts` — `svgPolygon`, `svgBezier` patterns
- `src/gvc/job.ts`, `src/gvc/context.ts` — types

## Architecture decisions (locked)

Striped/wedged are NOT gradient fills — they do not use `<defs>` or
`url(#id)`. They emit N solid-fill shapes. No counter interaction with
`gradId`/`rgradId`. The `thin_line` penwidth (C's THIN_LINE = 0.5)
must match C exactly for stroke-width on stripe boundaries.

## Acceptance criteria (verified against `dot -Tsvg`)

```
Given: digraph G { a [shape=box style=striped fillcolor="red:blue:green"] }
When: port renders
Then: SVG contains exactly 3 polygon elements with fill red, blue, green
      (equal widths); thin stroke-width="0.5" on each (match C output)

Given: digraph G { a [shape=ellipse style=wedged fillcolor="red:blue:green"] }
When: port renders
Then: SVG contains 3 <path> elements with fills red, blue, green and
      a final <ellipse fill="none"> outline
```

## Quality bar

`npx tsc --noEmit` clean; `npx vitest run` 0 failed, passed ≥ 1466;
82+ existing goldens conformant.
Commit: `feat(T5): port stripedBox + wedgedEllipse multicolor fills`.
