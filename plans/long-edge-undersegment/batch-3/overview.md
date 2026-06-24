<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 3 — Verify + regression scan

Regenerate the parity dashboard and prove the win + no regression.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T3 | Regenerate survey + dashboard; canary p3 `sleep--runmem` + the in-class rankdir rows match the oracle piece count; byte-match ≥ 281, 0 per-id regressions; record any deferred residual | (executor inline; no subagent) | `test/corpus/parity.json`, `test/corpus/PARITY.md`, `comparisons/*` (deferred residuals) | T2 | [ ] |

Gate after batch: full-branch `tsc` + `vitest` green; per-id survey diff vs
`main` shows **0 regressions** and **byte-match ≥ 281**; `graphs-p3` flipped
forward; rankdir rows classified same-class flipped, separate-class documented
(D5). Any still-diverging improved row recorded as deferred (D3) with a
comparison page.
