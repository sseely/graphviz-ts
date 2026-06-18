# T3 — Regenerate churned cluster goldens from the C oracle

## Context

T2's fix changes rendered output for multi-cluster graphs with inter-cluster
crossings. Per AD-2, churned cluster goldens are regenerated from the native C
binary, never hand-edited.

## Task

Run the full suite. For each churned golden: confirm it is a clustered graph
(cluster-free/crossing-free churn → STOP, regression); regenerate from the C
binary; verify post-fix TS output == C byte-for-byte; record it.

## Write-set

- Regenerated golden files (clustered graphs only)
- `plans/mincross-clust-c-parity/decision-journal.md`

## Read-set

- `decisions.md#ad-2`
- The project golden-generation script / fixtures dir
- C oracle recipe in batch-2/overview.md

## Acceptance criteria

1. Given the suite after T2, when run, then all tests pass.
2. Given each churned golden, then it was regenerated from C and post-fix TS ==
   C byte-for-byte (STOP if TS ≠ C).
3. Given each regenerated golden, then the journal records test name + old/new
   crossing count + C-match confirmation.
4. Given a churned golden with no clusters or no inter-cluster crossing, then
   STOP and flag as regression.

## Quality bar

`npx vitest run` → all pass. `npx tsc --noEmit` → 0.

## Observability / Rollback

N/A. Reversible — goldens revert with the commit.

## Commit

`test(T3): regenerate cluster goldens from C oracle after mincross fix`.
