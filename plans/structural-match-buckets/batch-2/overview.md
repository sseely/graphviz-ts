<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — dashboard structural-match bucket section

Add the structural-match analogue of `divergedBucket()`: classify by worst-diff
element-kind × magnitude band, render a new PARITY.md section.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2 | `structuralBucket()` + "Tracked structural-match — by signature" section | typescript-pro | `test/corpus/dashboard.ts` | T1 | [x] |

Depends on T1: consumes `SurveyResult.maxDeltaPath` (compile-time interface).
Gate before proceeding: `npm run typecheck` = 0; dashboard runs clean against the
**current** `parity.json` (empty structural bucket is fine until Batch 3
repopulates the field).
