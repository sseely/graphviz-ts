<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2a — Refactor to `routeChainSegmented` (no-op)

## Context
Faithful TS port of C graphviz. Before adding straight-mode behavior (T2b), turn
the current single-path chain routing into a function shaped like C's segmented
loop — but producing exactly ONE segment, so output is conformant. This is a
pure structural refactor and a safe checkpoint.

## Task
In `src/layout/dot/edge-route-chain.ts`:
1. Introduce `routeChainSegmented(g: Graph, e: GraphEdge, segs: GraphEdge[]):
   Point[] | null` that, for now, does what
   `buildChainPath` + `routeRegularByType` + `recoverSlack` do today, but
   structured as a loop body that emits a single segment and accumulates its
   points into one array. Keep the begin/end/complete/route/recoverSlack order
   IDENTICAL to current behavior.
2. Rewire `routeMultiRankEdgeFaithful` and `faithfulBackFwdPoints` to call
   `routeChainSegmented` instead of `buildChainPath`(+route+recoverSlack).
3. Keep helpers ≤ CCN 10 and the file ≤ 500 lines (decompose as needed; see
   AD-2). Do NOT change any geometry.

## Write-set
- `src/layout/dot/edge-route-chain.ts`

## Read-set
- `src/layout/dot/edge-route-chain.ts:103-151` (buildChainPath,
  routeMultiRankEdgeFaithful, recoverSlack) and `:305-318` (faithfulBackFwdPoints)
- `~/git/graphviz/lib/dotgen/dotsplines.c:1755-1870` (make_regular_edge body —
  the target structure, single-segment subset)
- decisions.md#ad-1, decisions.md#ad-2

## Interface contract (consumed by T2b)
`routeChainSegmented(g, e, segs): Point[] | null` — returns accumulated control
points in graphviz-internal y-up (same frame as today), or null when the chain
cannot be assembled. T2b extends its internal loop with the smode branch.

## Acceptance criteria
- Given EVERY current corpus input, when rendered via `render-one.ts`, then the
  SVG is **conformant** to pre-refactor output (verify a sample incl. L5,
  p2, try, clust1, and ≥20 others; ideally diff full parity.json — verdicts
  unchanged for all ids).
- Given `npx vitest run`, then all 2000 tests pass.
- Given `npx tsc --noEmit`, then zero errors.
- Given the complexity hook, then no CCN/line violations in the edited file.

## Observability
N/A.

## Rollback
Reversible. If byte-identity fails, STOP (the refactor leaked a behavior change).

## Quality bar
One commit: `refactor(edge-route): extract routeChainSegmented (no-op)`.
