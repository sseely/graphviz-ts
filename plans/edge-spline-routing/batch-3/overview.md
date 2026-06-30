<!-- SPDX-License-Identifier: EPL-2.0 -->

# Batch 3 — Verify + regression scan

Prove the fix and no regression across the 280 conforms to.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T3 | Re-run survey + dashboard; confirm reproducer + rankdir_dot* long edges match; conformant ≥ 280, 0 regressions; record residuals | sonnet | `test/corpus/parity.json`, `test/corpus/PARITY.md` | S1, T2 | [ ] |

Gate after batch: `git diff --name-only main` ⊆ all task write-sets; final
`tsc` + `vitest` green on the full branch; survey conformant ≥ 280 with 0 per-id
regressions and no rise in `errored`/`timeout`.
