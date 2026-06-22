# T2 — Length functions + dispatch + closed shapes (normal, dot, box, diamond)

## Context
With T1's `ResolvedArrow` + `ArrowDrawOp`, port the length functions and the
"closed shape" generators. These four are the simplest and cover the dot/odot
ellipse (the largest target group, G1). `arrow_type_dot` emits a `gvrender_ellipse`;
normal/box/diamond emit filled/open polygons.

## Task
Create `src/common/arrows-shapes.ts`:
1. `arrowLengthOne(r: ResolvedArrow, arrowsize, penwidth) → number` — port the
   per-type length fns: `arrow_length_generic` (arrows.c:1182), `_normal` (:1190),
   `_dot` (:1308 region), `_box`, `_diamond`. Use the exact overlap math.
2. `arrowLength(comps: ResolvedArrow[], arrowsize, penwidth) → number` — sum over
   components (arrows.c:253 `arrow_length`).
3. Shape generators returning `ArrowDrawOp[]` for ONE component at a given tip+dir:
   - `arrow_type_normal0` (:516) → polygon (3 pts), filled = `!open`; honor INV
     (swap tip/base) and the `delta`/miter correction already in the current
     `arrowheadPolygon` stub.
   - `arrow_type_dot` (:987) → ellipse (center + radius); open=odot (unfilled).
   - `arrow_type_box` (:868) → polygon (4 pts) [+ polyline for open box per :860].
   - `arrow_type_diamond0` (:926) → polygon (4 pts).
4. A `dispatchSimple(r, tip, dir, arrowsize, penwidth) → ArrowDrawOp[]` switch for
   the four implemented types (T3 extends it for the rest).

## Write-set
- `src/common/arrows-shapes.ts` (create) + `src/common/arrows-shapes.test.ts`

## Read-set
- `src/common/arrows-types.ts`, `src/common/arrows.ts` (resolveArrowType) — T1
- `src/layout/dot/edge-route-arrow.ts` (existing normal-triangle delta math to reuse)
- `~/git/graphviz/lib/common/arrows.c`: :516, :868, :926, :987, :1182, :1190, :1308, :253
- decisions.md#adr-1, #adr-2

## Interface outputs (consumed by T3, T4, T5)
`arrowLength(comps, arrowsize, penwidth) → number`;
`dispatchSimple(...)` extended by T3 into the full `arrowDrawOps(...)`.

## Acceptance criteria
- Given `arrowhead=dot` at tip T dir D pw=1 size=1, when `dispatchSimple`, then one
  `ellipse` op whose center+radius match native `dot -Tsvg` `<ellipse>` for
  `digraph{a->b[arrowhead=dot]}` (byte-rounded cx/cy/rx/ry).
- Given `arrowhead=odot`, then the ellipse op has `filled:false`.
- Given `arrowhead=normal`, then a 3-pt polygon matching the current stub output
  (no regression to normal).
- Given `arrowLength` for `[dot]` vs `[normal]`, then dot length = 0.8× normal's
  (lenfact), per `arrow_length_generic`.

## Observability / Rollback
N/A — pure functions. Reversible.

## Quality bar
`npm run typecheck && npm test` green. One commit: `feat(arrows): length fns +
closed-shape generators (dot/box/diamond/normal) (T2)`.

## Boundaries
- Pure geometry only — no layout/render imports (no RenderJob). Keep CCN ≤10 per
  fn and file <500 lines (split helpers if needed). Do NOT wire into rendering.
