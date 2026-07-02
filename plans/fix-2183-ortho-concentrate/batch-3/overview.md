<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 3 — Verify + close

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T6 | Survey (≤2 runs) + rules-gate 0 regressions; refresh parity.json/PARITY.md; re-render 2183 (target conformant/structural-match; D3 residual only with equal-cost proof + comparison page in comparisons/); canary 2475_2 <180s if routing/position code changed; mission summary; merge commit | main loop | test/corpus/{parity*.json,PARITY.md}, plans/**, merge | T4, T5 | [ ] |
