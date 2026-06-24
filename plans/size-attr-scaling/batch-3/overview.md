<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 3 — Goldens, dashboard, regression

Refresh the parity survey, confirm the win, and prove no regression across the
278 existing byte-matches.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T3 | Re-run survey + dashboard; verify 6 rankdir rows improved, byte-match ≥ 278, 0 regressions; record residual `ratio=` notes | sonnet | `test/corpus/parity.json`, `test/corpus/PARITY.md` | T1, T2 | [x] |

Gate after batch: `git diff --name-only main` ⊆ all task write-sets; final
`tsc --noEmit` + `vitest run` green on the full branch.
