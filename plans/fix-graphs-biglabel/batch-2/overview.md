# Batch 2 — fix at origin + regression baseline

Entered ONLY if Batch 1 (T2) found an algorithmic port defect. If T2 fired the
AD-5 escape, do NOT enter this batch — follow the accepted-divergence path
instead. Sequential: T4 needs the fix live.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T3 | Apply the faithful fix at the T2-pinned origin (+ colocated test if logic-bearing); verify the edge spline matches | inline / typescript-pro | T2-pinned `src/` file (+ its `.test.ts`) | T2 | [ ] |
| T4 | Regenerate parity baseline; verify graphs-biglabel improved and no other id regressed | inline | `test/corpus/parity.json`, `parity-rules.json`, `PARITY.md`, goldens | T3 | [ ] |

## Write-set conflict check

T3 writes the single pinned `src/` file (+ test). T4 writes generated parity
artifacts + any golden. No overlap. Sequential due to data dependency.

## Gate after batch

Run all gates in [../README.md](../README.md#quality-gates). Confirm
`git diff --name-only` matches the declared write-set (+ `plans/**`,
`.agent-notes/**`). survey:gate must show 0 regressions and graphs-biglabel
improved.
