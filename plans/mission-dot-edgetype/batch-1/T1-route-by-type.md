# T1 — `routeRegularByType(P, et)` helper

## Context

graphviz-ts is a faithful TS port of Graphviz (C at `~/git/graphviz`, tag
15.0.0 = spec). This task creates the shared dispatch that lets regular-edge
routers emit lines/polylines instead of always splines. Pure function — no
wiring yet (T2 wires it).

## Task

Create `src/layout/dot/splines-route-type.ts` exporting:

```ts
export function routeRegularByType(P: Path, et: number): Point[] | null
```

Faithful to `dotsplines.c:1799-1808` (and the identical block at 1849-1861):
- `et === EDGETYPE_SPLINE` → `routeSplines(P)`
- else → `routePolylines(P)`, and if `et === EDGETYPE_LINE` and the result has
  `> 4` points, straighten to a 4-point line:
  `ps[1]=ps[0]; ps[2]=ps[3]=ps[pn-1]; pn=4` (collapse to first/last endpoints).
- Returns `null`/empty exactly as `routeSplines`/`routePolylines` do (the
  caller treats null as a decline / pn==0 early-return).

Import `routeSplines`, `routePolylines` from `../../common/splines-routespl.js`
and the `EDGETYPE_*` constants from `./splines.js`.

## Write-set

- CREATE `src/layout/dot/splines-route-type.ts`
- CREATE `src/layout/dot/splines-route-type.test.ts`

## Read-set

- `src/common/splines-routespl.ts:342-430` (routeSplines / routePolylines)
- `src/layout/dot/splines.ts:51-79` (EDGETYPE_* constants)
- `~/git/graphviz/lib/dotgen/dotsplines.c:1799-1861` (the C dispatch + straighten)

## Architecture decisions

- AD-1: this module is the single home for the straighten logic.

## Interface contract (consumed by T2)

`routeRegularByType(P: Path, et: number): Point[] | null` — same return
contract as `routeSplines(P)` (the value T2's call sites currently `return`).

## Acceptance criteria (Given/When/Then)

- Given `et = EDGETYPE_SPLINE`, when called, then result is identical to
  `routeSplines(P)` (delegates, no straighten).
- Given `et = EDGETYPE_PLINE`, when called, then result equals
  `routePolylines(P)` unchanged.
- Given `et = EDGETYPE_LINE` and a `routePolylines` result with > 4 points,
  when called, then result is exactly 4 points: `[p0, p0, pLast, pLast]`.
- Given `et = EDGETYPE_LINE` and a `routePolylines` result with ≤ 4 points,
  when called, then result is returned unchanged (no straighten).
- Given a `Path` that routes to 0 points, when called, then the null/empty
  contract matches `routeSplines`.

## Observability

N/A — no new observable operations (pure layout function).

## Rollback

Reversible — new file; delete to revert.

## Quality bar

`npx tsc --noEmit` 0; `npx vitest run` 0 failed + 115 goldens conformant;
`npx lizard src/layout/dot/splines-route-type.ts -C 10 -L 30 -a 5` clean.
Commit: `feat(T1): add routeRegularByType edge-type dispatch helper`.
