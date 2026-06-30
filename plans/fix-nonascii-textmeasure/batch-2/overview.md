<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Verify (survey-gated)

Run the parity survey, gate it (hard STOP on any regression — the real
checkpoint for this wide-blast-radius change), refresh the committed baseline,
and reconcile accepted-divergences for any non-ASCII case whose status changed.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2 | `survey` + `survey:gate` (0 regressions, esp. 4 conformant non-ASCII cases); refresh `parity.json`/`parity-rules.json`/`PARITY.md`; reconcile accepted-divergences for status changes | general-purpose | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md`, `test/corpus/accepted-divergences.json`, `test/corpus/rules-known-divergences.md`, `test/corpus/accepted-divergences.test.ts` (only if entries removed) | T1 | [ ] |

Depends on T1 (fix in place). If `survey:gate` lists ANY regression, STOP — do
not refresh the baseline. The 4 currently-conformant non-ASCII graphs (`1724`,
`2343`, `2502`, `graphs-b993`) are the key regression watch.
