# T4 — Fix flat-edge compass-port placement (#241_0)

## Context
Same mission. T2 named the divergent flat-edge function (`divergentFn`, `cRef`)
and root cause. `241_0.dot` same-rank compass-port edges route their endpoints
differently than C.

## Task
Faithfully port the C flat-edge compass-port branch into `divergentFn`,
preserving side-effect order. Add a colocated regression test asserting the
corrected flat edge endpoint/path.

1. Read the C function at `cRef` (make_flat_edge / FLATEDGE beginpath/endpath +
   `compassPort`); port the exact logic. Cite C `file:line` in JSDoc.
2. Add/extend a colocated `*.test.ts` asserting the corrected flat edge `@d`
   for the `241_0` exemplar edge from T2.

## Write-set
- `src/<file from T2>` (Modify).
- `src/<file from T2>.test.ts` (Create or extend).

## Read-set
- `decision-journal.md` (T2 rows: `divergentFn`, `cRef`, `rootCause`).
- The C function at `cRef`; `lib/dotgen/dotsplines.c` flat-edge path.
- `decisions.md#ad-1`, `#ad-3`, `#ad-4`.

## Architecture decisions (locked)
AD-1 match C exactly; AD-3 oracle-pinned + curated gate untouched; AD-4 stop if
the fix exceeds the compass-port branch.

## Acceptance criteria (Given/When/Then)
- **Given** `241_0.dot`, **when** rendered, **then** the divergent flat edge's
  `@d` byte/structural-matches the oracle.
- **Given** the survey, **then** `241_0` improves verdict and the per-id diff
  shows **0 regressions**.
- **Given** `npx vitest run`, **then** the 128 goldens are byte-identical and all
  tests pass (incl. the new flat-edge test).
- **Given** the changed files, **then** `tsc`/`lizard` clean.

## Observability
N/A.

## Rollback notes
Reversible — revert the commit.

## Boundaries
- **Always:** port C exactly; keep goldens byte-identical.
- **Never:** modify the curated golden suite; touch the regular-edge path (T3's).
- **STOP:** fix needs files outside the T2 write-set; same location changed 3×;
  any golden changes; cause exceeds the compass-port branch (AD-4).

## Commit
`fix(T4): port #241_0 flat compass-port endpoint placement`.

## Quality bar
tsc 0; vitest 0 failures + 128 goldens byte-identical; survey 0 regressions +
#241_0 improved; lizard clean. Return only the structured result.
