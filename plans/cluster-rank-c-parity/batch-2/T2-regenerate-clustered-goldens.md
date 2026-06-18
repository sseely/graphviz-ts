# T2 — Regenerate churned clustered goldens from the C oracle

## Context

T1 fixes cluster ranking, changing rendered output for multi-cluster graphs.
Their goldens currently encode the buggy (overlapping) layout. Per AD-2, churned
clustered goldens are regenerated from the **native C binary** (ground truth),
never hand-edited.

## Task

Run the full suite. For each churned golden: confirm the graph has clusters
(cluster-free/single-cluster churn → STOP, regression per Batch 1); regenerate
it from the C binary; verify the new TS output == C byte-for-byte; record it.

## Write-set

- Regenerated golden files (clustered graphs only)
- `src/layout/dot/decision-journal.md` → actually `plans/cluster-rank-c-parity/decision-journal.md`

## Read-set

- `plans/cluster-rank-c-parity/decisions.md#ad-2`
- The project's golden-generation script / fixtures dir (locate via
  `package.json` scripts or existing `*.svg`/golden fixtures)
- C oracle recipe in batch-2/overview.md

## Acceptance criteria

1. Given the golden suite, when run after T1, then all tests pass.
2. Given each churned golden, when regenerated, then it was produced by the C
   binary and the post-fix TS output equals it byte-for-byte (STOP if TS ≠ C).
3. Given each regenerated golden, then the journal records: test name, old vs
   new `nranks` (or a short shape note), and the C-match confirmation.
4. Given a churned golden whose graph has no clusters or one cluster, then STOP
   and flag it as a regression (must not happen).

## Quality bar

`npx vitest run` → all pass. `npx tsc --noEmit` → 0.

## Observability

N/A.

## Rollback

Reversible — regenerated goldens revert with the commit.

## Commit

`test(T2): regenerate clustered goldens from C oracle after cluster-rank fix`.
Body lists count of regenerated goldens + the C-match confirmation.
