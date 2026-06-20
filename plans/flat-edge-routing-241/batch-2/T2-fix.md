# T2 — Fix the divergent flat-edge routing branch (#241_0)

## Context
Same mission. T1 named the divergent flat-routing function (`divergentFn`,
`cRef`) and root cause in `decision-journal.md`. #241_0's diagonal compass-port
flat edges route straight/wrong-bulge and at the wrong vertical offset vs C.

## Task
Faithfully port the C flat-routing branch into `divergentFn`, preserving
side-effect order and the exact box/curl geometry. Add a colocated regression
test asserting the corrected flat edge `@d`.

1. Read the C function at `cRef` (+ callees: `make_flat_edge`,
   `make_flat_bottom_edges`, `makeFlatEnd`/`makeBottomFlatEnd`); port the exact
   logic. Cite the C `file:line` in JSDoc.
2. If adding logic pushes `splines-flat.ts` over 500 lines, extract the flat-box
   helpers to a NEW `src/layout/dot/splines-flat-boxes.ts` (AD-5); import back.
3. Add/extend a colocated `*.test.ts` asserting the corrected `@d` for the T1
   exemplar edge(s) (e.g. `3:sw->2:se` now curls below; the bbox y-shift is
   gone so cardinal `:e->:w` edges land at the oracle y).

## Write-set
- `src/layout/dot/splines-flat.ts` (Modify).
- `src/layout/dot/splines-flat-boxes.ts` (Create — only if AD-5 extraction).
- `src/layout/dot/<file>.test.ts` (Create or extend).

## Read-set
- `decision-journal.md` (T1 rows: `divergentFn`, `cRef`, `rootCause`,
  `sharedCause`).
- The C function at `cRef`; `lib/dotgen/dotsplines.c` flat-edge path.
- `decisions.md#ad-1`, `#ad-3`, `#ad-4`, `#ad-5`.

## Architecture decisions (locked)
AD-1 match C exactly; AD-3 oracle-pinned + curated gate untouched; AD-4 stop if
the fix exceeds the flat-routing branch; AD-5 extract helpers over bloating.

## Acceptance criteria (Given/When/Then)
- **Given** `241_0.dot`, **when** rendered, **then** the diverging flat edges'
  `@d` byte/structural-match the oracle AND the cardinal `:e->:w` edges land at
  the oracle y (bbox shift resolved).
- **Given** the survey, **then** `241_0` improves verdict (diverged ->
  structural/byte-match) and the per-id diff shows **0 regressions**.
- **Given** `npx vitest run`, **then** the 128 goldens are byte-identical and all
  tests pass (incl. the new flat-routing test).
- **Given** the changed files, **then** `tsc`/`lizard` clean (incl. the 500-line
  cap — extract per AD-5 if needed).

## Observability
N/A.

## Rollback notes
Reversible — revert the commit.

## Boundaries
- **Always:** port C exactly; keep goldens byte-identical; extract helpers over
  exceeding the file cap.
- **Never:** modify the curated golden suite; touch the compass-port endpoint
  code (already correct).
- **STOP:** fix needs files outside the declared write-set; same location
  changed 3x; any golden changes; cause exceeds the flat-routing branch (AD-4).

## Commit
`fix(T2): port #241_0 flat-edge routing geometry`.

## Quality bar
tsc 0; vitest 0 failures + 128 goldens byte-identical; survey 0 regressions +
#241_0 improved; lizard clean. Return only the structured result.
