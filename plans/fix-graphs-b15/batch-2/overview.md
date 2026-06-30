<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Apply faithful fix + verify (survey-gated)

Implement the faithful fix the Batch 1 mechanism implicates, pin it with a unit
test + the b15 edge-count check, then run the survey and gate it hard against the
committed HEAD baseline. T2 (fix) and T3 (verify+baseline) are sequential — T3
depends on T2's fix being in place.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2 | Apply faithful fix to the implicated concentrate file(s); unit test + verify b15 emits 153 edges incl. the 6 named | debugger | implicated subset of {`src/layout/dot/conc.ts`, `src/layout/dot/classify.ts`, `src/layout/dot/edge-route.ts`, `src/layout/dot/splines.ts`} + colocated `*.test.ts` | T1 | [ ] |
| T3 | Survey + `rules-gate` (0 regressions vs HEAD); refresh `parity.json`/`parity-rules.json`/`PARITY.md`; reconcile accepted-divergences if status changed | general-purpose | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md`, `test/corpus/accepted-divergences.json`, `test/corpus/rules-known-divergences.md`, `test/corpus/accepted-divergences.test.ts` (only if entries removed) | T2 | [ ] |

T2 writes only the source file(s) the mechanism implicates (AD-3 set). T3 writes
only the generated/reconciliation corpus files — no overlap with T2. If
`rules-gate` lists ANY regression, STOP (do not refresh the baseline).
