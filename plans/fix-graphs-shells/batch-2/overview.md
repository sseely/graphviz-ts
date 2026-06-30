<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Fix + verify

Starts only after Batch 1's mechanism artifact is confirmed by the human. Apply
the faithful fix at the pinned origin, add a regression test, then refresh the
parity baseline.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2 | Apply faithful fix at the Batch-1 origin + regression test | debugger | `src/layout/dot/mincross-cross.ts` + its `*.test.ts` | T1 | [x] |
| T3 | Re-survey, gate (0 regressions), refresh parity baseline + dashboard | general-purpose | `test/corpus/parity.json`, `test/corpus/PARITY.md` | T2 | [x] |

T2 and T3 are **sequential** (T3 needs the fix in place). Write-sets are disjoint
(source+test vs corpus baseline files). The fix-origin file is a single mincross
source per AD-2; if T1 found the fix must span multiple mincross files, STOP and
re-scope before starting T2.

## Interface contract (T1 → T2)
T2 consumes from `decision-journal.md`:
```
{ originFile: string,          // e.g. "src/layout/dot/mincross-order.ts"
  originLine: number,          // the divergence line
  cPrimitive: string,          // C comparison/flag to mirror
  bugClass: "tie-break" | "heuristic-miss" }
```
