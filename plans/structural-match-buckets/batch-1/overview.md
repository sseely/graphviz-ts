<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — capture worst-diff location in the survey

Add an additive `maxDeltaPath` field so every structural-match (and diverged)
row records *where* its worst numeric diff is. Enables all downstream bucketing.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | `diffVerdict` records `maxDeltaPath`; test asserts it | typescript-pro | `test/corpus/survey.ts`, `test/corpus/survey.test.ts` | — | [x] |

Gate before proceeding: `npm run typecheck` = 0,
`npx vitest run test/corpus/survey.test.ts` = 0.
