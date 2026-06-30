# T3 — Faithful parallel/opposing group routing

## Context

The multi-edge group router `routeParallelEdgeGroup` (in `splines-route.ts`) is
the last live user of the fitter: `baseSplineForGroup` uses
`buildRankCorridor`/`computeSpline`, and `installShiftedEdge` uses `clipToNodes`.
Migrate it to faithful primitives, mirroring C's `make_regular_edge` cnt>1 path
exactly (AD-2). **High-risk** — DOT-1 confirmed the naive reverse-the-forward-base
approach does not reproduce dot's opposing geometry; follow T2's recipe.

## Task

> **Recipe captured AND prototyped conformant** by the T2 pre-mission spike — see
> `decision-journal.md` → "T2 spike recipe" + "TS conformant proof". The recipe
> produced exact-oracle geometry for a→b, the exact b→a control points, and
> conformant `dot-multi-edge`/`mc-edge-multicolor` goldens. Implement it
> verbatim. Only TWO small residuals remain:
> 1. **Back-member point-order:** ensure the back member's spline installs on the
>    ORIGINAL edge so `edgeNormalize` (splines.ts) reverses its point order once
>    (the spike's prototype left it un-reversed — investigate `newSpline`/
>    `clipAndInstall` install target when `fe` is a `makeFwdView` virtual). Do NOT
>    double-reverse (the DOT-1 bug).
> 2. **AC4 stale test:** `multi-edge.test.ts` AC4 expects spacing ~13.37; the
>    faithful spacing (~17.3) is correct (the conformant `dot-multi-edge`
>    golden proves it). Update AC4's expected value to the oracle-derived spacing.

1. Implement per **T2's recipe** + AD-2 (mirror C `make_regular_edge` cnt>1):
   route ONE shared faithful base for the group's forward representative
   (`routeRegularEdgeFaithful` adjacent / `routeMultiRankEdgeFaithful` multi-rank);
   shift **interior control points only** by Multisep per member; for BWDEDGE
   members build the forward view via `makeFwdEdge` (T1) and call
   `clipAndInstall(fwdView, fwdView.head, ptsCopy)` — do **NOT** manually reverse
   (the existing `swapEndsP`/`swapSpline` pass reverses back edges post-routing;
   confirm it runs for group members). Pass a FRESH point-array copy to
   `clipAndInstall` (it mutates in place — DOT-1 bug). `getPortConfig` already
   handles the reversed-edge port swap — no change needed there.
2. Remove the fitter calls from `baseSplineForGroup`/`installShiftedEdge` (the
   functions become faithful); do NOT delete the now-unreferenced fitter
   functions themselves — that is T4.
3. Keep all goldens conformant (AD-3). Fix any shift as a faithful-path bug
   vs the dot oracle. If conformant parity is unreachable, STOP (do not regress).
4. Pin oracle tests in `edge-route-splines.test.ts`: opposing pair
   (`a->b; b->a`) and a parallel-with-offset case (tol 0.5). Keep the existing
   `edge-route-multi.test.ts` opposing pin and `multi-edge.test.ts` AC4 green.

## Write-set

- `src/layout/dot/splines-route.ts` — faithful `baseSplineForGroup` /
  `installShiftedEdge` / `routeParallelEdgeGroup` (+ `makeFwdView` helper)
- `src/layout/dot/edge-route-splines.test.ts` — opposing + parallel oracle pins
- `src/layout/dot/multi-edge.test.ts` — update AC4 spacing to the oracle value
  (residual 2 above)

## Read-set

- `decision-journal.md#t3-recipe` (from T2) — the authoritative recipe
- `decisions.md#ad-2`, `#ad-3`
- `~/git/graphviz/lib/dotgen/dotsplines.c:make_regular_edge` (cnt>1 section)
- `src/layout/dot/splines-route.ts` (`routeParallelEdgeGroup`,
  `baseSplineForGroup`, `installShiftedEdge`, `shiftInteriorPts`,
  `isBackEdgeMember`)
- T1's `makeFwdEdge`; `clipAndInstall`/`buildDotSinfo`; `swapEndsP`/`swapSpline`

## Interface contract

`routeParallelEdgeGroup(g, edges, multisep)` installs each member's spline via
the faithful pipeline; no `computeSpline`/`buildRankCorridor`/`clipToNodes`
calls remain in `splines-route.ts`.

## Acceptance criteria

- **Given** `digraph{a->b; b->a}`, **then** both edges match the dot oracle ≤0.5pt
  (the `edge-route-multi.test.ts` opposing pin passes).
- **Given** `dot-multi-edge` and `mc-edge-multicolor` goldens, **then**
  conformant; the `multi-edge.test.ts` AC4 spacing test passes.
- **Given** the 115 goldens, **then** all conformant.
- **Given** the full suite, **then** passed ≥ 1810, 0 failed.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green per gates.
Commit: `feat(T3): route parallel/opposing edges through pathplan`.

## Observability / Rollback

N/A — pure layout. Reversible. If conformant parity is unreachable for a case,
STOP per AD-3 (keep that fitter path; re-scope) — do not regress a golden.
