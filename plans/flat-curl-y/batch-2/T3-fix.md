# T3 — Fix the isolated flat curl-Y cause(s) (#241_0)

## Context
Same mission. T1 (non-adjacent) and T2 (adjacent) classified each path's curl-Y
divergence and stated `isolable` + `sharesCauseWithT1`. Read those journal rows
first and apply the Batch 2 decision gate.

## Task
Faithfully port the C box-Y/spline geometry for the isolated cause(s), so the
flat edges curl to C's Y-extent and #241_0's bbox height matches (86). Add a
colocated regression test.

1. Read the C function(s) at `cRef` (from T1/T2); port the exact Y geometry,
   preserving side-effect order. Cite C `file:line` in JSDoc.
2. Per AD-4: one fix if shared cause; else fix the more isolated path and log the
   deferred path as a follow-on.
3. Add/extend a colocated `*.test.ts` asserting the corrected flat `@d` (e.g.
   `5:ne->8:nw` peak Y, and/or `3:sw->2:se` bottom curl).

## Write-set
- `src/layout/dot/splines-flat.ts` (Modify).
- `src/layout/dot/edge-route-faithful.ts` (Modify — only if T1/T2 pin a shared
  box-Y helper there).
- `src/layout/dot/<file>.test.ts` (Create or extend).

## Read-set
- `decision-journal.md` (T1/T2 rows: `divergentFn`, `cRef`, `cause`, `isolable`,
  `sharesCauseWithT1`).
- The C function(s) at `cRef`.
- `decisions.md#ad-1`, `#ad-3`, `#ad-4`, `#ad-5`.

## Architecture decisions (locked)
AD-1 match C exactly; AD-3 oracle-pinned + curated gate untouched; AD-4 fix the
isolated cause(s), defer the rest; AD-5 Y-only (the X already matches — do not
touch it).

## Acceptance criteria (Given/When/Then)
- **Given** `241_0.dot`, **when** rendered, **then** the fixed path's flat edges'
  `@d` byte/structural-match the oracle (curl reaches C's Y-extent) and the bbox
  height -> 86 (cardinal `:e->:w` edges land at the oracle Y) for that path's
  contribution.
- **Given** the survey, **then** `241_0` improves and the per-id diff shows **0
  regressions**.
- **Given** `npx vitest run`, **then** the 128 goldens are conformant and all
  tests pass (incl. the new curl test).
- **Given** the changed files, **then** `tsc`/`lizard` clean.

## Observability
N/A.

## Rollback notes
Reversible — revert the commit.

## Boundaries
- **Always:** port C exactly; keep goldens conformant; fix only the isolated
  cause(s).
- **Never:** modify the curated golden suite; touch the flat-edge X; attempt a
  non-isolable multi-path rewrite (AD-4).
- **STOP:** fix needs files outside the T1/T2 write-set; same location changed
  3x; any golden changes; cause not isolable.

## Commit
`fix(T3): port #241_0 flat curl-Y geometry (<path>)`.

## Quality bar
tsc 0; vitest 0 failures + 128 goldens conformant; survey 0 regressions +
#241_0 improved; lizard clean. Return only the structured result.
