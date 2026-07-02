<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 3 — survey, disposition, merge

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T5 | Full survey + rules-gate vs HEAD; 1332 disposition per D1; parity/PARITY.md refresh; mission summary; merge | main session | `test/corpus/{parity.json, parity-rules.json, PARITY.md, accepted-divergences.json?}`, `docs/known-divergences.md?`, `plans/fix-1332-cluster-edge-routing/**` | T2 (+T3/T4 as run) | [ ] |

Entry from any D1 rung. Gate: rules-gate exit 0, 0 regressions, guard tests
green.
