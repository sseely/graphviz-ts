# T4 — Type-aware clip length

## Context
The spline is clipped back by the arrow length so the arrow sits at the tip
(`arrowEndClip`/`tailArrowEndClip` in `edge-route-clip.ts`). It currently uses a
fixed `ARROW_LENGTH=10` (normal only). C uses `arrow_length(e, flag)` — the sum of
per-type component lengths (arrows.c:253). For dot/crow/etc. the length differs,
so the clip endpoint (coordinates) differs. Fix the clip to use `arrowLength`.

## Task
1. In `edge-route-clip.ts`, compute the clip length from the edge's arrow string
   via `parseArrow` → `resolveArrowType[]` → `arrowLength(comps, arrowsize, pw)`
   (T1/T2), for both head (`arrowhead`) and tail (`arrowtail`). Default `arrowsize`
   = 1.0; default arrowhead/arrowtail = `normal`; `none` → no arrow (length 0,
   existing eflag/sflag logic).
2. Preserve all existing back-off / short-segment handling — only the length value
   changes, not the clip algorithm.

## Write-set
- `src/layout/dot/edge-route-clip.ts` (modify) + its test (add type-length cases)

## Read-set
- `src/common/arrows.ts` (parseArrow, resolveArrowType), `arrows-shapes.ts`
  (arrowLength) — Batch 1
- `~/git/graphviz/lib/common/arrows.c:253` (arrow_length)
- `src/layout/dot/compound.ts:66-82` (arrowEndClipIdx callers — keep compatible)
- decisions.md#adr-4

## Interface outputs
Clip endpoints now reflect per-type length (consumed implicitly by T5's geometry
which uses the same tip).

## Acceptance criteria
- Given `arrowhead=normal arrowsize=1`, when clipped, then the endpoint is
  unchanged from today (length 10) — normal must not move (golden suite stays
  green).
- Given `arrowhead=dot`, then the clip length = 0.8×10 = 8 (lenfact), endpoint
  matches native `dot` for `digraph{a->b[arrowhead=dot]}`.
- Given `arrowhead=none`, then no clip-back (length 0), as today.

## Observability / Rollback
N/A. Reversible. **ADR-4 risk**: this changes coordinates for non-normal-arrow
edges — run the golden suite immediately after; STOP if a normal-arrow golden moved.

## Quality bar
`npm run typecheck && npm test` green. One commit: `fix(layout): clip splines by
per-type arrow length (T4)`.

## Boundaries
- Change only the length value source. Do NOT alter the clip back-off algorithm or
  eflag/sflag semantics.
