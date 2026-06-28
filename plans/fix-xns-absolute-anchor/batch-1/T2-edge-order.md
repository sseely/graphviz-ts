# T2 — Align in/out edge-list + aux-edge insertion order

## Context
`leaveEdge`/`enterEdge` iterate node in/out edge lists and the aux edges built by
`make_LR_constraints` / `make_edge_pairs`. Insertion order there determines pivot
candidate order → absolute anchor. C: `lib/dotgen/position.c:create_aux_edges`,
`make_LR_constraints`, `make_edge_pairs`; `fast_edge` append order.

## Task
If the Batch-0 trace's first remaining divergence is an enter/leave candidate
chosen in a different order (same edges, different sequence), align the port's
aux-edge / fast-edge insertion order to C. Order only, not the edge set. Skip
(`[x] no change needed`) if the trace shows edge order already matches.

## Write-set
- `src/layout/dot/fastgr.ts` (fastEdge append order — only if diverged)
- `src/layout/dot/position.ts` (createAuxEdges / makeEdgePairs order)
- `src/layout/dot/position-aux.ts` (make_LR_constraints aux-edge order)

## Read-set
- `~/git/graphviz/lib/dotgen/position.c:create_aux_edges, make_LR_constraints, make_edge_pairs`
- `src/layout/dot/ns.ts` `enterEdge`/`leaveEdge` (how lists are walked)
- `test/diagnostic/xns-trace.md`

## Acceptance criteria
- Given the trace's first divergence was an edge-order/candidate-order issue, when
  T2 lands, then the diff advances past it.
- Given T2, when the full survey runs, then 0 regressions — else STOP.
- Given edge order already matches C, then T2 makes no change.

## Observability / Rollback
N/A. Reversible.

## Quality bar
tsc + vitest green; survey gate 0 regressions before commit.
Commit (if changed): `fix(ns): align x-aux edge insertion order to C`.
