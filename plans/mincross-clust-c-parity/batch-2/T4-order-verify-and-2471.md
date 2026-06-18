# T4 — Per-rank order verification vs C + 2471 re-test

## Context

Closing verification. The success bar is **per-rank node-order match against C**
(AD-3), not crossing count — a count can match while the order vector diverges
and silently corrupts the downstream x-coord/spline passes.

## Task

Dump per-rank L-to-R node order from C and TS for every cluster reproducer; diff
per rank. Re-test 2471. Write the final summary.

## Write-set

- `plans/mincross-clust-c-parity/decision-journal.md` (final summary)

## Read-set

- `decisions.md#ad-3`, `decisions.md#ad-4`
- Memory `2471-blocker-is-cluster-ranking` (harness)

## Acceptance criteria

1. Given `mc3`, the 6-cluster chain, and the ablation cluster variants, then
   the per-rank node order matches C for every rank (not just crossing count).
   Dump real nodes by name, virtuals as `_v`; diff per rank.
2. Given cluster-free / crossing-free reproducers, then order is unchanged from
   baseline.
3. Given 2471, when re-tested, then the result is recorded: renders, OR the next
   divergence (predicted x-coord under clusters) / perf gap is logged as the
   follow-up mission — not a failure (AD-4).
4. Given all probes used, then they are reverted; `git status` clean in `src/`
   and `~/git/graphviz` pristine.

## Quality bar

`npx vitest run` → all pass. `npx tsc --noEmit` → 0. Working tree ⊆ write-set +
Batch 2 goldens.

## Observability / Rollback

N/A. Reversible — documentation only.

## Commit

`docs(T4): verify cluster mincross per-rank order == C; 2471 re-test`.
