# Batch 1 — Geometry core (sequential)

Pure, unit-testable port of `arrows.c` geometry. No layout/render wiring yet
(Batch 2). Sequential because T2 and T3 both write `arrows-shapes.ts`.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|------------|------|
| T1 | Arrow types + name→ARR_TYPE resolution + length factors + draw-op union | `src/common/arrows-types.ts` (new), `src/common/arrows.ts`, `src/common/arrows-constants.ts` (+ tests) | — | [x] |
| T2 | Length functions + dispatch skeleton + closed shapes (normal, dot, box, diamond) | `src/common/arrows-shapes.ts` (new) (+ test) | T1 | [x] |
| T3 | Remaining shapes (crow/vee, tee, curve, gap) + open/side modifiers + compound stacking + arrowsize | `src/common/arrows-shapes.ts` (+ test; split into `-util`/`-poly`) | T2 | [x] |

## Shared methodology

- **The C is the spec.** Read `~/git/graphviz/lib/common/arrows.c` for each
  function; cite the exact line in a JSDoc `@see`. Preserve every branch and the
  order of operations. Do not simplify the overlap/length math.
- **Oracle-pin the numbers.** Unit tests assert geometry against values dumped
  from native `dot` for a minimal graph using that arrow type (e.g.
  `digraph{a->b[arrowhead=dot]}` → read the `<ellipse>`/`<polygon>` from
  `dot -Tsvg`). Pin at least the byte-rounded coordinates the SVG would emit.
- Geometry is in graphviz (y-up) space; the SVG y-flip happens later in render.
- `parseArrow` (in `arrows.ts`) already returns `ArrowComponent[]`; reuse it.

## Key C references

- `Arrowtypes[]` dispatch table — arrows.c:146-154 (type code, lenfact, gen fn,
  length fn).
- `arrow_length(edge_t*, flag)` — arrows.c:253 (sums component lengths for clip).
- `arrow_length_generic` — arrows.c:1182 (`lenfact*arrowsize*ARROW_LENGTH`).
- `arrow_length_normal` — arrows.c:1190 (overlap math; calls `arrow_type_normal0`).
- shapes: normal0 :516, normal :613, crow0 :632, crow :774, gap :791, tee :808,
  box :868, diamond0 :926, diamond :968, dot :987, curve :1031.
- emit primitives: `gvrender_polygon` (filled = `!(flag & ARR_MOD_OPEN)`) :623-627,
  :782-786, :857; `gvrender_polyline` :803, :860; dot uses `gvrender_ellipse`.

## Gate after batch
`npm run typecheck && npm test && npm run build` exit 0; `git diff --name-only`
lists only the Batch-1 write-set + new test files.
