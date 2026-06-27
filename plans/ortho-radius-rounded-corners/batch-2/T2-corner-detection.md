# T2 — ortho corner detection + truncation

## Context
Faithful port of the corner-analysis half of `emit.c`'s rounded-ortho path. Given
the edge spline control points (the bezier list on `e.info.spl`), find each
orthogonal corner, compute its truncation points (inset by `radius` along each
incident segment) and its arc wedge parameters. No emit yet (T3).

## Task
Create `src/render/svg-edge-ortho-radius.ts` porting from `emit.c:2130-2330`:
- `find_prev_distinct` / `find_next_distinct` (TOL 0.01).
- `findOrthoCorners(pts, radius)` (TOL 0.1; a corner is horiz→vert or vert→horiz).
- `processCorner` — dedup (DUP_TOL 0.01), normalize the two direction vectors,
  truncation points `trunc_prev = curr − dir1·radius`, `trunc_next = curr + dir2·radius`.
- `calculateWedgeParameters` — the 8 orientation cases → `wedgeCenter`,
  `angle1`, `angle2`.
- `compareCorners` (sort by index).
- A `CornerInfo` type mirroring `corner_info_t` (`idx`, `truncPrev`, `truncNext`,
  `wedgeCenter`, `angle1`, `angle2`).

## Read-set
- `~/git/graphviz/lib/common/emit.c:2130-2249` (the structs + helpers above).
- `decisions.md#adr-4` (port all 8 cases verbatim).
- `src/model/geom.ts` (`Point`).

## Write-set
- `src/render/svg-edge-ortho-radius.ts` (create — corner-analysis exports)
- `src/render/svg-edge-ortho-radius.test.ts` (create)

## Interface contract (consumed by T3)
```ts
export interface CornerInfo {
  idx: number; truncPrev: Point; truncNext: Point;
  wedgeCenter: Point; angle1: number; angle2: number;
}
export function findOrthoCorners(pts: Point[], radius: number): CornerInfo[];
```

## Acceptance criteria (Given/When/Then)
- Given graphs-radius edge1's spline control points and `radius=8`, When
  `findOrthoCorners` runs, Then it returns exactly 1 corner at the (27,-18)
  bend with `truncPrev≈(27,-26)` and `truncNext≈(35,-18)` (matches the native
  polyline segment endpoints).
- Given a corner whose duplicate appears twice in the point list, When detected,
  Then `processCorner` dedups it (DUP_TOL 0.01) — only one `CornerInfo`.
- Given a "right-then-down" corner (`seg1_horiz && dx1>0 && dy2<0`), When
  `calculateWedgeParameters` runs, Then `wedgeCenter=(curr.x−r, curr.y−r)`,
  `angle1=0`, `angle2=π/2` (verbatim case 1).
- Given a degenerate / non-orthogonal bend (diagonal), When scanned, Then it is
  NOT reported as a corner.

## Quality bar
`npm run typecheck` clean; `npm test` green. Corner coords pinned against the C
oracle (the native edge1 polyline endpoints are ground truth).

## Observability / Rollback
N/A. Reversible.
