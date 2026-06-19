# T3 — Fix regular-edge compass-port placement (#2168)

## Context
Same mission. T1 named the divergent regular-edge function (`divergentFn`,
`cRef`) and root cause in `decision-journal.md`. `2168.dot` regular edges with
head compass ports place endpoints at the wrong compass point vs C.

## Task
Faithfully port the C compass-port endpoint/box branch into `divergentFn`,
preserving side-effect order and the exact compass-point geometry. Add a
colocated regression test asserting the corrected endpoint.

1. Read the C function at `cRef` (+ callees: `compassPort`, beginpath/endpath);
   port the exact logic. Cite C `file:line` in JSDoc.
2. Add/extend a colocated `*.test.ts` asserting the corrected edge endpoint(s)
   for #2168 (e.g. edge1 head ≈ the `:sw` compass point).

## Write-set
- `src/<file from T1>` (Modify).
- `src/<file from T1>.test.ts` (Create or extend).

## Read-set
- `decision-journal.md` (T1 rows: `divergentFn`, `cRef`, `rootCause`).
- The C function at `cRef`; `lib/common/shapes.c:compassPort`.
- `decisions.md#ad-1`, `#ad-3`, `#ad-4`.

## Architecture decisions (locked)
AD-1 match C exactly; AD-3 oracle-pinned + curated gate untouched; AD-4 stop if
the fix exceeds the compass-port branch.

## Acceptance criteria (Given/When/Then)
- **Given** `2168.dot`, **when** rendered, **then** both edges' `@d` endpoints
  byte/structural-match the oracle.
- **Given** the survey, **then** `2168` (+`2168_1..5` where applicable) improve
  verdict and the per-id diff shows **0 regressions**.
- **Given** `npx vitest run`, **then** the 128 goldens are byte-identical and all
  tests pass (incl. the new endpoint test).
- **Given** the changed files, **then** `tsc`/`lizard` clean.

## Observability
N/A.

## Rollback notes
Reversible — revert the commit.

## Boundaries
- **Always:** port C exactly; keep goldens byte-identical.
- **Never:** modify the curated golden suite; touch the flat-edge path (T4's).
- **STOP:** fix needs files outside the T1 write-set; same location changed 3×;
  any golden changes; cause exceeds the compass-port branch (AD-4).

## Commit
`fix(T3): port #2168 regular compass-port endpoint placement`.

## Quality bar
tsc 0; vitest 0 failures + 128 goldens byte-identical; survey 0 regressions +
#2168 improved; lizard clean. Return only the structured result.
