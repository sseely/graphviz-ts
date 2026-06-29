<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Survey gate + baseline refresh

Needs Batch 1 (T1). The integration safety net: the NS change runs in every dot
graph, so the full headless parity survey must show 0 regressions before merge.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | Full parity survey, 0 regressions, refresh baseline, commit | (inline/opus) | `test/corpus/parity.json`, `parity-rules.json`, `PARITY.md` | T1 | [ ] |

Spec: `T2-survey-gate.md`.
