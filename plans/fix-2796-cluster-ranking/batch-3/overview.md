<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 3 — disposition, survey (as needed), merge

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T5 | Accepted oracle-bug disposition for 2796; survey + rules-gate if Batch 2 ran (or if guards require); parity/PARITY.md refresh; mission summary; merge | main session | `test/corpus/{accepted-divergences.json, parity.json, parity-rules.json, PARITY.md}`, `docs/known-divergences.md`, `plans/fix-2796-cluster-ranking/**` | T1 (+T2/T4 if run) | [x] |

Gate: guard tests green; if survey ran — rules-gate exit 0, 0 regressions.
