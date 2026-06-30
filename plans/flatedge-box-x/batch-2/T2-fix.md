# T2 — FLATEDGE-gate the end-box x to match C (#241_0 non-adjacent)

## Context
Same mission. T1 pinned the exact line (`divergentFn`, `cRef`) where the
FLATEDGE end box uses the node-edge x-reference (`coord.x +/- rw/lw`) vs C's
node-centre (`coord.x`), and confirmed it is FLATEDGE-gatable.

## Task
Correct the FLATEDGE end-box x-reference to match C, gated to the flat-edge path
(AD-5) so regular-edge box construction is untouched. Add a colocated regression
test.

1. Apply the T1 fix at `divergentFn`, gated to et === FLATEDGE / the makeFlatEnd
   call. Cite the C `file:line` in JSDoc.
2. Add/extend a colocated `*.test.ts` asserting the corrected flat-end box x (and
   ideally the corrected `@d` for `1:se->6:sw`).

## Write-set
- `src/<file from T1>` (Modify) — the FLATEDGE branch only.
- `src/<file from T1>.test.ts` (Create or extend).

## Read-set
- `decision-journal.md` (T1 rows: `divergentFn`, `cRef`, `correctXref`, `gatable`).
- The C function at `cRef`.
- `decisions.md#ad-1`, `#ad-3`, `#ad-4`, `#ad-5`.

## Architecture decisions (locked)
AD-1 match C exactly; AD-3 oracle-pinned + curated gate untouched; AD-4 stop if
the fix exceeds the FLATEDGE branch; AD-5 FLATEDGE-gating (regular edges
untouched).

## Acceptance criteria (Given/When/Then)
- **Given** `241_0.dot`, **when** rendered, **then** the non-adjacent flat edges
  (`1:se->6:sw`, `5:ne->8:nw`) `@d` byte/structural-match the oracle (or measurably
  improve toward it).
- **Given** the survey, **then** `241_0` improves and the per-id diff shows **0
  regressions**.
- **Given** `npx vitest run`, **then** the 128 goldens are conformant (esp.
  every REGULAR-edge golden — proof the FLATEDGE gating held) and all tests pass.
- **Given** `git diff --name-only`, **then** only the FLATEDGE branch + its test
  changed; `tsc`/`lizard` clean.

## Observability
N/A.

## Rollback notes
Reversible — revert the commit.

## Boundaries
- **Always:** gate to FLATEDGE; keep ALL goldens conformant; port C exactly.
- **Never:** modify the curated golden suite; alter regular-edge box-x; touch the
  adjacent `make_flat_adj_edges` path.
- **STOP:** any regular-edge golden changes (gating failed); fix needs files
  outside the T1 write-set; same location changed 3x; not gatable (AD-4/AD-5).

## Commit
`fix(T2): FLATEDGE-gate flat end-box x to node centre (match C)`.

## Quality bar
tsc 0; vitest 0 failures + 128 goldens conformant; survey 0 regressions +
#241_0 improved; lizard clean. Return only the structured result.
