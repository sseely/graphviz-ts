# T4 — Delete the simplified fitter

## Context

After T1 (adjacent-back faithful) and T3 (parallel/opposing faithful), every
regular-edge path routes through the faithful pathplan path. The simplified
fitter and the T1 `FaithfulForceMode` measurement scaffolding are now dead. Remove
them so the faithful path is the sole regular-edge router (AD-3 gate: delete only
what grep proves unreferenced).

## Task

1. **Grep each symbol first** (authoritative caller list); confirm no live
   (non-test) references remain after T1+T3:
   `computeSpline`, `computeSplineMulti`, `buildRankCorridor`, `clipToNodes`,
   `routeWithRank`, `routeSimple`, `routeEdgeRaw`, `applyEndArrows`,
   `routeFwdMultiRankEdge`, `fitterBackFwdPoints`, `straightEdgeSplineWithRank`,
   `straightEdgeSpline`, `polyEdgesFromPts`, `makeRegularEdge` (stub), `routeBezier`.
   "Looks unused" ≠ "is unused" — verify before each deletion.
2. Delete the dead functions + their now-orphaned helpers across
   `edge-route-poly.ts`, `edge-route-routing.ts`, `edge-route-helpers.ts`,
   `edge-route.ts`, `edge-route-chain.ts`, `splines-route.ts`. KEEP symbols still
   used by the faithful path (`normalArrowLen`, `nodeInsideFn`, `bezierClipNode`,
   `linearBezier` if referenced, `shiftInteriorPts`, `swapEndsP`/`swapSpline`).
3. Remove the T1 measurement scaffolding from `edge-route.ts`
   (`FaithfulForceMode`, `setForceFaithfulRegular`, `forceFaithfulMode`) and
   delete the harness `.probes/dot-splines-faithful-measure.ts`.
4. Remove now-dead imports across all touched files (tsc must be clean —
   no unused-import errors where the project flags them).
5. Update `plans/layout-engine-backlog/gaps/dot.md`: DOT-1b → DONE; drop the
   "fitter survives" note.

## Write-set

- `src/layout/dot/edge-route-poly.ts`, `edge-route-routing.ts`,
  `edge-route-helpers.ts`, `edge-route.ts`, `edge-route-chain.ts`,
  `splines-route.ts` — delete dead functions + imports
- `.probes/dot-splines-faithful-measure.ts` — delete
- `plans/layout-engine-backlog/gaps/dot.md` — DOT-1b → DONE

## Read-set

- `decisions.md#ad-3`
- grep output for each symbol above (the authoritative caller list)

## Acceptance criteria

- **Given** a grep for each fitter symbol, **then** no live (non-test) reference
  remains.
- **Given** `tsc --noEmit`, **then** exit 0 (no unused-import/dead-export errors).
- **Given** the full suite, **then** 0 failed, passed ≥ 1810, 115 goldens
  byte-identical, all DOT-1/DOT-1b oracle pins green.
- **Given** lizard on every changed file, **then** no violations.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green per gates. After the gate passes,
merge `feature/dot-1b` → `main` with a **merge commit**.
Commit: `refactor(T4): delete the simplified edge fitter`.

## Observability / Rollback

N/A — pure dead-code removal, no behavior change. Reversible (revert).
