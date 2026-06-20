# T3 — Wire routeFaithfulSidePort to the group router

## Context
T2 built `collectNonAdjacentFlatGroup` + `routeFlatEdgeGroupFaithful` in
`splines-flat-multi.ts`. Today `routeFaithfulSidePort` (edge-route.ts ≈331) routes
each non-adjacent flat independently via `routeFlatEdgeFaithful(g,e)` +
`clipAndInstall`. This task makes it collect the group and route once, like the
adjacent-flat branch just above it (≈326-330). READ `../decisions.md` (AD-1, AD-3).

## Task
1. In `src/layout/dot/edge-route.ts:routeFaithfulSidePort`, for the `sameRank` +
   non-adjacent + side-port case (the `else` after the `isFlatAdjacent` branch),
   collect the group via `collectNonAdjacentFlatGroup(e, g)` and route once via
   `routeFlatEdgeGroupFaithful(g, group, group.length)`; return true iff it installed
   (every group edge has `spl` set). The main loop (`routeDotEdges`) then skips the
   already-routed siblings (`e.info.spl !== undefined`).
2. Preserve the adjacent-flat branch and the non-same-rank (regular) branch exactly.
3. cnt=1 (a lone non-adjacent flat) must still byte-match — the group is length 1 and
   `routeFlatEdgeGroupFaithful` reduces to the current single route (AD-1).
4. Keep `routeFlatEdgeFaithful` if still referenced; remove only if fully superseded
   (grep first — "looks unused" ≠ "is unused").

## Write-set
- `src/layout/dot/edge-route.ts` (Modify)

## Read-set
- `../decisions.md#ad-1`, `#ad-3`
- `src/layout/dot/edge-route.ts:309-335` (`routeFaithfulSidePort`),
  `:299-307` (`collectAdjacentFlatGroup` pattern)
- `src/layout/dot/splines-flat-multi.ts` (T2 exports)

## Interface contract
Consumes T2: `collectNonAdjacentFlatGroup`, `routeFlatEdgeGroupFaithful`.

## Acceptance criteria
- Given the top cnt=2 synthetic, when `render-one.ts <case>.dot dot` runs, then the
  full SVG drawing content byte-matches native `dot` (two distinct nested splines).
- Given cnt=3 (top) and cnt=2 (bottom) synthetics, same — byte-match native.
- Given a cnt=1 non-adjacent flat (e.g. 241_0's 5:ne->8:nw), when rendered, then the
  spline is BYTE-IDENTICAL to before (no change).
- `tsc` exit 0; `vitest run` green; `lizard` clean; `edge-route.ts` <500 lines.

## Observability / Rollback
N/A. Reversible.

## Boundaries
- **Never do:** alter the adjacent-flat or regular-edge branches; double-install
  (the group router installs; don't also `clipAndInstall` here).
- **Stop if:** any cnt=1 / out-of-family golden flips (AD-1).

## Commit
`feat(flat): route non-adjacent flat groups via the cnt-loop router`
