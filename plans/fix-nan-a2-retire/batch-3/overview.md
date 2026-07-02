<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 3 — survey, Stage-2 retire, merge

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T5 | Full survey + rules-gate vs HEAD; Stage-2 accepted-divergences per D1 outcome; parity/PARITY.md refresh; mission summary; merge | main session | `test/corpus/{accepted-divergences.json, parity.json, parity-rules.json, PARITY.md}`, `docs/known-divergences.md`, `plans/fix-nan-a2-retire/**` | T2 (+T3/T4 when Batch 2 ran) | [x] |

Entry from either path: Batch 2 completed (port-defect fixed) or skipped
(T2 ⇒ irreducible). Gate: rules-gate exit 0, 0 regressions, guard test green.
