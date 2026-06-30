<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Survey gate + baseline refresh

Needs Batch 1. The mincross / x-coord pipeline runs for every dot graph, so the
fix must be proven regression-free across the corpus before merge.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Full parity survey, 0 regressions, refresh baseline, commit, merge | (inline/opus) | `test/corpus/parity.json`, `parity-rules.json`, `PARITY.md` | T1 | [x] |

**Done.** Survey PASS: 0 regressions, 0 new timeout/errored. conformant 533→536
(graphs/share/windows-ldbxtried diverged→conformant); diverged 51→48. Baseline
(parity.json, parity-rules.json) + PARITY.md refreshed. Branch ready to merge.

Spec: `T2-survey-gate.md`.
