<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — landscape flag → job.rotation (byte-stable plumbing)

## Context

Faithful TS port of C Graphviz (`~/git/graphviz` is the spec). Browser-safe ESM:
no `fs`/`path`/`process`; **import paths end in `.js`** even for `.ts`. Strict
TS, no `any`. Every file starts `// SPDX-License-Identifier: EPL-2.0`. Ported
symbols carry a JSDoc `@see` to their C origin. Tests are vitest, colocated,
asserting concrete values. Complexity hook: file ≤500 lines, CCN ≤10, ≤5 params
(lizard counts `??` as +2 CCN).

`orientation=land` is **emit-only** (decisions.md ADR-1). This task wires the
landscape flag into `job.rotation` without changing any rendered bytes; T2 emits
the rotation.

## Task

1. In `src/gvc/viewport.ts`, add a parser mirroring `input.c:699-704`:
   ```
   if (rotate attr present)      landscape = atoi(rotate) == 90
   else if (orientation attr)    landscape = orientation[0] in {l, L}
   else if (landscape attr)      landscape = mapbool(landscape)
   ```
   Export e.g. `parseLandscape(g: Graph): boolean`. Read attrs via the graph's
   attr map (same accessor `parseDrawingSize`/the render path already uses).
2. In `src/gvc/device.ts` `render()` (near the existing `initJobViewportZoom` /
   `job.scale` setup, ~line 510), set `job.rotation = parseLandscape(g) ? 90 : 0`
   **before** `renderGraph`/`beginGraph`. @see emit.c:3260/3390.
3. Guard `transformPoint` (device.ts:62) so it does **not** call `applyRotation`.
   Per ADR-2, SVG rotation is the group transform; the ptf rotation branch is
   raster-only. Either remove the `job.rotation !== 0` branch from `transformPoint`
   or make it a no-op with a `// @see ADR-2` comment. `applyRotation` may remain
   exported (dead) — do not delete it without checking references.

## Write-set
- `src/gvc/viewport.ts` — `parseLandscape`
- `src/gvc/device.ts` — set `job.rotation`; neutralize transformPoint rotation
- `src/gvc/device.test.ts` — tests (create if absent; else append)

## Read-set
- `decisions.md` (ADR-1, ADR-2)
- `src/gvc/device.ts:55-95` (transformPoint/applyRotation), `:485-515` (render setup)
- `src/gvc/viewport.ts` (parse pattern), `src/gvc/job.ts:288` (`rotation` field)
- `~/git/graphviz/lib/common/input.c:699-704`, `emit.c:3260,3390`

## Interface contract (consumed by T2)
`job.rotation: number` — `90` for landscape graphs, else `0`; set during
`render()` before the renderer's `beginGraph`.

## Acceptance (Given/When/Then)
- Given `orientation=landscape` (or `=land`), when rendered, then `job.rotation === 90`.
- Given `rotate=90`, then `90`; given `rotate=45`, then `0`.
- Given `landscape=true`, then `90`; given no rotation attr, then `0`.
- Given `job.rotation === 90`, when `transformPoint(p)` runs, then the result is
  the unrotated scale+translate (no `applyRotation`).
- Given any non-landscape corpus graph rendered to SVG, then output bytes are
  identical to before this task (assert against a captured snapshot, or rely on
  the post-batch survey showing 0 changes).

## Observability
N/A — no new observable operations.

## Rollback
Reversible (revert commit; no migration).

## Quality bar
`npm run typecheck` + `npm test` green; lizard clean on changed files. Commit:
`feat(svg): detect landscape orientation into job.rotation` (body explains the
emit-only rationale + ADR-2 transformPoint guard).
