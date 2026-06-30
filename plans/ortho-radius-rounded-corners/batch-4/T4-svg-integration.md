# T4 — svg.ts endEdge integration + golden

## Context
Wire the ortho rounded-corner emit (T3) into the SVG edge renderer. This is the
only task that changes port output. Mirror `emit.c:2553-2666`'s detection +
branch.

## Task
In `src/render/svg.ts` `endEdge`, single-color branch (currently
`svgEdgePath(e, job); svgArrowPolygons(e, job);`):
1. Detect `is_ortho` = graph `splines` attr === `"ortho"` and
   `want_rounded`/`radius`:
   - `radius` attr > 0 ⇒ `want_rounded`, radius = `atof(radius)`;
   - else `style=rounded` ⇒ `want_rounded`, radius = `max(12, penwidth*8)`;
   - exactly as `emit.c:2554-2581`.
2. For each bezier in `e.info.spl.list`: if `is_ortho && want_rounded && radius>0`,
   call `orthoRoundedPolylines(bz.list, radius)` (T3). If non-empty, emit each via
   `svgPolyline`; if empty, fall back to the existing bezier `<path>`.
   Non-ortho / non-rounded edges keep the current `svgEdgePath` path UNCHANGED
   (byte-stable).
3. Arrowheads (`svgArrowPolygons`) unchanged — they emit after the spline as today.

Keep the detection in a small helper if it clarifies `endEdge`. Do NOT touch the
multicolor / split branches.

## Read-set
- `src/render/svg.ts:128-160` (the `endEdge` single-color branch).
- `src/render/svg-edge-split.ts` / `svg-helpers.ts` — how `svgEdgePath` reads
  `e.info.spl` and how `svgPolyline` formats points (match the `<polyline
  points="…">` number formatting / `printdouble`).
- `~/git/graphviz/lib/common/emit.c:2553-2666`.
- `T3` `orthoRoundedPolylines`.

## Write-set
- `src/render/svg.ts` (modify — `endEdge`)
- a golden/colocated test (e.g. `src/render/svg-edge-ortho-radius.golden.test.ts`)
  rendering `digraph{splines=ortho; nodesep=1.0; x->y[radius=8]; z->y;}` and
  asserting edge1 emits `[title, polyline×3, polygon]` conformant with native.

## Acceptance criteria (Given/When/Then)
- Given `x->y[radius=8]` with `splines=ortho`, When rendered, Then edge1's group
  is `<title>` + three `<polyline>` + arrowhead `<polygon>`, conformant with the
  native SVG (the recorded oracle for graphs-radius).
- Given `z->y` (ortho, NO radius) in the same graph, When rendered, Then it is
  unchanged — a single bezier `<path>` (byte-stable vs current output).
- Given any non-ortho edge anywhere in the corpus, When rendered, Then output is
  identical to before this task (the `svgEdgePath` path is untouched).
- Given an ortho+radius edge whose spline has no detected corner, When rendered,
  Then it falls back to the bezier `<path>` (no crash, no empty polyline).

## Quality bar
`npm run typecheck` clean; `npm test` green; the golden test conforms to the
native `graphs/radius.gv` SVG (render with `GVBINDIR=/tmp/ghl`).

## Observability / Rollback
N/A. Reversible — revert this commit restores sharp-corner emit.
