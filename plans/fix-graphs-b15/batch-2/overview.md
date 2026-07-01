<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — implement + regression baseline

Implement the T1 design (faithful collect change routed through the existing
group dispatch), pin it with a unit test + the b15 count-and-maxDelta check, then
survey and gate hard vs committed HEAD. Sequential: T3 depends on T2.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2 | Change `dotSplines_` collect to include virtual `splineMerge` nodes (+ any `getMainEdge`/`to_virt` fix from T1); route via the existing group dispatch; unit test; verify b15 = 153 edges AND maxDelta ~0 | typescript-pro / debugger | `src/layout/dot/splines.ts` (+ `splines.test.ts`) [+ `conc.ts`/`classify.ts` only if T1 implicates] | T1 | [ ] |
| T3 | Survey + `rules-gate` (0 regressions vs HEAD); refresh `parity.json`/`parity-rules.json`/`PARITY.md`; reconcile accepted-divergences if status changed | inline | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md`, `accepted-divergences.json`, `rules-known-divergences.md`, `accepted-divergences.test.ts` (only if entries removed) | T2 | [ ] |

T2 writes the routing source (+ test); T3 the generated/reconciliation corpus
files — no overlap. If `rules-gate` lists ANY regression (incl. a maxDelta rise),
STOP — do not refresh the baseline.

## Gate after batch
All README quality gates. Confirm `git diff --name-only` matches the write-set
(+ `plans/**`, `.agent-notes/**`).
