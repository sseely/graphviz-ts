# T4 — Back edges + non-forward → faithful

## Context

Multi-rank back edges (`routeBackEdge`) and non-forward edges
(`routeEdgeNonForward`, dir=back/both/none) still use the simplified fitter /
chain. Migrate them to the faithful path. Back edges route the forward chain and
reverse the spline (see [[dot-edge-multi-g1-g4]] — `installShiftedEdge`).

## Task

1. In `edge-route.ts`, route multi-rank back edges and non-forward edges through
   the faithful chain path. For back edges, route the forward geometry faithfully
   then reverse, mirroring C (a back edge is the forward edge with swapped ends).
2. Extend `routeBackEdge` / the chain faithful path as needed for plain back
   chains. Mirror C; no invented geometry.
3. Goldens conformant; fix shifts as faithful-path bugs vs oracle.
4. Pin a back-edge oracle (`a->b->c; c->a`) and a `dir=both` case at tol 0.5.

## Write-set

- `src/layout/dot/edge-route.ts` — dispatch: back + non-forward → faithful
- `src/layout/dot/edge-route-chain.ts` — extend `routeBackEdge` for plain chains
- `src/layout/dot/edge-route-splines.test.ts` — back-edge + dir=both oracle pins

## Read-set

- `decisions.md#ad-1`, `#ad-2`; T1 inventory; [[dot-edge-multi-g1-g4]] (back-edge reversal)
- `~/git/graphviz/lib/dotgen/dotsplines.c:make_regular_edge` (BWDEDGE handling)
- `src/layout/dot/edge-route.ts:159-247` (`isMultiRankBackEdge`, `routeEdgeNonForward`)
- `src/layout/dot/edge-route-chain.ts:319-368` (`routeBackEdge`)

## Acceptance criteria

- **Given** `digraph{a->b->c; c->a}`, **then** the back edge `c->a` matches dot
  within 0.5pt.
- **Given** a `dir=both` edge, **then** both arrowheads + spline match dot.
- **Given** the 115 goldens, **then** all conformant.
- **Given** the full suite, **then** passed >= baseline, 0 failed.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green per gates.
Commit: `feat(T4): route back + non-forward edges through pathplan`.

## Observability / Rollback

N/A — pure layout. Reversible.
