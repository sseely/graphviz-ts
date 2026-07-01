# Batch 1 — harness fix + baseline refresh

Single batch. T2 depends on T1 (needs the reclassification live before the
survey will bucket 1472 as `oracle-error`). Run sequentially.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | Add `isWellFormedSvg` helper; classify non-well-formed oracle as `oracle-error` in `surveyOne`; TDD unit tests | typescript-pro (or inline) | `test/corpus/survey.ts`, `test/corpus/survey.test.ts` | — | [x] |
| T2 | Regenerate parity baseline; verify 1472 → `oracle-error` and no other id changed bucket | inline | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, docs parity artifacts | T1 | [x] |

## Write-set conflict check

T1 writes `survey.ts` + `survey.test.ts`. T2 writes the generated
`parity*.json` + docs artifacts. No overlap. Sequential due to data dependency,
not file contention.

## Gate after batch

Run all gates in [../README.md](../README.md#quality-gates). Confirm
`git diff --name-only` matches the declared write-set (plus `plans/**`,
`.agent-notes/**`).
