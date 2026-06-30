<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Survey gate + baseline refresh

Needs Batch 1. The edge-spline router runs for every dot graph, so the fix must
be proven regression-free across the corpus before merge.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Full parity survey, 0 regressions, refresh baseline, commit, merge | (inline/opus) | `test/corpus/parity.json`, `parity-rules.json`, `PARITY.md` | T1 | [x] |

**Result:** survey PASSED — 0 regressions, 18 improvements (conformant 525→533,
structural 183→193, diverged 70→52). graphs/share/windows-mike → conformant.
Baseline + PARITY.md refreshed (commit `14eb935`). Merge pending user push.

Spec: `T2-survey-gate.md`.
