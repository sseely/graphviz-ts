# T3 — Ablation sweep + 2471 root-rank verification

## Context

Closing verification that the cluster-rank fix is faithful to C across the
ablation matrix and on the real 2471 graph (rank structure only, per AD-3).

## Task

Re-run the ablation comparison and the 2471 root STATS probe; confirm parity
with C; write the mission's final summary to the journal.

## Write-set

- `plans/cluster-rank-c-parity/decision-journal.md` (final summary section)

## Read-set

- `plans/cluster-rank-c-parity/batch-2/overview.md` (reproducers + 2471 target)
- Memory `2471-blocker-is-cluster-ranking` (STATS probe recipe)

## Acceptance criteria

1. Given every ablation reproducer (plain, HTML, RL, self-edge, and **all
   cluster variants**), when root STATS are compared, then all MATCH C on
   `nranks`/`totalNodes`.
2. Given 2471, when ranked, then the root mincross-entry STATS == C
   (**23 ranks / 3213 vnodes**). Use a temporary STATS probe; revert after.
3. Given AD-3, then the final summary explicitly records that 2471 full-render
   remains out-of-scope (mincross perf gap) and is not a failure of this
   mission.
4. Given any temporary C-side or TS-side probe used, then it is reverted and the
   C source tree (`~/git/graphviz`) is left pristine (`git status` clean).

## Quality bar

`npx vitest run` → all pass. `npx tsc --noEmit` → 0. Working tree matches the
declared write-set + Batch 2 goldens.

## Observability

N/A.

## Rollback

Reversible — documentation only.

## Commit

`docs(T3): verify cluster-rank parity (ablation + 2471 rank structure == C)`.
