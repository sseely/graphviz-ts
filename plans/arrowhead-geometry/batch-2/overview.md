# Batch 2 — Wire-in (sequential): clip → store → emit

Depends on Batch 1. Wires the geometry core into the live pipeline. Sequential:
T4 changes clip lengths (coordinates), T5 stores typed ops at the layout sites,
T6 emits them. Oracle-check the 16 target cases after T6.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|------------|------|
| T4 | Type-aware clip length + arrowsize in the clip | `src/layout/dot/edge-route-clip.ts` (+ test) | T2 | [x] |
| T5 | Typed draw-op storage; layout sites dispatch by arrow type | `edgeInfo.ts`, `edge-route-arrow.ts`, `edge-route-chain.ts`, `edge-route.ts`, `compound.ts`, `splines-flat.ts` (+ `splines-clip.ts`, `postproc.ts`) | T3, T4 | [x] |
| T6 | SVG emit per draw-op (polygon/ellipse/polyline/bezier) | `src/render/svg-arrow-ops.ts` (new), `svg-helpers.ts`, `svg.ts` | T5 | [x] |

**Note:** T5+T6 were committed together (merge rationale in decision-journal) —
AC4 (no `_arrowPts` refs) requires the readers + per-kind emitter to land as one
green state. Byte-match vs native oracle confirmed for dot/odot/crow/vee/diamond/box.

## Methodology
- After T6, oracle-pin each of the 16 target cases (verify recipe in README).
  Expect dot/odot → byte/structural match, crow/vee → byte/structural match.
- Watch ADR-4 risk: T4 moves endpoints for non-normal arrows. After T4, run the
  golden suite — if a normal-arrow golden moved, the length math is wrong (normal
  must stay length 10 at size 1). After T6, before committing, spot-check a few
  currently byte-matching corpus cases that use arrows (the full survey is T8).
- The 4 layout sites currently call `arrowheadPolygon(tip, dir, pw)`. Replace with
  `arrowDrawOps(resolved, tip, dir, arrowsize, pw)`; read `arrowhead`/`arrowtail`
  + `arrowsize` from the edge (`nodeAttr`-style inheritance via `e.attrs`/defaults).

## Migration note (ADR-1 field rename)
`_arrowPts`/`_tailArrowPts` (Point[]) → `_headArrowOps`/`_tailArrowOps`
(ArrowDrawOp[]). Update ALL readers: `svg-helpers.ts` (svgArrowPolygons),
`splines-flat.ts`, and any test. Grep `_arrowPts|_tailArrowPts` before finishing.

## Gate after batch
`npm run typecheck && npm test && npm run build` exit 0; the 16 target cases no
longer diverge on the arrow primitive; `git diff --name-only` matches the
Batch-2 write-set.
