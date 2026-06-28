# T5 — Align lrBalance

## Context
`LR_balance` (balance=2, no normalize) is the last x-NS step and a prime anchor
driver: for each tree edge with cutvalue 0 it finds the min-slack crossing edge
and reranks one subtree by `delta/2` (integer truncation), choosing the side by
`ND_lim(tail) < ND_lim(head)`. Tree-edge iteration order + the side/trunc decide
the net absolute drift. C: `lib/common/ns.c:LR_balance`.

## Task
If the trace's before/after-`LR_balance` ranks still diverge from C after T1–T4,
align the port's `lrBalance`: Tree_edge iteration order, `enter_edge` reuse,
`SLACK`/`delta/2` integer truncation (match C `int` semantics), and the
`lim(tail)<lim(head)` side choice with `rerank(node, ±delta/2)`. Skip if matching.

## Write-set
- `src/layout/dot/ns.ts` (`lrBalance`)

## Read-set
- `~/git/graphviz/lib/common/ns.c:LR_balance, rerank, SLACK`
- `src/layout/dot/ns.ts` current `lrBalance`
- `test/diagnostic/xns-trace.md`

## Acceptance criteria
- Given the trace's after-LR_balance ranks diverged, when T5 lands, then port's
  before/after-balance ranks for 2368_1 match C exactly (the uniform shift → 0).
- Given T5, when the full survey runs, then 0 regressions — else STOP.
- Given lrBalance already matches, then T5 makes no change.
- **Batch-1 exit**: after T1–T5, port internal x-coords for 2368_1 equal C's
  (376=-119, 196=-29, 256=43, 316=115, 76=205) and a spot-check on 2368 matches;
  survey 0 regressions.

## Observability / Rollback
N/A. Reversible.

## Quality bar
tsc + vitest green; survey gate 0 regressions before commit.
Commit (if changed): `fix(ns): align LR_balance subtree reranks to C`.
