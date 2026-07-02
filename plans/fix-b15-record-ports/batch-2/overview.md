<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Fixes (provisional; ask on expansion; evidence-scoped per D3)

| ID | Description | Agent | Writes (provisional) | Depends On | Done |
|---|---|---|---|---|---|
| T3 | Faithful fix at pinned origin + regression test | main loop | sameport.ts and/or splines-path-begin/end.ts + test | T1 | [x] |
| T4 | FlightToHover fix if bounded, else D4 disposition | main loop | (from T2) or comparisons/ page | T2 | [x] |

May collapse into one commit if one root (journal it). Regression test:
b15 VERBATIM (2183 lesson — no distilled repro unless red/green-proven),
red/green-verified against pre-fix code. Watch goldens: samehead/honda
family + any sameport-consuming cases must stay green.
