<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Fix + verify

Starts only after Batch 1's mechanism artifact is confirmed by the human. Apply
the faithful fix at the pinned origin, add a regression test, then refresh the
parity baseline and reconcile the stale accepted-divergences entry.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2 | Apply faithful fix at the Batch-1 origin + regression test | debugger | `src/layout/dot/<origin>.ts` + its `*.test.ts` (finalized from T1) | T1 | [ ] |
| T3 | Re-survey, gate (0 regressions), refresh parity baseline + dashboard, reconcile accepted-divergences | general-purpose | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md`, `test/corpus/accepted-divergences.json`, `test/corpus/rules-known-divergences.md` (+ `docs/known-divergences.md` if a residual is accepted) | T2 | [ ] |

T2 and T3 are **sequential** (T3 needs the fix in place). Write-sets are disjoint
(source+test vs corpus baseline/docs). The fix-origin file is a single routing
source per AD-2; if T1 found the fix must span multiple routing files, STOP and
re-scope before starting T2.

## Interface contract (T1 → T2)
T2 consumes from `decision-journal.md`:
```
{ originFile: string,          // e.g. "src/layout/dot/edge-route-chain.ts"
  originLine: number,          // the divergence line
  cPrimitive: string,          // C routine/expression to mirror
  bugClass: "classification" | "box-construction" | "fitter-parameterization" | "routing-order",
  residuals: "shared-cause" | "independent-noise" | "mixed" }  // disposition of the ~56 sub-2pt edges
```
