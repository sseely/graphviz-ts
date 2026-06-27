# T3 — segment + arc emit

## Context
The emit half of the rounded-ortho path (`emit.c:2583-2662`). Given the spline
points + the corners from T2 + the wedge from T1, produce the ordered list of
`<polyline>` point-arrays that native emits: straight segments between truncated
corners, then one arc polyline per corner.

## Task
Add to `src/render/svg-edge-ortho-radius.ts` (split a `-arc.ts` helper if the
file nears 500 lines — ADR-3):
- `drawOrthoCornerMarkers(corners, radius)` → for each corner, call
  `ellipticWedge(wedgeCenter, radius, radius, angle1, angle2)` (T1), slice
  `[arc_start_idx=3 .. arc_end_idx=pn-4]` (skip center + first/last arc point +
  duplicates), require `arc_point_count>=2`, return the arc polyline points.
- The segment loop (`emit.c:2593-2654`): walk corners in index order; emit a
  straight polyline from `seg_start_pt` through interior non-corner points to
  `seg_end_pt = corner.truncPrev`; next segment starts at `corner.truncNext`;
  skip points within `CORNER_TOL=0.01` of any corner.
- Top-level `orthoRoundedPolylines(pts, radius): Point[][]` returning every
  polyline (segments + arcs) in C emit order (all segments first, then all arcs —
  matching `emit.c` which renders segments in the loop then arcs after).

## Read-set
- `~/git/graphviz/lib/common/emit.c:2583-2662` (segment loop +
  draw_ortho_corner_markers) and `:2300-2330` (render_corner_arc slice indices).
- `T1` `ellipticWedge`, `T2` `findOrthoCorners`/`CornerInfo`.
- `decisions.md#adr-1` (arc = polyline of control points).

## Write-set
- `src/render/svg-edge-ortho-radius.ts` (modify — add emit exports)
- `src/render/svg-edge-ortho-radius-arc.ts` (create, only if split needed)
- `src/render/svg-edge-ortho-radius.test.ts` (modify)

## Interface contract (consumed by T4)
```ts
// All polylines (straight segments then corner arcs) in native emit order;
// each inner array is one <polyline>'s points. Empty array ⇒ no corners ⇒
// caller falls back to the bezier path.
export function orthoRoundedPolylines(pts: Point[], radius: number): Point[][];
```

## Acceptance criteria (Given/When/Then)
- Given graphs-radius edge1 spline + `radius=8`, When `orthoRoundedPolylines`
  runs, Then it returns exactly 3 polylines whose points byte-match the three
  native `<polyline>` point lists (vertical seg, horizontal seg, arc) —
  coordinate-for-coordinate.
- Given an ortho spline with NO orthogonal corner, When run, Then it returns `[]`
  (caller uses bezier fallback).
- Given the arc polyline, When emitted, Then it has the same point count as
  native's (`pn-4-3+1` of the wedge) and starts/ends at the truncation points'
  neighbourhood.

## Quality bar
`npm run typecheck` clean; `npm test` green. Polyline points pinned to the native
edge1 `<polyline>` lists (ground truth).

## Observability / Rollback
N/A. Reversible.
