# T1 — Faithful adjacent-back-edge routing

## Context

graphviz-ts is a faithful TS port of graphviz C (`~/git/graphviz`). After DOT-1,
single regular edges route faithfully — except **adjacent back edges** (b→a
spanning 1 rank): `routeRegularEdgeFaithful` declines back edges, so they fall to
the fitter (`straightEdgeSplineWithRank` via `routeForwardEdge`, or `routeEdgeRaw`
via `routeBackEdge`'s chain<2 branch). A back edge is the forward edge with
swapped ends (C `makefwdedge`).

## Task

1. Generalize the existing `makeBackFwdEdge` (in `edge-route-chain.ts`, DOT-1 T4)
   into an **exported** `makeFwdEdge(e)` — a synthetic forward view (tail/head
   swapped, fresh portless ends). T3 will reuse it.
2. Route adjacent back edges faithfully: detect the adjacent-back case in the
   dispatch (`edge-route.ts`), route via `makeFwdEdge` → `routeRegularEdgeFaithful`
   → `clipAndInstall`. Verify the `splines.ts` `swapSpline` pass un-flips the
   orientation (arrow ends at the back edge's head).
3. Keep the fitter fallback in place for now (T4 deletes it) — only ADD the
   faithful path ahead of it; do not delete fitter code in this task.
4. Pin an adjacent-back oracle test in `edge-route-splines.test.ts` (tol 0.5).

## Write-set

- `src/layout/dot/edge-route-chain.ts` — export/generalize `makeFwdEdge`
- `src/layout/dot/edge-route.ts` — adjacent-back dispatch → faithful
- `src/layout/dot/edge-route-splines.test.ts` — adjacent-back oracle pin

## Read-set

- `decisions.md#ad-1`
- `~/git/graphviz/lib/dotgen/dotsplines.c:make_regular_edge` (BWDEDGE/`makefwdedge`)
- `src/layout/dot/edge-route-chain.ts` (`makeBackFwdEdge`, `routeBackEdge`,
  `faithfulBackFwdPoints`)
- `src/layout/dot/edge-route.ts` (`routeOneEdge`, `routeForwardEdge`,
  `routeFaithfulRegularPlain`, `isMultiRankBackEdge`)
- `src/layout/dot/splines.ts` (`swapEndsP`, `swapSpline` — confirm when it runs)

## Interface contract (consumed by T3)

`export function makeFwdEdge(e: Edge): Edge` — forward view of any edge: tail/head
swapped when the edge runs high→low rank, fresh `makePort()` ends, shared
`attrs`/`root`/`to_virt`. Used by T3 for parallel back-members.

## Acceptance criteria

- **Given** `digraph{a->b; b->a}` with the parallel-group path bypassed, **when**
  b→a routes, **then** it matches the dot oracle ≤0.5pt with the arrow at a.
- **Given** the 115 goldens, **then** all conformant.
- **Given** the full suite, **then** passed ≥ 1810, 0 failed.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green per gates.
Commit: `feat(T1): route adjacent back edges through pathplan`.

## Observability / Rollback

N/A — pure layout, no new observable operations. Reversible (revert; goldens
conformant).
