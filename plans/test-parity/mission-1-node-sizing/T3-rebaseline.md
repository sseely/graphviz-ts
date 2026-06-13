# T3 — Re-baseline and update downstream mission scopes

## Task
1. Run `npx vitest run`; capture pass/fail counts and the new first
   diff for every still-failing golden (same format as
   ../baseline.md).
2. Write the new inventory to `../baseline-after-m1.md`.
3. Update each mission overview (2–8): strike tests that now pass,
   note shrunken deltas.
4. Append a decision-journal entry: counts before/after, anything
   surprising.
5. Tick mission 1 in ../README.md; merge the branch back to
   `feature/ts-port` with a merge commit.

## Write-set
plans/test-parity/* only.

## Acceptance criteria
- Given the suite output, when compared with baseline.md, then no
  previously passing test is missing from the pass set
- baseline-after-m1.md exists with per-family tables

## Commit
`chore(plans): re-baseline after mission 1 node sizing`
