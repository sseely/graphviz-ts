# T1 — Localize the swap-blocking site

## Context

graphviz-ts is a faithful TS port of C Graphviz (spec `~/git/graphviz`). After
the cluster-ranking fix, the dot mincross on a clustered graph fails to remove
crossings C removes. On `mc3` (see README), C and TS both start at cur_cross 1;
C reaches 0 in one `mincross_step`, TS stays at 1. Same start → swap-legality
defect in the cluster-constrained transpose/reorder during the first root
`mincross(g,0)`.

## Task

Pin the EXACT function + line where C performs the crossing-removing reorder
that TS rejects. Diagnose only — no production edit. Use the trace hook + a
throwaway transpose/reorder/`left2right` probe (revert after).

## Approach

1. Reproduce `mc3` trajectory (C 1→0, TS stuck 1) via `setMincrossTrace`.
2. In TS, instrument `transpose_step`/`transposeCounts`/`left2right` for the
   stuck rank pair: does TS find the improving swap and reject it (left2right ≠
   0), or never evaluate it, or evaluate it as non-improving (medians/order)?
3. Cross-check against C: dump C's per-rank order before/after the winning
   `mincross_step` (temporary C probe; rebuild plugin; revert).
4. Conclude: which site (left2right guard / transpose candidate / medians /
   reorder / build_ranks) and the precise behavioral difference.

## Write-set

- `plans/mincross-clust-c-parity/decision-journal.md` (the finding)
- throwaway probes in TS and/or C — **reverted** before T1 completes

## Read-set

- `src/layout/dot/mincross-cross.ts` — `left2right`, `left2rightCluster`,
  `transpose`, `transposeStep`, `transposeCounts`
- `src/layout/dot/mincross-order.ts` — `reorder`, `medians`, `mincrossStep`
- C `~/git/graphviz/lib/dotgen/mincross.c` — `transpose_step`, `left2right`,
  `medians`, `reorder`, `dot_mincross`
- Memory `2471-blocker-is-cluster-ranking` (harness recipe)

## Acceptance criteria

1. Given `mc3`, the journal names the exact function + line where TS diverges
   from C in the first `mincross(g,0)`, with probe evidence (the specific swap C
   makes and TS rejects/misses).
2. Given the finding, it states which of {left2right guard, transpose candidate
   selection, medians, reorder, build_ranks} is the defect.
3. Given T1 completion, all probes are reverted; `git status` clean in `src/`
   and the C tree (`~/git/graphviz`) pristine.

## Quality bar

No production code change. tsc 0 / vitest 1869 unchanged at T1 end.

## Observability / Rollback

N/A — diagnosis only. Reversible.

## Commit

`docs(T1): localize cluster mincross swap-blocking site (mc3)`.
