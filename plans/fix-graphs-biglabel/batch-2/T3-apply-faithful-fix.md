# T3 — apply the faithful fix at the origin

## Context

T2 pinned the single origin where the port's edge-spline geometry first departs
from C for `struct1:f2→struct3:here`, producing 1 cubic instead of the oracle's
2. Apply the minimal faithful fix at that origin (AD-2). The fix must reproduce
the C behavior exactly — do NOT hand-tune coefficients to force the known
2-cubic path; correct the mechanism T2 identified. Enter this task only if T2
did NOT fire the AD-5 escape.

## Task

1. Read T2's `fixSite` and mechanism. Apply the smallest change at that origin
   that makes the port match C.
2. If the origin is logic-bearing, add/extend a colocated `.test.ts` (vitest,
   repo style) that pins the corrected behavior TDD-style (red → green).
3. Re-render `biglabel.gv` (`GVBINDIR=/tmp/ghl` + npx-cached tsx) and confirm
   `g[5]/path[1]/@d` now matches the oracle's piece count (2 cubics) and
   geometry within byte-match, OR documented libm ULP per AD-3.
4. `npx tsc --noEmit` → exit 0.
5. If the origin is a shared primitive (AD-4) and any other corpus id would
   change adversely, STOP before committing.

## Write-set
- the T2-pinned `src/` file (modify) — exactly one
- its colocated `*.test.ts` (create/modify) if logic-bearing

## Read-set
- `.agent-notes/graphs-biglabel-rootcause.md` (T2: mechanism + fixSite)
- `decisions.md#ad-2`, `#ad-3`, `#ad-4`
- the pinned file + its existing tests
- `~/git/graphviz` counterpart of the pinned file (faithful reference)

## Architecture decisions (locked)
- AD-2 fix at origin; AD-3 done-bar; AD-4 shared-primitive guard.

## Interface contract
Consumes T2 `{ fixSite, mechanism, verdictTarget }`. Produces: the corrected
`src/` file; the re-rendered edge spline matches the target per AD-3.

## Acceptance criteria
- Given the fix, when `biglabel.gv` is re-rendered, then `g[5]/path[1]/@d`
  matches the oracle's 2-cubic piece count and geometry (byte-match, or
  documented libm ULP per AD-3).
- Given `npx tsc --noEmit`, when run, then exit 0.
- Given a colocated test (if logic-bearing), when `npx vitest run` on it, then
  it passes and failed before the fix.
- Given a shared-primitive origin (AD-4), when any other id would regress, then
  the task stops before committing.

## Observability
N/A — internal layout geometry; no new observable operation.

## Rollback
Reversible — revert the branch. No migration.

## Quality bar
`tsc --noEmit` exit 0; edge spline matches per AD-3; test (if any) green.
Return only the structured result — no preamble.

## Commit
`fix(T3): <origin> — faithful edge-spline routing for nested record port`
(body: mechanism + why the 1→2 cubic change is faithful to C)
