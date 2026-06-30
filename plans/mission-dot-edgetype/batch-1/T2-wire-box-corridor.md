# T2 — Wire `routeRegularByType` into box-corridor emit points

## Context

T1 created `routeRegularByType(P, et)`. The faithful and chain regular-edge
routers currently `return routeSplines(P)` unconditionally. Swap each to
dispatch on `edgeType(g)` so PLINE routes polylines and adjacent-rank LINE
straightens. (Multi-rank LINE fast path is T3.)

## Task

Replace the three `routeSplines(P)` emit points with
`routeRegularByType(P, edgeType(g))`:
- `edge-route-faithful.ts:332` (`routeRegularEdgeFaithful`) — adjacent regular.
- `edge-route-chain.ts:137` (`routeMultiRankEdgeFaithful`).
- `edge-route-chain.ts:268` (hackflag forward/back path).

Thread `et`/`g` in: both functions already receive `g`, so call
`edgeType(g)` at the emit site. Import `routeRegularByType` from
`./splines-route-type.js`, `edgeType` from `./splines.js`.

**Decline-path probe (required):** before finishing, instrument
`edge-route-poly.ts:computeSpline` with a `throw` and run the T4 corpus DOT
strings (`splines=line`/`polyline`, adjacent + multi-rank) through `renderSvg`
to prove whether any regular edge reaches the pathplan fitter. Record the result
(reachable / unreachable) in the decision journal. Remove the throw before
committing. If reachable, note it for T3 scope expansion.

## Write-set

- MODIFY `src/layout/dot/edge-route-faithful.ts`
- MODIFY `src/layout/dot/edge-route-chain.ts`

## Read-set

- `batch-1/T1-route-by-type.md` (interface contract)
- `src/layout/dot/edge-route-faithful.ts:304-333`
- `src/layout/dot/edge-route-chain.ts:130-137,258-270`
- `src/layout/dot/splines.ts:60` (`edgeType`)

## Architecture decisions

- AD-1 (use the helper). Do NOT inline the straighten.
- The default path is `EDGETYPE_SPLINE` → `routeRegularByType` delegates to
  `routeSplines`, so default output is conformant (golden guard).

## Acceptance criteria

- Given a default graph (no `splines`), when routed, then every golden stays
  conformant (the dispatch is a pure pass-through for SPLINE).
- Given `splines=polyline` on a multi-rank graph, when rendered, then regular
  edge paths are polylines (routePolylines output), not spline beziers.
- Given `splines=line` on an adjacent-rank graph, when rendered, then the
  regular edge path is a straight 4-point segment.
- Given the decline-path probe, when the corpus is rendered with the throw
  installed, then the journal records whether `computeSpline` is reached.

## Observability

N/A.

## Rollback

Reversible — revert the two edits.

## Quality bar

tsc 0; vitest 0 failed + 115 goldens conformant (CRITICAL: a non-identical
golden = STOP); lizard clean on both files.
Commit: `feat(T2): dispatch regular box-corridor edges on edge type`.
