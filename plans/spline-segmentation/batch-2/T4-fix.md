# T4 — Fix the issue-numbered routing case

## Context
Same mission. T3 chose an issue-numbered `path-structure` case, recovered its
intent from the GitLab issue + MR, and named the divergent port function with
the C reference (see `decision-journal.md`).

## Task
Faithfully port the C routing branch so the chosen case improves its verdict
(`diverged → structural-match` or `byte-match`), guided by the issue's intent.
Implement exactly what C does (AD-1). Add a test locking the corrected routing.

1. Read the C function at `cRef` (+ callees); port the exact logic into
   `divergentFn`, preserving side-effect order and the edge case the issue
   describes. Cite the C `file:line` and the issue `#num` in JSDoc.
2. Add/extend a colocated `*.test.ts` asserting the corrected edge path.

## Write-set
- `src/<file from T3>` (Modify).
- `src/<file>.test.ts` (Create or extend).

## Read-set
- `decision-journal.md` (T3 row: `issueIntent`, `divergentFn`, `cRef`).
- The C function at `cRef`; the MR diff for the original fix.
- `decisions.md#ad-1`, `#ad-3`, `#ad-4`.

## Architecture decisions (locked)
AD-1 match C exactly; AD-3 oracle-pinned + curated gate untouched; AD-4 intent
from the issue/MR.

## Acceptance criteria (Given/When/Then)
- **Given** the chosen input, **when** rendered, **then** its divergent edge
  `@d` byte/structural-matches the oracle.
- **Given** the survey, **when** re-run, **then** the case improves verdict and
  the per-id diff shows **0 regressions**.
- **Given** `npx vitest run`, **then** the 128 goldens are byte-identical and all
  tests pass (incl. the new routing test).
- **Given** the changed files, **then** `tsc`/`lizard` clean.

## Observability
N/A.

## Rollback notes
Reversible — revert the commit.

## Boundaries
- **Always:** port C exactly; honor the issue's intent; keep goldens byte-identical.
- **Never:** modify the curated golden suite; expand beyond the one case without
  a logged decision.
- **STOP:** fix needs files outside the T3 write-set; same location changed 3×;
  any golden changes.

## Commit
`fix(T4): port issue-#<num> dot routing fix`.

## Quality bar
tsc 0; vitest 0 failures + 128 goldens byte-identical; survey 0 regressions +
target improved; lizard clean. Return only the structured result.
