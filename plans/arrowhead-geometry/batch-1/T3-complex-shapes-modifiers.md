# T3 — crow/vee, tee, curve, gap + modifiers + compound stacking + arrowsize

## Context
Finish the dispatch: the remaining shape generators (incl. the G2 crow/vee 9-pt
polygon), the open/side modifiers, compound stacking (up to 4 components), and
the `arrowsize` scale. After T3, `arrowDrawOps(...)` handles any arrow string.

## Task
In `src/common/arrows-shapes.ts`:
1. Shape generators → `ArrowDrawOp[]`:
   - `arrow_type_crow0` (:632) → 8-pt polygon (closed to 9 by the emitter); used
     for crow AND vee (vee = crow|INV). This is the G2 target.
   - `arrow_type_tee` (:808) → polygon(4) + polyline(2) per :857-860.
   - `arrow_type_curve` (:1031) → the curve arms (polyline/bezier approximation as
     C emits; follow the gvrender calls exactly).
   - `arrow_type_gap` (:791) → polyline(2) (no fill).
2. **Side modifiers** (`left`/`right`): C zeroes one half of the arrow width
   (`arrowwidth` side handling). Apply per the C in each generator (or a shared
   helper) — only the requested half is drawn.
3. **Open modifier**: already handled via `filled = !open` in polygon ops; ensure
   dot/box/diamond/normal honor it.
4. **Compound stacking**: `arrowDrawOps(comps, tip, dir, arrowsize, penwidth)` —
   walk components, drawing each at the running offset (advance tip by each
   component's `arrowLengthOne` along `dir`), accumulating all ops. Up to 4
   components (C caps at 4). This replaces `dispatchSimple` as the public entry.
5. **arrowsize**: thread the `arrowsize` factor (default 1.0) through length +
   shape (it scales `ARROW_LENGTH` and widths per the C signatures).

## Write-set
- `src/common/arrows-shapes.ts` (modify) + `src/common/arrows-shapes.test.ts`

## Read-set
- T2 `arrows-shapes.ts` (dispatchSimple, arrowLengthOne)
- `~/git/graphviz/lib/common/arrows.c`: :632, :774, :791, :808, :1031, plus the
  side-modifier width handling and the compound loop in `arrow_gen`/`arrow_gencode`
- decisions.md#adr-3

## Interface outputs (consumed by T4/T5)
`arrowDrawOps(comps: ResolvedArrow[], tip: Point, dir: Point, arrowsize:number,
penwidth:number) → ArrowDrawOp[]` — the single public dispatch.

## Acceptance criteria
- Given `arrowhead=crow` (and `=vee`), when `arrowDrawOps`, then a polygon op with
  8 distinct points matching native `dot -Tsvg` (the 9-pt closed `points=` for
  144_no_ortho / 2490, byte-rounded).
- Given `arrowhead=crowdot`, then two ops (crow polygon then dot ellipse), the dot
  offset along the shaft by the crow length.
- Given `arrowhead=lnormal` (left side), then the polygon has the right half
  collapsed to the shaft axis, matching the oracle.
- Given `arrowsize=2 arrowhead=normal`, then the polygon is 2× the size-1 polygon.

## Observability / Rollback
N/A — pure functions. Reversible.

## Quality bar
`npm run typecheck && npm test` green. One commit: `feat(arrows): crow/vee/tee/
curve/gap + modifiers + compound stacking (T3)`.

## Boundaries
- Pure geometry only. Keep CCN ≤10 / file <500 lines (split per-type helpers into
  a sibling file if needed, e.g. `arrows-shapes-poly.ts`). Do NOT wire into
  rendering (Batch 2).
