# T1 — ellipse-wedge arc tessellation

## Context
graphviz-ts is a faithful TypeScript port of graphviz `dot`. This task ports the
elliptic-wedge bezier tessellation that the ortho rounded-corner emit (T3) uses
to build each corner arc. Pure geometry — deterministic, no I/O, no graph access.

## Task
Port `lib/common/ellipse.c` to `src/common/ellipse-wedge.ts`:
- `ellipticWedge(ctr, xsemi, ysemi, angle0, angle1)` → `initEllipse` + `genEllipticPath`.
- Return the wedge as an ordered list of bezier control points `Point[]` (the C
  `Ppolyline_t.ps` / `pn`). The path is: `moveTo(center)`, `lineTo(arc-start)`,
  then `n` × `curveTo(c1,c2,end)` around the arc, then the implicit close.
- Reproduce the `dEta`/`alpha` math exactly: `alpha = sin(dEta)*(sqrt(4+3*t*t)-1)/3`
  where `t = tan(0.5*dEta)`; `n` segments from `initEllipse`'s angle span.

For this mission `xsemi == ysemi == radius` (circular arc), but port the general
elliptic form faithfully (ADR-4).

## Read-set
- `~/git/graphviz/lib/common/ellipse.c:1-280` (initEllipse, genEllipticPath,
  ellipticWedge, the bezier_path moveTo/lineTo/curveTo/endPath helpers).
- `src/model/geom.ts` — the `Point` type.
- `decisions.md#adr-1` — the arc is later sliced `[3 .. pn-4]` and emitted as a
  polyline; T1 just returns ALL control points in C order.

## Write-set
- `src/common/ellipse-wedge.ts` (create)
- `src/common/ellipse-wedge.test.ts` (create)

## Interface contract (consumed by T3)
```ts
// Returns the wedge bezier control points in C Ppolyline_t.ps order (center
// first, then arc), length === C pn.
export function ellipticWedge(
  ctr: Point, xsemi: number, ysemi: number, angle0: number, angle1: number,
): Point[];
```

## Acceptance criteria (Given/When/Then)
- Given `ctr=(35,-26)`, `xsemi=ysemi=8`, the quarter-arc angles for graphs-radius
  edge1's corner, When `ellipticWedge` runs, Then the returned control-point
  count and coordinates match the C oracle for that wedge (pin via a
  GV_XDUMP-style C dump of `ellipticWedge` output, or by deriving from the known
  native arc polyline `27,-26 … 35,-18`).
- Given any `angle0 < angle1`, When tessellated, Then the first point is the
  center `ctr` and the second is the arc start on the ellipse (matches C
  moveTo/lineTo order).
- Given a full elliptic case `xsemi≠ysemi`, When run, Then it does not throw and
  the segment count matches `initEllipse`'s `n`.

## Quality bar
`npm run typecheck` clean; `npm test` (the new test + full suite) green. Return
only the module + test — match the file's surrounding style.

## Observability / Rollback
N/A — pure function, no observable operation. Reversible (git revert).
