<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 1 — Rounded HTML-table fill + oracle-pin

Single batch, two sequential tasks. T1 and T2 share no write-set conflict but
T2 verifies T1's output, so they run in order (T1 → T2), not in parallel.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Rounded `<path>` bgcolor fill for tables + cells (gap A) + pen-width-on-fill (gap B) + unit tests | typescript-pro | `src/common/htmltable-emit.ts`, `src/common/htmltable-emit-fill.ts`, `src/common/htmltable-emit.test.ts`, `src/common/htmltable-emit-fill.test.ts` | — | [x] |
| T2 | Oracle-pin 5 grd* → conformant, add golden, regenerate survey | general-purpose | `test/golden/dot-htmltable-rounded-grad.*`, `test/golden/manifest.json`, `test/golden/suite.test.ts`, `test/corpus/parity.json`, `test/corpus/PARITY.md`, `plans/htmltable-rounded-fill/decision-journal.md` | T1 | [x] |

## Sequencing

1. T1 — implement and unit-test the rounded fill + stroke-width. Owns all source.
2. Quality gates (typecheck + scoped tests + full suite).
3. T2 — render the 5 grd* corpus cases, byte-diff against the native oracle,
   confirm they reach conformant, add a golden, regenerate the parity survey.
   Owns only test artifacts + journal.

## Write-set conflicts

None. T1 owns `src/common/*`; T2 owns `test/golden/*`, `test/corpus/*`
(generated), and the journal. No file is written by both.

## Task specs

- [T1-rounded-fill.md](./T1-rounded-fill.md)
- [T2-oracle-pin.md](./T2-oracle-pin.md)
