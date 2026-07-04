<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — Apply faithful fix at the pinned origin + regression test

## Context
graphviz-ts is a faithful port; C is the spec. Batch 1 pinned the exact routing stage/
line where the port's `constraint=false` edge splines diverge from C on 1213-1, and
classified it. Read the mechanism artifact in `decision-journal.md` before starting — it
supplies `originFile`, `originLine`, `cPrimitive`, and `bugClass` (interface contract in
batch-2/overview.md). The init_rank error is out of scope (AD-4).

## Task
Apply the **minimal faithful fix** at the Batch-1 origin so the port produces the
**same spline control points as C** for the three `constraint=false` edges (V0->V2,
V0->V3, V1->V9). Mirror the exact C primitive named in the artifact (box construction,
endpoint/port handling, or the fitter parameterization). Do not rewrite or restructure
the routing pipeline (project `CLAUDE.md`); the change should be a small, targeted edit
at the origin (AD-3).

Add a regression test in the origin module's `*.test.ts` (or the nearest existing
edge-route test) that pins the corrected behavior so the delta cannot silently return.
Prefer asserting the exact C primitive's output at unit level; if better expressed at
integration level, a focused test asserting the three edges' control points (within
deterministic tolerance) from the 1213-1 graph is acceptable — keep it in
`src/layout/dot`.

## Write-set
- `src/layout/dot/<originFile>.ts` — the single fix (from T1; AD-2)
- `src/layout/dot/<originFile>.test.ts` (or nearest existing edge-route test) —
  regression test

## Read-set
- `decision-journal.md` (mechanism artifact — required)
- The C origin in `~/git/graphviz/lib/dotgen/{splines.c,dotsplines.c,class2.c}` (the
  `cPrimitive`)
- `src/layout/dot/<originFile>.ts` (full symbol being edited)
- Existing `src/layout/dot/edge-route*.test.ts` / `splines*.test.ts` for test
  patterns/fixtures

## Architecture decisions in scope
AD-2 (single origin file), AD-3 (match C control points exactly), AD-4 (oracle baseline,
no init_rank repro), AD-5 (reversible).

## Acceptance criteria
- **Given** the fix, **when** `~/git/graphviz/tests/1213-1.dot` is rendered by the port
  (`GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts <input>
  dot`), **then** the three constraint=false edges' control points match the oracle
  within deterministic tolerance (±0.01).
- **Given** the same for `1213-2.dot`, **then** its analogous edges also match.
- **Given** the regression test, **when** `npx vitest run src/layout/dot`, **then** it
  passes and would fail on the pre-fix code.
- **Given** `npm run typecheck`, **then** exit 0.
- **Given** `npx vitest run src/layout/dot`, **then** all existing edge-route tests still
  pass (no routing regression elsewhere).

## Observability requirements
N/A — no new observable runtime operations.

## Rollback notes
Reversible — revert the commit. No data/schema/API change.

## Quality bar
Minimal targeted edit at the origin; no pipeline rewrite. Return only the diff summary
and the 1213-1/1213-2 spline verification result. No preamble.

## Boundaries
- **Always:** keep the change within the single origin file + its test.
- **Ask first / STOP:** if the fix would require editing a second routing source
  (AD-2 violation), or if matching C needs reproducing the init_rank-degraded state
  (AD-4) — stop and report.
- **Never:** add config knobs, new abstractions, or "improved" routing logic.

## Commit format
`fix(T2): match C constraint=false spline routing for 1213 (<cPrimitive>)` with a body
explaining the mechanism (why the control points diverged) if the change is non-obvious.
