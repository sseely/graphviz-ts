# T1 — Align GD_nlist order for the x-aux graph

## Context
The x-NS pivot sequence (and `init_rank`'s queue) walks `GD_nlist`. If the port's
nlist order differs from C's, `init_rank` enqueues differently and `leaveEdge`
sweeps differently → different absolute anchor. C: `lib/common/ns.c:init_rank`
iterates `GD_nlist`; nlist is built in `class2`/`decompose`/`fastNode`.

## Task
From the Batch-0 trace: if the first divergence is in init order or node
enumeration, align the port's nlist construction order (the order `fastNode`
appends, and how `position.ts` builds the aux node list) to C's `GD_nlist`. Only
change ordering — not membership. If the trace shows nlist order already matches,
mark this task `[x] no change needed` and proceed to T2.

## Write-set
- `src/layout/dot/fastgr.ts` (nlist append order — only if diverged)
- `src/layout/dot/position.ts` (aux node enumeration order — only if diverged)

## Read-set
- `src/layout/dot/ns.ts` `initRank` (queue build)
- `~/git/graphviz/lib/common/ns.c:init_rank`, `lib/dotgen/class2.c` (fast_node order)
- `test/diagnostic/xns-trace.md` (the captured first divergence)

## Acceptance criteria
- Given the trace's first divergence was nlist/init order, when T1 lands, then
  the Batch-0 trace's init/enqueue order matches C and the diff advances past it.
- Given T1, when the full survey runs, then 0 regressions (AD-3) — else STOP.
- Given the trace shows nlist order already matches C, then T1 makes no change.

## Observability / Rollback
N/A. Reversible (git revert).

## Quality bar
`npx tsc --noEmit` + `npx vitest run` green; survey gate 0 regressions before
commit. Commit (only if changed): `fix(ns): align x-aux nlist order to C`.
