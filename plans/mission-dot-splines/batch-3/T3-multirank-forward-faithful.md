# T3 — Multi-rank forward chains → faithful

## Context

Plain multi-rank forward edges (spanning >1 rank via virtual-node chains) route
through `routeFwdMultiRankEdge` → `computeSplineMulti` (simplified). The faithful
chain path `routeMultiRankEdgeFaithful` (`edge-route-chain.ts`) already handles
labeled/side-port multi-rank edges. Extend it to plain chains and make it the
path for all multi-rank forward edges.

## Task

1. In `edge-route.ts:routeOneEdge`, route plain multi-rank forward edges through
   `routeFaithfulMultiRank` / `routeMultiRankEdgeFaithful` (drop the
   `hasSidePort || hasMainLabel` gate for forward multi-rank), keeping label
   handling intact.
2. Extend `routeMultiRankEdgeFaithful` so it is conformant for plain chains: walk
   the virtual chain (`walkFwdVirtChain`), build the per-rank boxes
   (`rank_box`/`maximal_bbox`), route via pathplan `routeSplines`. Mirror C
   `make_regular_edge` over the chain; do NOT invent geometry.
3. Goldens must stay conformant (many goldens have multi-rank edges — this is
   the highest golden-risk batch). Fix any shift as a faithful-path bug vs the
   dot oracle. STOP on a stale-golden mismatch.
4. Pin oracle tests: a 3-rank long-span (`a->b->c->d; a->d`) and a chain with a
   bend, at tol 0.5.

## Write-set

- `src/layout/dot/edge-route.ts` — dispatch: multi-rank forward → faithful
- `src/layout/dot/edge-route-chain.ts` — extend `routeMultiRankEdgeFaithful` for plain chains
- `src/layout/dot/edge-route-splines.test.ts` — add long-span oracle pins

## Read-set

- `decisions.md#ad-1`, `#ad-2`; T1 inventory; T2 outcome (journal)
- `~/git/graphviz/lib/dotgen/dotsplines.c:make_regular_edge` (chain box build)
- `src/layout/dot/edge-route.ts:165-292` (`isMultiRankFwdEdge`, `routeFaithfulMultiRank`)
- `src/layout/dot/edge-route-chain.ts:133-191` (`routeMultiRankEdgeFaithful`, `walkFwdVirtChain`)

## Interface contract

`routeMultiRankEdgeFaithful(g, e)` returns spline control points for any plain
multi-rank forward edge, or null when not multi-rank-forward.

## Acceptance criteria

- **Given** `digraph{a->b->c->d; a->d}`, **then** the `a->d` long-span matches
  dot within 0.5pt (was ~Δ on the simplified path).
- **Given** the 115 goldens, **then** all conformant.
- **Given** the full suite, **then** passed >= baseline, 0 failed.

## Quality bar

`tsc --noEmit` 0; lizard clean; vitest green per gates.
Commit: `feat(T3): route multi-rank forward edges through pathplan`.

## Observability / Rollback

N/A — pure layout. Reversible. Highest golden-risk batch — if deltas are broad,
log clusters and proceed sub-task by sub-task; STOP if unclosable.
