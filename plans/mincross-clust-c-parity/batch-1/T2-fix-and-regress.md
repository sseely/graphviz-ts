# T2 — Fix the swap-blocking defect + TDD regression

## Context

T1 localizes the exact site where TS rejects/misses the crossing-removing
reorder C makes on a clustered graph. T2 fixes it faithfully to C and locks it
with a regression pinned to **C's per-rank order** (AD-3), not just the count.

## Task

Port the C behavior at the localized site exactly. TDD: failing test first
(mc3-style graph must reach C's per-rank node order). Do not redesign mincross;
mirror C's swap-legality / candidate / median logic.

## Write-set

- The file(s) localized in T1, among: `mincross-cross.ts`, `mincross-order.ts`,
  `mincross-build.ts`, `mincross.ts` (AD-1)
- The corresponding `*.test.ts`

## Read-set

- T1's journal entry (the localized site)
- The C function at the localized site (`~/git/graphviz/lib/dotgen/mincross.c`)
- `decisions.md#ad-3` (order-match predicate)

## Interface contract

After T2: for `mc3` and the 6-cluster chain, the post-mincross per-rank node
order equals C's. Consumed by Batch 2 verification (T4).

## Acceptance criteria

1. Given `mc3`, when mincrossed, then 0 crossings (== C) AND per-rank node order
   matches C.
2. Given the 6-cluster chain, then crossings reach C's count AND per-rank order
   matches C.
3. Given a cluster-free graph and a crossing-free cluster graph, then output is
   byte-identical to baseline (no regression).
4. Given the same swap-legality site changed 3× without mc3 reaching C's order,
   then STOP and document (the constraint model is wrong — AD/stop rule).

## Quality bar

TDD failing test first. `npx tsc --noEmit` → 0. `npx vitest run` → all pass
(multi-cluster goldens may churn → Batch 2; cluster-free/crossing-free churn →
STOP). Hook limits: 30 lines/fn, CCN 10, 5 params, 500/file.

## Observability / Rollback

N/A. Reversible — internal ordering state only.

## Commit

`fix(T2): <localized site> — match C cluster mincross order`. Body cites the C
reference and the mc3 evidence.
