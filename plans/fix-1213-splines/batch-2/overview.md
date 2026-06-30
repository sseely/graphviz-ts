<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 2 — Fix + verify

Starts only after Batch 1's mechanism artifact is confirmed by the human. Apply the
faithful fix at the pinned origin, add a regression test, then refresh the parity
baseline.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T2 | Apply faithful fix at the Batch-1 origin + regression test | debugger | `src/layout/dot/flat.ts` + `flat.test.ts` (finalized from T1) | T1 | [x] |
| T3 | Re-survey, gate (0 regressions), refresh parity baseline + dashboard | general-purpose | `test/corpus/parity.json`, `test/corpus/parity-rules.json`, `test/corpus/PARITY.md` | T2 | [x] |

**T3 result:** Survey (789 cases) + `survey:gate` **PASS — 0 regressions, 3
improvements**: `1213-1` (diverged→**conformant**), `1213-2`
(diverged→**conformant**), and bonus `2470` (diverged→**structural-match**), all
from the T2 flat_limits fix. Baseline + `PARITY.md` refreshed (structurally-equal
733→736; conformant 539→541). Commit `537fd2c`.

**T2 result:** Origin finalized to `src/layout/dot/flat.ts` (not `edge-route*.ts`).
Replaced the crude `flatLimits`/`limitsLeft`/`limitsRight` with a faithful port of
C `flat.c:flat_limits` + `setbounds` + `findlr` (topology-aware label-vnode
placement). Regression test added in `flat.test.ts` (renders 1213-1, pins the 5
warped edges to oracle control points; point-count assertion fails on pre-fix
code). `1213-1` (5 edges) and `1213-2` (8 edges) now byte-match the oracle.
typecheck exit 0; `npx vitest run src/layout/dot` 484/484 pass. Commit `588f5f1`.

T2 and T3 are **sequential** (T3 needs the fix in place). Write-sets are disjoint
(source+test vs corpus baseline files). The fix-origin file is a single routing source
per AD-2; if T1 found the fix must span multiple routing files, STOP and re-scope before
starting T2.

## Interface contract (T1 → T2)
T2 consumes from `decision-journal.md`:
```
{ originFile: string,          // e.g. "src/layout/dot/edge-route-boxes.ts"
  originLine: number,          // the divergence line
  cPrimitive: string,          // C routine/expression to mirror
  bugClass: "box-construction" | "fitter-parameterization" | "classification" }
```
