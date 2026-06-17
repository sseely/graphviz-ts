# T6 — Delete the simplified fitter

## Context

After T2–T5, every regular-edge category routes through the faithful pathplan
path. The simplified fitter is dead code. Remove it (AD-4) so the faithful path
is the sole regular-edge router — no non-faithful shortcut remains.

## Task

1. Grep for all callers of `computeSpline`, `computeSplineMulti`,
   `buildRankCorridor`, `straightEdgeSplineWithRank`, `straightEdgeSpline`,
   `routeWithRank`, `routeSimple`, `clipToNodes`, `polyEdgesFromPts` — confirm
   none remain in the live path (only each other / tests). "Looks unused" is not
   "is unused": verify with grep before deleting each.
2. Delete the dead functions and their now-orphaned helpers across
   `edge-route-poly.ts`, `edge-route-routing.ts`, `edge-route-helpers.ts`, and
   remove the `make_regular_edge` stub + `buildRankCorridor`/`computeSpline`
   calls in `splines-route.ts`.
3. Remove the now-dead fitter branches in `edge-route.ts` / `edge-route-chain.ts`
   (the `else` fallbacks the faithful path replaced).
4. Delete or update any tests that asserted the fitter's (non-faithful) output.
5. Full gate: `tsc` 0, lizard clean, `npx vitest run` 0 failed / passed >=
   baseline, **115 goldens byte-identical**, all new oracle pins green.

## Write-set

- `src/layout/dot/edge-route-poly.ts` — delete `computeSpline`/`computeSplineMulti` (+ dead helpers)
- `src/layout/dot/edge-route-routing.ts` — delete `buildRankCorridor` (+ dead helpers)
- `src/layout/dot/edge-route-helpers.ts` — delete `straightEdgeSplineWithRank`/`routeBezier` if dead
- `src/layout/dot/edge-route.ts` — remove fitter branches + dead imports
- `src/layout/dot/edge-route-chain.ts` — remove `computeSplineMulti` usage
- `src/layout/dot/splines-route.ts` — remove the stub + fitter calls
- (tests) delete fitter-specific tests if any

## Read-set

- `decisions.md#ad-4`
- grep output for each symbol above (the authoritative caller list)

## Acceptance criteria

- **Given** the codebase, **when** grepping for the fitter symbols, **then** no
  live (non-test) references remain.
- **Given** the full suite, **then** 0 failed, passed >= baseline, 115 goldens
  byte-identical, all DOT-1 oracle pins green.
- **Given** `tsc --noEmit`, **then** exit 0 (no unused-import / dead-export errors).

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green per gates. Update
`plans/layout-engine-backlog/gaps/dot.md` (DOT-1 → DONE) and the priority table.
Commit: `refactor(T6): delete the simplified edge fitter`.

## Observability / Rollback

N/A — pure layout. Reversible (revert). This is the final task; merge the mission
branch to main with a **merge commit** after the full gate passes.
