# T5 — Typed draw-op storage + layout-site dispatch

## Context
The 4 layout sites compute a fixed normal triangle (`arrowheadPolygon`) and store
`_arrowPts`/`_tailArrowPts: Point[]`. Replace with the type dispatch
(`arrowDrawOps`, T3) storing the typed `ArrowDrawOp[]` (ADR-1) on a typed
`edgeInfo` field. This is the field-rename migration.

## Task
1. `src/model/edgeInfo.ts`: add typed fields `headArrowOps?: ArrowDrawOp[]` and
   `tailArrowOps?: ArrowDrawOp[]` (import `ArrowDrawOp`). Remove the loose
   `_arrowPts`/`_tailArrowPts` usage (or alias during migration, then drop).
2. `src/layout/dot/edge-route-arrow.ts`: replace the `arrowheadPolygon` stub with
   `arrowDrawOpsForEnd(e, end:'head'|'tail', tip, dir, pw)` that reads
   `arrowhead`/`arrowtail` + `arrowsize` from the edge, resolves via parseArrow +
   resolveArrowType, and calls `arrowDrawOps`. Keep `arrowheadPolygon` only if
   still needed for a normal fallback; otherwise remove (grep first).
3. Update the 4 call sites to store `headArrowOps`/`tailArrowOps`:
   `edge-route-chain.ts:315,322`, `edge-route.ts:369`, `compound.ts:244-245`.
4. Update readers: `splines-flat.ts:206-213` (reads `_arrowPts`/`_tailArrowPts`).

## Write-set
- `src/model/edgeInfo.ts`, `src/layout/dot/edge-route-arrow.ts`,
  `src/layout/dot/edge-route-chain.ts`, `src/layout/dot/edge-route.ts`,
  `src/layout/dot/compound.ts`, `src/layout/dot/splines-flat.ts`

## Read-set
- `src/common/arrows-shapes.ts` (arrowDrawOps), `arrows.ts` (parse/resolve) — B1
- `src/model/edgeInfo.ts` (current arrow fields)
- The 4 call sites listed above + `splines-flat.ts:206-213`
- decisions.md#adr-1, #adr-2

## Interface outputs (consumed by T6)
`e.info.headArrowOps?: ArrowDrawOp[]`, `e.info.tailArrowOps?: ArrowDrawOp[]`.

## Acceptance criteria
- Given `a->b` (default normal), then `headArrowOps` is one filled 3-pt polygon
  (unchanged rendering vs today).
- Given `a->b[arrowhead=dot]`, then `headArrowOps` is one ellipse op.
- Given `a->b[dir=both,arrowtail=crow]`, then `tailArrowOps` is the crow polygon
  and `headArrowOps` the normal triangle.
- Given a grep for `_arrowPts|_tailArrowPts` across `src/`, then no production
  references remain (tests updated in T6).

## Observability / Rollback
N/A. Reversible.

## Quality bar
`npm run typecheck && npm test` green (svg arrow tests may need T6 first; if a
test reads `_arrowPts`, update it in T6's write-set, not here). One commit:
`refactor(layout): store typed arrow draw-ops per edge end (T5)`.

## Boundaries
- Do NOT change `svg-helpers.ts` (T6 owns it). If a layout test directly asserts
  `_arrowPts`, migrate it here (it's in this write-set's spirit) — but svg-side
  tests belong to T6.
