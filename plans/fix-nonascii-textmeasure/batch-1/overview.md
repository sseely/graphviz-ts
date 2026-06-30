<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Fix

Apply the faithful per-UTF-8-byte fix in both measure paths and pin it with unit
tests + an oracle width check on `graphs-japanese` and `graphs-Latin1`. No human
gate — the survey gate in Batch 2 is the corpus checkpoint.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T1 | UTF-8-byte iteration helper; apply to `estimate_text_width_1pt` + `freetypeHintedWidth`; unit tests (CJK/Cyrillic/Latin-1) + verify japanese & Latin1 widths vs oracle ±0.01 | debugger | `src/common/textmeasure.ts`, `src/common/textmeasure.test.ts` | — | [ ] |

Single task. The fix is a localized change to the per-character loop in two
functions, behind one shared byte-iterating helper. ASCII behavior must be
byte-identical (byte == charCode for <128).
