# T3 — Align leaveEdge selection

## Context
`leave_edge` picks the next tree edge with negative cut value via a *cyclic*
search anchored by a persistent cursor (`Mincross`/`S_i`-style state in C). The
search start point + tie-break decide the pivot path and thus the absolute anchor.
C: `lib/common/ns.c:leave_edge`.

## Task
If the trace's first remaining divergence is a different `leaveEdge` choice (port
picks a different negative-cutvalue edge than C at the same step), align the
port's `leaveEdge` cyclic-search cursor init/advance + tie-break to C exactly.
Skip if it already matches.

## Write-set
- `src/layout/dot/ns.ts` (`leaveEdge` + its cursor state)

## Read-set
- `~/git/graphviz/lib/common/ns.c:leave_edge` (and the cursor it maintains)
- `src/layout/dot/ns.ts` current `leaveEdge`
- `test/diagnostic/xns-trace.md`

## Acceptance criteria
- Given the trace's first divergence was a leaveEdge choice, when T3 lands, then
  the port picks C's edge at that step and the diff advances.
- Given T3, when the full survey runs, then 0 regressions — else STOP.
- Given leaveEdge already matches, then T3 makes no change.

## Observability / Rollback
N/A. Reversible.

## Quality bar
tsc + vitest green; survey gate 0 regressions before commit.
Commit (if changed): `fix(ns): align leaveEdge cyclic search/tie-break to C`.
