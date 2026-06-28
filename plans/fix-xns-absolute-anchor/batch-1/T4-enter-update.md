# T4 — Align enterEdge + update/rerank

## Context
`enter_edge` picks the replacement edge (min-slack across the cut); `update`
swaps tree edges and `rerank` shifts one side's subtree by the slack. Which side
is reranked (tail vs head subtree, by `±delta`) sets the absolute drift. C:
`lib/common/ns.c:enter_edge`, `update`, `rerank`.

## Task
If the trace's first remaining divergence is in `enterEdge` selection or the
`rerank` side/amount, align the port's `enterEdge` search order + tie-break and
`update`/`rerank` (which subtree, sign of delta, `lim`/`low` comparison) to C
exactly. Skip if already matching.

## Write-set
- `src/layout/dot/ns.ts` (`enterEdge`, `update`, `rerank`)

## Read-set
- `~/git/graphviz/lib/common/ns.c:enter_edge, update, rerank`
- `src/layout/dot/ns.ts` current `enterEdge`/`update`/`rerank`
- `test/diagnostic/xns-trace.md`

## Acceptance criteria
- Given the trace's first divergence was enterEdge/rerank, when T4 lands, then the
  per-pivot rerank matches C and the diff advances.
- Given T4, when the full survey runs, then 0 regressions — else STOP.
- Given these already match, then T4 makes no change.

## Observability / Rollback
N/A. Reversible.

## Quality bar
tsc + vitest green; survey gate 0 regressions before commit.
Commit (if changed): `fix(ns): align enterEdge/update/rerank to C`.
