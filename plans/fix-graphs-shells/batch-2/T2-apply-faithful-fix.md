<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Apply faithful fix at the pinned origin + regression test

## Context
graphviz-ts is a faithful port; C is the spec. Batch 1 pinned the exact mincross
stage/line where the port's within-rank order diverges from C on the three
shells flat ranks, and classified it (tie-break vs heuristic-miss). Read the
mechanism artifact in `decision-journal.md` before starting — it supplies the
`originFile`, `originLine`, `cPrimitive`, and `bugClass` (interface contract in
batch-2/overview.md).

## Task
Apply the **minimal faithful fix** at the Batch-1 origin so the port produces the
**same within-rank order as C** for the three flat ranks. Mirror the exact C
primitive named in the artifact (e.g. the transpose improvement comparison, a
`reverse` flag, median equal-value handling, or the best-order capture boundary).
Do not rewrite or restructure the mincross algorithm (project `CLAUDE.md`); the
change should be a small, targeted edit at the origin (AD-3).

Add a regression test in the origin module's `*.test.ts` that pins the corrected
within-rank order for the shells flat ranks (assert on the specific L-R sequences:
`vsh esh`, `ksh System-V`, `ksh-POSIX POSIX`), so the swap cannot silently return.

## Write-set
- `src/layout/dot/<originFile>.ts` — the single fix (from T1; AD-2)
- `src/layout/dot/<originFile>.test.ts` (or the nearest existing mincross test) —
  regression test
- (If the regression is better expressed at integration level, a focused test
  asserting the three ranks' node order from a shells-subset graph is acceptable —
  keep it in `src/layout/dot`.)

## Read-set
- `decision-journal.md` (mechanism artifact — required)
- The C origin in `~/git/graphviz/lib/dotgen/mincross.c` (the `cPrimitive`)
- `src/layout/dot/<originFile>.ts` (full symbol being edited)
- Existing `src/layout/dot/mincross-*.test.ts` for test patterns/fixtures

## Architecture decisions in scope
AD-2 (single origin file), AD-3 (match C order exactly, port the exact tie-break),
AD-4 (reversible).

## Acceptance criteria
- **Given** the fix, **when** `~/git/graphviz/graphs/directed/shells.gv` is
  rendered by the port (`GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl npx tsx
  test/corpus/render-one.ts <input> dot`), **then** the three flat ranks read
  `vsh esh` / `ksh System-V` / `ksh-POSIX POSIX` — matching the oracle.
- **Given** the regression test, **when** `npx vitest run src/layout/dot`, **then**
  it passes and would fail on the pre-fix code.
- **Given** `npm run typecheck`, **then** exit 0.
- **Given** `npx vitest run src/layout/dot`, **then** all existing mincross tests
  still pass (no order regression elsewhere).

## Observability requirements
N/A — no new observable runtime operations.

## Rollback notes
Reversible — revert the commit. No data/schema/API change.

## Quality bar
Minimal targeted edit at the origin; no algorithm rewrite. Return only the diff
summary and the shells-order verification result. No preamble.

## Boundaries
- **Always:** keep the change within the single origin file + its test.
- **Ask first / STOP:** if the fix would require editing a second mincross source
  (AD-2 violation) or if matching C's order needs more crossings than C
  (heuristic-miss that can't be ported faithfully) — stop and report.
- **Never:** add config knobs, new abstractions, or "improved" ordering logic.

## Commit format
`fix(T2): match C mincross flat-rank order for shells (<cPrimitive>)` with a body
explaining the mechanism (why the order swapped) if the change is non-obvious.
